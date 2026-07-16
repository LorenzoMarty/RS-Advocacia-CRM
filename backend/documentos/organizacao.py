"""AI-assisted organization of a client's Drive folder.

Two-step, human-in-the-loop flow mirroring the import wizard:

1. :func:`sugerir_organizacao` scans the client's tree (read-only), asks the AI
   for a plan of ``move``/``rename``/``create_folder`` operations towards the
   firm's folder convention, and validates every operation against the scanned
   tree — AI output is untrusted, so unknown ids, unknown operation types and
   inconsistent ``ref`` links are dropped before the user ever sees them.
2. A human reviews/unchecks operations in the UI, then
   :func:`aplicar_organizacao` re-validates the approved batch against a fresh
   scan (ids may have moved since the suggestion) and executes it. The scanned
   tree doubles as the containment proof: an id only reachable from the
   client's root folder is, by construction, inside the client's folder, so no
   operation can touch Drive content outside it.

Drive operations are not transactional: failures are reported per item and the
whole flow is safe to re-run (re-suggest sees the new state).
"""

from __future__ import annotations

import logging

from django.conf import settings

from ai.services import drive_import as ai_drive
from integrations.google import drive
from integrations.google.client import drive_service
from integrations.google.exceptions import GoogleApiError
from processos.models import Processo

from . import services
from .importacao import confirmar_importacao, escanear_arvore, sugerir_plano
from .models import ClienteDrive, DocumentoCliente

logger = logging.getLogger(__name__)

TIPOS_PERMITIDOS = {"move", "rename", "create_folder"}


class OrganizacaoIndisponivel(Exception):
    """Raised when the AI cannot produce an organization plan."""


class OrganizacaoInvalida(Exception):
    """Raised when the submitted batch of operations is malformed as a whole."""


def _indexar_arvore(arvore: dict) -> tuple[dict[str, str], set[str], dict[str, str]]:
    """Return (folder id -> name, file ids, child id -> parent folder id)."""
    pastas: dict[str, str] = {}
    arquivos: set[str] = set()
    pai_de: dict[str, str] = {}

    def _walk(no: dict) -> None:
        pastas[no["id"]] = no.get("nome", "")
        for arquivo in no.get("arquivos", []):
            arquivos.add(arquivo["id"])
            pai_de[arquivo["id"]] = no["id"]
        for subpasta in no.get("subpastas", []):
            pai_de[subpasta["id"]] = no["id"]
            _walk(subpasta)

    _walk(arvore)
    return pastas, arquivos, pai_de


def _contexto_cliente(cliente) -> str:
    registro = ClienteDrive.objects.filter(cliente=cliente).first()
    linhas = [f"Cliente: {cliente.nome}"]
    if registro:
        linhas.append(
            "Pastas padrão existentes (ids): "
            f"Petições [{registro.pasta_peticoes_id or '-'}], "
            f"Documentos [{registro.pasta_documentos_id or '-'}], "
            f"Outros [{registro.pasta_outros_id or '-'}]"
        )
    processos = list(
        Processo.objects.filter(cliente=cliente).values_list(
            "numero_processo", flat=True
        )
    )
    linhas.append(
        "Processos cadastrados: " + (", ".join(processos) if processos else "nenhum")
    )
    return "\n".join(linhas)


def _cria_ciclo(
    item_id: str, destino_id: str | None, pai_de: dict[str, str]
) -> bool:
    """True when moving folder ``item_id`` into ``destino_id`` would nest it
    inside its own subtree."""
    atual = destino_id
    while atual:
        if atual == item_id:
            return True
        atual = pai_de.get(atual)
    return False


def _validar_operacoes(
    operacoes: list[dict],
    pastas: dict[str, str],
    arquivos: set[str],
    pai_de: dict[str, str],
    raiz_id: str,
) -> tuple[list[dict], list[dict]]:
    """Split raw operations into (valid, rejected-with-reason)."""
    validas: list[dict] = []
    rejeitadas: list[dict] = []

    # Pre-pass: a move may reference a create_folder that appears later in the
    # batch, so collect every valid ref before validating the moves.
    refs_criadas: dict[str, str] = {}  # ref -> pai_id
    for op in operacoes:
        if not isinstance(op, dict) or op.get("tipo") != "create_folder":
            continue
        ref = str(op.get("ref") or "").strip()
        nome = str(op.get("nome") or "").strip()
        pai_id = str(op.get("pai_id") or "").strip()
        if ref and ref not in refs_criadas and nome and pai_id in pastas:
            refs_criadas[ref] = pai_id

    refs_processadas: set[str] = set()

    def _rejeitar(op, motivo: str) -> None:
        rejeitadas.append({"operacao": op, "motivo": motivo})

    for op in operacoes:
        if not isinstance(op, dict):
            _rejeitar({"valor": str(op)}, "Operação não é um objeto.")
            continue
        tipo = op.get("tipo")
        if tipo not in TIPOS_PERMITIDOS:
            _rejeitar(op, "Tipo de operação não permitido.")
            continue

        if tipo == "create_folder":
            ref = str(op.get("ref") or "").strip()
            nome = str(op.get("nome") or "").strip()
            pai_id = str(op.get("pai_id") or "").strip()
            if not ref or ref in refs_processadas:
                _rejeitar(op, "Referência de pasta ausente ou duplicada.")
                continue
            if not nome:
                _rejeitar(op, "Nome da pasta ausente.")
                continue
            if pai_id not in pastas:
                _rejeitar(op, "Pasta-pai fora da pasta do cliente.")
                continue
            refs_processadas.add(ref)
            validas.append(
                {"tipo": tipo, "ref": ref, "nome": nome[:255], "pai_id": pai_id,
                 "motivo": str(op.get("motivo") or "")}
            )
            continue

        item_id = str(op.get("arquivo_id") or "").strip()
        eh_pasta = item_id in pastas
        if not eh_pasta and item_id not in arquivos:
            _rejeitar(op, "Item fora da pasta do cliente.")
            continue
        if item_id == raiz_id:
            _rejeitar(op, "A pasta raiz do cliente não pode ser alterada.")
            continue

        if tipo == "rename":
            novo_nome = str(op.get("novo_nome") or "").strip()
            if not novo_nome:
                _rejeitar(op, "Novo nome ausente.")
                continue
            validas.append(
                {"tipo": tipo, "arquivo_id": item_id, "novo_nome": novo_nome[:255],
                 "motivo": str(op.get("motivo") or "")}
            )
            continue

        # move
        destino_id = str(op.get("destino_id") or "").strip()
        destino_ref = str(op.get("destino_ref") or "").strip()
        if destino_id and destino_id in pastas:
            destino_ref = ""
        elif destino_ref and destino_ref in refs_criadas:
            destino_id = ""
        else:
            _rejeitar(op, "Destino fora da pasta do cliente.")
            continue
        if destino_id and pai_de.get(item_id) == destino_id:
            _rejeitar(op, "Item já está na pasta de destino.")
            continue
        if eh_pasta:
            base_ciclo = destino_id or refs_criadas.get(destino_ref, "")
            if _cria_ciclo(item_id, base_ciclo, pai_de):
                _rejeitar(op, "Movimentação criaria um ciclo de pastas.")
                continue
        validas.append(
            {"tipo": tipo, "arquivo_id": item_id, "destino_id": destino_id,
             "destino_ref": destino_ref, "motivo": str(op.get("motivo") or "")}
        )

    return validas, rejeitadas


def _arvore_do_cliente(usuario, cliente) -> tuple[str, dict]:
    raiz_id = services._client_root_id(cliente)
    if not raiz_id:
        raise OrganizacaoInvalida("Cliente não possui pasta vinculada no Drive.")
    arvore = escanear_arvore(usuario, raiz_id)
    arvore["nome"] = cliente.nome
    return raiz_id, arvore


def sugerir_organizacao(usuario, cliente) -> dict:
    """Ask the AI for an organization plan over the client's scanned tree."""
    raiz_id, arvore = _arvore_do_cliente(usuario, cliente)

    try:
        dados = ai_drive.sugerir_organizacao(arvore, _contexto_cliente(cliente))
    except Exception as exc:
        logger.exception("Sugestão IA de organização do cliente %s falhou", cliente.pk)
        raise OrganizacaoIndisponivel(
            "Não foi possível gerar o plano de organização com IA."
        ) from exc

    brutas = dados.get("operacoes") or []
    if not isinstance(brutas, list):
        brutas = []
    brutas = brutas[: settings.DRIVE_AI_MAX_OPERACOES]

    pastas, arquivos, pai_de = _indexar_arvore(arvore)
    validas, rejeitadas = _validar_operacoes(brutas, pastas, arquivos, pai_de, raiz_id)

    # Heurística (mesmo regex de CNJ do wizard de importação): identifica pastas
    # de processo ainda não cadastradas para propor a criação junto do plano.
    processos_sugeridos = sugerir_plano(arvore, cliente)["processos_sugeridos"]

    # Pastas com indício de processo mas número incompleto/inválido: a mesma
    # chamada de IA já sinaliza (evita um segundo round-trip de IA); validamos
    # só o pasta_id contra a árvore escaneada, sem confiar no número.
    numeros_certos = {item["numero_processo"] for item in processos_sugeridos}
    avisos_brutos = dados.get("avisos_processos") or []
    if not isinstance(avisos_brutos, list):
        avisos_brutos = []
    avisos_processos = []
    for aviso in avisos_brutos[: settings.DRIVE_AI_MAX_OPERACOES]:
        if not isinstance(aviso, dict):
            continue
        pasta_id = str(aviso.get("pasta_id") or "").strip()
        titulo = str(aviso.get("titulo") or "").strip()
        if pasta_id not in pastas or not titulo:
            continue
        numero_parcial = str(aviso.get("numero_parcial") or "").strip()
        if numero_parcial in numeros_certos:
            continue
        avisos_processos.append(
            {
                "origem_pasta_id": pasta_id,
                "origem_pasta_nome": pastas[pasta_id],
                "titulo": titulo[:200],
                "numero_parcial": numero_parcial,
                "motivo": str(aviso.get("motivo") or "")[:300],
            }
        )

    return {
        "operacoes": validas,
        "descartadas": len(rejeitadas),
        "processos_sugeridos": processos_sugeridos,
        "avisos_processos": avisos_processos,
    }


def aplicar_organizacao(
    usuario, cliente, operacoes: list[dict], processos: list[dict] | None = None
) -> dict:
    """Execute a human-approved batch of organization operations.

    Re-validates every operation against a fresh scan of the client's tree
    before any write, then executes ``create_folder`` first (resolving refs),
    then ``move``, then ``rename``. Individual Drive failures don't abort the
    batch; they are reported per item.

    ``processos`` are approved rows from :func:`sugerir_organizacao`'s
    ``processos_sugeridos`` (same heuristic as the import wizard); they are
    persisted via :func:`confirmar_importacao`, which is idempotent on
    ``(cliente, numero_processo)``.
    """
    if not isinstance(operacoes, list):
        raise OrganizacaoInvalida("'operacoes' deve ser uma lista.")
    if len(operacoes) > settings.DRIVE_AI_MAX_OPERACOES:
        raise OrganizacaoInvalida(
            f"Máximo de {settings.DRIVE_AI_MAX_OPERACOES} operações por vez."
        )
    if processos is not None and not isinstance(processos, list):
        raise OrganizacaoInvalida("'processos' deve ser uma lista.")

    raiz_id, arvore = _arvore_do_cliente(usuario, cliente)
    pastas, arquivos, pai_de = _indexar_arvore(arvore)
    validas, rejeitadas = _validar_operacoes(
        operacoes, pastas, arquivos, pai_de, raiz_id
    )

    service = drive_service(usuario)
    aplicadas = 0
    falhas: list[dict] = []
    pastas_criadas: dict[str, str] = {}

    ordem = {"create_folder": 0, "move": 1, "rename": 2}
    for op in sorted(validas, key=lambda item: ordem[item["tipo"]]):
        try:
            if op["tipo"] == "create_folder":
                criada = drive.create_folder(service, op["nome"], op["pai_id"])
                pastas_criadas[op["ref"]] = criada["id"]
            elif op["tipo"] == "move":
                destino = op["destino_id"] or pastas_criadas.get(op["destino_ref"])
                if not destino:
                    falhas.append(
                        {"operacao": op, "erro": "Pasta de destino não foi criada."}
                    )
                    continue
                drive.move_file(
                    service, op["arquivo_id"], destino, pai_de.get(op["arquivo_id"])
                )
                DocumentoCliente.objects.filter(
                    drive_file_id=op["arquivo_id"]
                ).update(drive_folder_id=destino)
            else:  # rename
                drive.rename_file(service, op["arquivo_id"], op["novo_nome"])
                DocumentoCliente.objects.filter(
                    drive_file_id=op["arquivo_id"]
                ).update(nome=op["novo_nome"][:255])
            aplicadas += 1
        except GoogleApiError as exc:
            logger.warning(
                "Operação de organização falhou para o cliente %s: %s",
                cliente.pk,
                exc,
            )
            falhas.append({"operacao": op, "erro": str(exc)})

    processos_criados = 0
    if processos:
        resultado_processos = confirmar_importacao(cliente, processos, [])
        processos_criados = len(resultado_processos["processos"])

    return {
        "aplicadas": aplicadas,
        "falhas": falhas,
        "rejeitadas": rejeitadas,
        "pastas_criadas": pastas_criadas,
        "processos_criados": processos_criados,
    }
