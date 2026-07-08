"""Drive import: scan an existing client folder and suggest processo/document links.

Addresses the onboarding gap where a client already has a Google Drive folder
mixing personal documents and legal-process files, with nothing in the system
tying them to a ``Processo`` or categorizing them. The flow is:

1. :func:`escanear_arvore` walks the Drive tree read-only (bounded, no writes).
2. :func:`sugerir_plano` runs the CNJ/CPF-CNPJ/keyword heuristics over the tree
   and proposes processos and document categories — still read-only.
3. A human reviews/edits the suggestions in the UI, then
   :func:`confirmar_importacao` persists the reviewed plan (transactional,
   idempotent on ``numero_processo`` and ``drive_file_id``).
"""

from __future__ import annotations

from django.db import transaction

from core.br_identifiers import classificar_por_palavras, extrair_cnj, extrair_cpf_cnpj
from integrations.google import drive
from integrations.google.client import drive_service
from processos.models import Processo

from .models import DocumentoCliente, ProcessoDrive

# Safety bounds: a personal Drive folder scan must not run away on a huge or
# accidentally-shared tree.
MAX_NOS = 500
MAX_PROFUNDIDADE = 6


def escanear_arvore(usuario, pasta_raiz_id: str) -> dict:
    """Recursively walk ``pasta_raiz_id`` in Drive and return its tree, read-only.

    Bounded by ``MAX_NOS`` (total files+folders visited) and ``MAX_PROFUNDIDADE``
    so a large or misconfigured folder can't exhaust the request.
    """
    service = drive_service(usuario)
    contador = 0

    def _percorrer(pasta_id: str, nome: str, profundidade: int) -> dict:
        nonlocal contador
        no = {"id": pasta_id, "nome": nome, "arquivos": [], "subpastas": []}
        if profundidade > MAX_PROFUNDIDADE or contador >= MAX_NOS:
            return no

        for arquivo in drive.list_files(service, pasta_id):
            if contador >= MAX_NOS:
                break
            no["arquivos"].append(
                {
                    "id": arquivo["id"],
                    "nome": arquivo.get("name", ""),
                    "mime_type": arquivo.get("mimeType", ""),
                    "tamanho_bytes": int(arquivo.get("size") or 0),
                    "link_visualizacao": arquivo.get("webViewLink", ""),
                }
            )
            contador += 1

        for subpasta in drive.list_folders(service, pasta_id):
            if contador >= MAX_NOS:
                break
            contador += 1
            no["subpastas"].append(
                _percorrer(subpasta["id"], subpasta.get("name", ""), profundidade + 1)
            )

        return no

    return _percorrer(pasta_raiz_id, "", 0)


def sugerir_plano(arvore: dict, cliente) -> dict:
    """Build a read-only suggestion plan from a scanned tree.

    Does not touch the DB beyond a single read of the client's existing
    processos (used only to avoid suggesting a duplicate). Folder names and
    file names are scanned for a CNJ number (identifies a processo) and for
    personal/processo keywords (categorization); a CNJ or category found on a
    folder is inherited by its files and subfolders unless overridden closer
    to the leaf.
    """
    numeros_existentes = set(
        Processo.objects.filter(cliente=cliente).values_list(
            "numero_processo", flat=True
        )
    )
    processos_sugeridos: dict[str, dict] = {}
    documentos_sugeridos: list[dict] = []

    def _registrar_processo_sugerido(
        numero: str, pasta_id: str, pasta_nome: str
    ) -> None:
        if numero in numeros_existentes or numero in processos_sugeridos:
            return
        processos_sugeridos[numero] = {
            "numero_processo": numero,
            "origem_pasta_id": pasta_id,
            "origem_pasta_nome": pasta_nome,
        }

    def _percorrer(no: dict, cnj_herdado: str, categoria_herdada: str | None) -> None:
        nome_pasta = no.get("nome", "")
        cnjs_pasta = extrair_cnj(nome_pasta)
        cnj_atual = cnjs_pasta[0] if cnjs_pasta else cnj_herdado
        categoria_pasta = classificar_por_palavras(nome_pasta) or categoria_herdada

        if cnj_atual:
            _registrar_processo_sugerido(cnj_atual, no["id"], nome_pasta)

        for arquivo in no.get("arquivos", []):
            nome_arquivo = arquivo.get("nome", "")
            cnjs_arquivo = extrair_cnj(nome_arquivo)
            cpfs_arquivo = extrair_cpf_cnpj(nome_arquivo)
            cnj_arquivo = cnjs_arquivo[0] if cnjs_arquivo else cnj_atual
            categoria_arquivo = (
                classificar_por_palavras(nome_arquivo) or categoria_pasta
            )

            if cnj_arquivo:
                _registrar_processo_sugerido(cnj_arquivo, no["id"], nome_pasta)

            if categoria_arquivo == "processo":
                categoria_final = DocumentoCliente.CATEGORIA_PETICAO
            elif categoria_arquivo == "pessoal":
                categoria_final = DocumentoCliente.CATEGORIA_DOCUMENTO
            else:
                categoria_final = DocumentoCliente.CATEGORIA_OUTRO

            documentos_sugeridos.append(
                {
                    "drive_file_id": arquivo["id"],
                    "nome": nome_arquivo,
                    "mime_type": arquivo.get("mime_type", ""),
                    "tamanho_bytes": arquivo.get("tamanho_bytes", 0),
                    "drive_folder_id": no["id"],
                    "link_visualizacao": arquivo.get("link_visualizacao", ""),
                    "categoria_sugerida": categoria_final,
                    "numero_processo_sugerido": cnj_arquivo or "",
                    "cpf_cnpj_encontrado": cpfs_arquivo[0] if cpfs_arquivo else "",
                }
            )

        for subno in no.get("subpastas", []):
            _percorrer(subno, cnj_atual, categoria_pasta)

    _percorrer(arvore, "", None)

    return {
        "processos_sugeridos": list(processos_sugeridos.values()),
        "documentos_sugeridos": documentos_sugeridos,
    }


@transaction.atomic
def confirmar_importacao(
    cliente, processos: list[dict], documentos: list[dict]
) -> dict:
    """Persist a human-reviewed import plan.

    ``processos`` and ``documentos`` are the (possibly edited) suggestion rows
    from :func:`sugerir_plano`. Idempotent: matches processos by
    ``(cliente, numero_processo)`` and documentos by ``drive_file_id`` (unique),
    so resending the same payload updates rather than duplicates.
    """
    numero_para_processo: dict[str, Processo] = {}
    for item in processos:
        numero = (item.get("numero_processo") or "").strip()
        if not numero:
            continue
        processo, _ = Processo.objects.get_or_create(
            cliente=cliente,
            numero_processo=numero,
            defaults={
                "descricao": item.get("descricao", ""),
                "area_juridica": item.get("area_juridica", ""),
            },
        )
        pasta_id = item.get("origem_pasta_id")
        if pasta_id:
            ProcessoDrive.objects.update_or_create(
                processo=processo, defaults={"pasta_id": pasta_id}
            )
        numero_para_processo[numero] = processo

    documentos_criados = []
    for item in documentos:
        drive_file_id = item.get("drive_file_id")
        if not drive_file_id:
            continue
        numero = (item.get("processo_numero") or "").strip()
        documento, _ = DocumentoCliente.objects.update_or_create(
            drive_file_id=drive_file_id,
            defaults={
                "cliente": cliente,
                "processo": numero_para_processo.get(numero),
                "categoria": item.get("categoria") or DocumentoCliente.CATEGORIA_OUTRO,
                "nome": (item.get("nome") or "")[:255],
                "mime_type": (item.get("mime_type") or "")[:150],
                "tamanho_bytes": item.get("tamanho_bytes") or 0,
                "drive_folder_id": item.get("drive_folder_id") or "",
                "link_visualizacao": item.get("link_visualizacao") or "",
            },
        )
        documentos_criados.append(documento)

    return {
        "processos": list(numero_para_processo.values()),
        "documentos": documentos_criados,
    }
