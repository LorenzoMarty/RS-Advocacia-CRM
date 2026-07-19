"""Drive import: bulk-onboard clients, then scan a client folder for processos/docs.

Addresses the onboarding gap where the firm's Google Drive already has a
"Clientes" tree (one top-level folder per client, processo subfolders inside)
predating the CRM, with nothing in the system tying folders to clients,
processos or documents. Two flows:

Bulk client discovery (root of the "Clientes" tree)
    1. :func:`descobrir_clientes_novos` lists top-level Drive folders not yet
       linked to a ``ClienteDrive`` — read-only.
    2. A human reviews/approves the candidates, then
       :func:`criar_clientes_a_partir_de_pastas` creates a ``Cliente`` per
       approved folder, links the existing folder id immediately (so future
       uploads land there instead of a new folder), and auto-detects that
       client's processos via the per-client scan below.

Per-client scan (existing client, folder may predate or postdate the CRM)
    1. :func:`escanear_arvore` walks the Drive tree read-only (bounded, no writes).
    2. :func:`sugerir_plano` runs the CNJ/CPF-CNPJ/keyword heuristics over the tree
       and proposes processos and document categories — still read-only.
    3. A human reviews/edits the suggestions in the UI, then
       :func:`confirmar_importacao` persists the reviewed plan (transactional,
       idempotent on ``numero_processo`` and ``drive_file_id``).

Periodic sync (``documentos.tasks.sincronizar_drive``, no human in the loop)
    :func:`sincronizar_pasta_conhecida` re-runs the per-client scan for a
    folder the periodic Drive-changes task saw mutate, but only if that folder
    is already part of a tree the CRM owns (a client's or a processo's linked
    folder) — it never guesses at unrelated Drive content.
"""

from __future__ import annotations

import logging
import re

from django.db import transaction
from django.db.models import Q

from ai.services import drive_import as ai_drive
from clientes.models import Cliente
from core.br_identifiers import classificar_por_palavras, extrair_cnj, extrair_cpf_cnpj
from integrations.google import drive
from integrations.google.client import drive_service
from processos.models import Processo

from . import services
from .models import ClienteDrive, DocumentoCliente, ProcessoDrive

logger = logging.getLogger(__name__)

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
            # Convenção do escritório: pasta com sufixo "- HABILITAR" indica que o
            # advogado ainda não foi habilitado nos autos.
            "precisa_habilitar": "habilitar" in pasta_nome.lower(),
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


def _mapear_pastas_da_arvore(arvore: dict) -> dict[str, str]:
    """Map every folder id in the scanned tree to its name."""
    pastas: dict[str, str] = {}

    def _walk(no: dict) -> None:
        pastas[no["id"]] = no.get("nome", "")
        for subpasta in no.get("subpastas", []):
            _walk(subpasta)

    _walk(arvore)
    return pastas


def _ids_de_arquivos_da_arvore(arvore: dict) -> set[str]:
    ids: set[str] = set()

    def _walk(no: dict) -> None:
        for arquivo in no.get("arquivos", []):
            ids.add(arquivo["id"])
        for subpasta in no.get("subpastas", []):
            _walk(subpasta)

    _walk(arvore)
    return ids


def _digitos(texto: str) -> str:
    return re.sub(r"\D", "", texto or "")


def sugerir_plano_ia(arvore: dict, cliente) -> dict:
    """Extend :func:`sugerir_plano` with an AI pass over the same scanned tree.

    The AI only ever sees folder/file names (never file contents). Its output is
    treated as untrusted: CNJ numbers must pass :func:`extrair_cnj`'s validator,
    Drive ids must exist in the scanned tree, and heuristic findings always win
    on conflict. Processos the AI spots without a visible CNJ number become
    ``avisos_processos_sem_numero`` for the reviewer to complete manually —
    they are never auto-created. If the AI call fails for any reason the plain
    heuristic plan is returned with ``ia.usada == False``.
    """
    plano = sugerir_plano(arvore, cliente)
    plano["avisos_processos_sem_numero"] = []
    plano["ia"] = {"usada": False, "aviso": None}

    numeros_existentes = set(
        Processo.objects.filter(cliente=cliente).values_list(
            "numero_processo", flat=True
        )
    )
    contexto = (
        f"Cliente: {cliente.nome}\n"
        "Processos já cadastrados (não sugerir de novo): "
        + (", ".join(sorted(numeros_existentes)) or "nenhum")
    )

    try:
        dados = ai_drive.classificar_arvore(arvore, contexto)
    except Exception:  # degrade to heuristics-only on any AI failure
        logger.exception("Classificação IA da pasta do cliente %s falhou", cliente.pk)
        plano["ia"]["aviso"] = "IA indisponível; usando apenas heurísticas."
        return plano

    plano["ia"]["usada"] = True

    pastas = _mapear_pastas_da_arvore(arvore)
    arquivos_validos = _ids_de_arquivos_da_arvore(arvore)
    sugeridos_por_digitos = {
        _digitos(item["numero_processo"]): item
        for item in plano["processos_sugeridos"]
    }
    digitos_conhecidos = {_digitos(numero) for numero in numeros_existentes}

    for proc in dados.get("processos") or []:
        if not isinstance(proc, dict):
            continue
        numeros = extrair_cnj(str(proc.get("numero_cnj") or ""))
        pasta_id = str(proc.get("pasta_id") or "")
        if pasta_id not in pastas:
            pasta_id = ""
        area = str(proc.get("area_juridica") or "").strip()[:100]
        descricao = str(proc.get("descricao") or "").strip()

        if not numeros:
            titulo = str(proc.get("titulo") or "").strip()
            if not titulo:
                continue
            plano["avisos_processos_sem_numero"].append(
                {
                    "titulo": titulo[:200],
                    "area_juridica": area,
                    "descricao": descricao,
                    "origem_pasta_id": pasta_id,
                    "origem_pasta_nome": pastas.get(pasta_id, ""),
                }
            )
            continue

        numero = numeros[0]
        chave = _digitos(numero)
        if chave in digitos_conhecidos:
            continue
        existente = sugeridos_por_digitos.get(chave)
        if existente is not None:
            existente.setdefault("area_juridica", "")
            existente.setdefault("descricao", "")
            existente["area_juridica"] = existente["area_juridica"] or area
            existente["descricao"] = existente["descricao"] or descricao
            continue
        novo = {
            "numero_processo": numero,
            "origem_pasta_id": pasta_id,
            "origem_pasta_nome": pastas.get(pasta_id, ""),
            "area_juridica": area,
            "descricao": descricao,
            "origem": "ia",
        }
        plano["processos_sugeridos"].append(novo)
        sugeridos_por_digitos[chave] = novo

    docs_por_id = {
        item["drive_file_id"]: item for item in plano["documentos_sugeridos"]
    }
    categorias_validas = {
        DocumentoCliente.CATEGORIA_PETICAO,
        DocumentoCliente.CATEGORIA_DOCUMENTO,
        DocumentoCliente.CATEGORIA_OUTRO,
    }
    for doc in dados.get("documentos") or []:
        if not isinstance(doc, dict):
            continue
        arquivo_id = str(doc.get("arquivo_id") or "")
        item = docs_por_id.get(arquivo_id)
        if item is None or arquivo_id not in arquivos_validos:
            continue
        categoria = str(doc.get("categoria") or "")
        if (
            categoria in categorias_validas
            and categoria != DocumentoCliente.CATEGORIA_OUTRO
            and item["categoria_sugerida"] == DocumentoCliente.CATEGORIA_OUTRO
        ):
            item["categoria_sugerida"] = categoria
            item["origem_categoria"] = "ia"
        numeros = extrair_cnj(str(doc.get("numero_cnj") or ""))
        if numeros and not item["numero_processo_sugerido"]:
            chave = _digitos(numeros[0])
            if chave in sugeridos_por_digitos or chave in digitos_conhecidos:
                item["numero_processo_sugerido"] = numeros[0]

    return plano


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
                "advogado_habilitado": not item.get("precisa_habilitar", False),
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


def descobrir_clientes_novos(usuario) -> list[dict]:
    """List top-level folders under the Drive "Clientes" root with no client yet.

    Read-only. A folder already linked to a :class:`ClienteDrive` (matched by
    id, so renames don't re-surface it) is excluded, whatever its current name.
    """
    service = drive_service(usuario)
    root_id = services._root_folder_id()
    vinculadas = set(ClienteDrive.objects.values_list("pasta_cliente_id", flat=True))

    return [
        {"pasta_id": pasta["id"], "nome": pasta.get("name", "")}
        for pasta in drive.list_folders(service, root_id)
        if pasta["id"] not in vinculadas
    ]


@transaction.atomic
def criar_clientes_a_partir_de_pastas(usuario, pastas: list[dict]) -> list[Cliente]:
    """Bulk-create clients from approved top-level Drive folder candidates.

    Each ``Cliente`` is created with only ``nome`` filled in — CPF, phone and
    email are completed later by the lawyer — but the Drive folder is linked
    by id immediately (no new folder is created), so uploads and processo
    detection use the client's existing tree from the start. For each new
    client this also runs the per-client scan/suggest/confirm flow to
    auto-create its processos (documents are left for the reviewed per-client
    wizard, since categorization there benefits from a human pass).

    Idempotent: a ``pasta_id`` already linked to a client (either from a
    previous call or a race) is skipped rather than duplicated.
    """
    ja_vinculadas = set(ClienteDrive.objects.values_list("pasta_cliente_id", flat=True))
    service = drive_service(usuario)
    criados: list[Cliente] = []

    for item in pastas:
        pasta_id = (item.get("pasta_id") or "").strip()
        nome = (item.get("nome") or "").strip()
        if not pasta_id or not nome or pasta_id in ja_vinculadas:
            continue

        cliente = Cliente.objects.create(nome=nome)
        ClienteDrive.objects.create(
            cliente=cliente,
            pasta_cliente_id=pasta_id,
            pasta_peticoes_id=drive.ensure_folder(service, "Petições", pasta_id),
            pasta_documentos_id=drive.ensure_folder(service, "Documentos", pasta_id),
            pasta_outros_id=drive.ensure_folder(service, "Outros", pasta_id),
        )
        ja_vinculadas.add(pasta_id)
        criados.append(cliente)

        arvore = escanear_arvore(usuario, pasta_id)
        plano = sugerir_plano(arvore, cliente)
        confirmar_importacao(cliente, plano["processos_sugeridos"], [])

    return criados


def _cliente_para_pasta_conhecida(pasta_id: str) -> Cliente | None:
    """Resolve a Drive folder id to the client that already owns it, if any.

    Matches the client's own tracked folders (root or any subfolder in
    :class:`ClienteDrive`) or a processo's linked folder
    (:class:`ProcessoDrive`). Returns ``None`` for anything outside a tree the
    CRM already knows about.
    """
    cliente_drive = (
        ClienteDrive.objects.filter(
            Q(pasta_cliente_id=pasta_id)
            | Q(pasta_peticoes_id=pasta_id)
            | Q(pasta_documentos_id=pasta_id)
            | Q(pasta_outros_id=pasta_id)
            | Q(pasta_reunioes_id=pasta_id)
        )
        .select_related("cliente")
        .first()
    )
    if cliente_drive:
        return cliente_drive.cliente

    processo_drive = (
        ProcessoDrive.objects.filter(pasta_id=pasta_id)
        .select_related("processo__cliente")
        .first()
    )
    if processo_drive:
        return processo_drive.processo.cliente

    return None


def sincronizar_pasta_conhecida(usuario, pasta_id: str) -> dict | None:
    """Re-scan ``pasta_id`` if it's already part of a client tree the CRM owns.

    Used by the periodic Drive sync (no human review): unlike
    :func:`confirmar_importacao`'s normal caller, this auto-confirms both
    processos and documentos, since the client/processo ownership of
    ``pasta_id`` is already established (not a fresh guess from a bare folder
    name). Returns ``None`` — and does nothing — if ``pasta_id`` isn't linked
    to any client or processo yet.
    """
    cliente = _cliente_para_pasta_conhecida(pasta_id)
    if cliente is None:
        return None

    arvore = escanear_arvore(usuario, pasta_id)
    plano = sugerir_plano(arvore, cliente)
    return confirmar_importacao(
        cliente, plano["processos_sugeridos"], plano["documentos_sugeridos"]
    )
