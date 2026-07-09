"""Periodic Drive sync: react to whatever changed since the last run.

Complements the on-demand bulk import (:mod:`documentos.importacao`, run once
per historical folder with human review) with a task that polls the Drive
changes feed and reacts automatically — Drive is the source of truth, so
nothing here waits for a human:

- a new top-level folder under the "Clientes" root becomes a new client;
- a change inside a folder the CRM already owns (a client's or a processo's
  linked folder) re-runs the deterministic scan for that folder;
- a folder that gets trashed in Drive marks the matching client/processo
  inactive rather than deleting it — a Drive-side trash action shouldn't
  destroy CRM history unattended.
"""

from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

from integrations.google import drive
from integrations.google.client import drive_service
from integrations.google.exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)
from integrations.models import GoogleAccount, GoogleDriveSync

from . import importacao, services
from .models import ClienteDrive, DocumentoCliente, ProcessoDrive

logger = logging.getLogger(__name__)

_ERROS_GOOGLE = (GoogleConfigurationError, GoogleAuthorizationRequired, GoogleApiError)


@shared_task(name="documentos.sincronizar_drive")
def sincronizar_drive() -> dict:
    """Run one Drive-changes pass for every connected Google account.

    Best-effort per account: one account's failure (revoked token, API
    outage, misconfigured root folder) is logged and skipped rather than
    aborting the whole run.
    """
    resumo = {
        "contas_sincronizadas": 0,
        "clientes_criados": 0,
        "processos_criados": 0,
        "documentos_criados": 0,
        "inativados": 0,
    }

    for account in GoogleAccount.objects.filter(revoked_at__isnull=True):
        try:
            parcial = _sincronizar_conta(account)
        except _ERROS_GOOGLE as exc:
            logger.warning(
                "sincronizar_drive: falha ao sincronizar conta %s: %s",
                account.email,
                exc,
            )
            continue

        resumo["contas_sincronizadas"] += 1
        for chave in (
            "clientes_criados",
            "processos_criados",
            "documentos_criados",
            "inativados",
        ):
            resumo[chave] += parcial.get(chave, 0)

    return resumo


def _sincronizar_conta(account: GoogleAccount) -> dict:
    usuario = account.usuario
    service = drive_service(usuario)
    estado, _ = GoogleDriveSync.objects.get_or_create(account=account)

    if not estado.start_page_token:
        # First run for this account: just establish the baseline cursor.
        # Historical folders are handled by the reviewed bulk import
        # (documentos.importacao), not replayed here as Drive "changes".
        estado.start_page_token = drive.get_start_page_token(service)
        estado.last_synced_at = timezone.now()
        estado.save(update_fields=["start_page_token", "last_synced_at"])
        return {}

    resultado = drive.list_changes(service, estado.start_page_token)
    contadores = _processar_mudancas(usuario, resultado["changes"])

    estado.start_page_token = resultado["new_start_page_token"]
    estado.last_synced_at = timezone.now()
    estado.save(update_fields=["start_page_token", "last_synced_at"])
    return contadores


def _processar_mudancas(usuario, changes: list[dict]) -> dict:
    contadores = {
        "clientes_criados": 0,
        "processos_criados": 0,
        "documentos_criados": 0,
        "inativados": 0,
    }
    root_id = services._root_folder_id()

    for change in changes:
        file_id = change.get("fileId")
        arquivo = change.get("file")

        if change.get("removed") or (arquivo and arquivo.get("trashed")):
            contadores["inativados"] += _inativar(file_id)
            continue

        if not arquivo:
            continue

        pais = arquivo.get("parents") or []
        is_folder = arquivo.get("mimeType") == drive.FOLDER_MIME_TYPE

        if is_folder and root_id in pais:
            criados = importacao.criar_clientes_a_partir_de_pastas(
                usuario, [{"pasta_id": file_id, "nome": arquivo.get("name", "")}]
            )
            contadores["clientes_criados"] += len(criados)
            continue

        # Not a new top-level client folder: only react if it landed inside a
        # folder the CRM already owns (client or processo), one hop up.
        for pasta_pai in pais:
            resultado = importacao.sincronizar_pasta_conhecida(usuario, pasta_pai)
            if resultado is not None:
                contadores["processos_criados"] += len(resultado["processos"])
                contadores["documentos_criados"] += len(resultado["documentos"])
                break

    return contadores


@shared_task(
    bind=True,
    ignore_result=True,
    autoretry_for=_ERROS_GOOGLE,
    retry_backoff=True,
    retry_backoff_max=120,
    max_retries=3,
)
def renomear_pasta_cliente(self, cliente_id, usuario_id, novo_nome: str) -> None:
    """Best-effort Drive rename for a client's folder, off the request path."""
    from clientes.models import Cliente
    from usuarios.models import Usuario

    try:
        cliente = Cliente.objects.get(pk=cliente_id)
    except Cliente.DoesNotExist:
        return

    usuario = Usuario.objects.filter(pk=usuario_id).first() if usuario_id else None
    if usuario is None:
        return

    try:
        services.renomear_pasta_cliente(usuario, cliente, novo_nome)
    except GoogleAuthorizationRequired:
        logger.info(
            "Renomear pasta do cliente %s pulado: usuario %s sem conta Google conectada.",
            cliente_id,
            usuario_id,
        )


@shared_task(
    bind=True,
    ignore_result=True,
    autoretry_for=_ERROS_GOOGLE,
    retry_backoff=True,
    retry_backoff_max=120,
    max_retries=3,
)
def renomear_pasta_processo(self, processo_id, usuario_id, nome_antigo: str) -> None:
    """Best-effort Drive rename for a processo's folder, off the request path."""
    from processos.models import Processo
    from usuarios.models import Usuario

    try:
        processo = Processo.objects.get(pk=processo_id)
    except Processo.DoesNotExist:
        return

    usuario = Usuario.objects.filter(pk=usuario_id).first() if usuario_id else None
    if usuario is None:
        return

    try:
        services.renomear_pasta_processo(usuario, processo, nome_antigo)
    except GoogleAuthorizationRequired:
        logger.info(
            "Renomear pasta do processo %s pulado: usuario %s sem conta Google conectada.",
            processo_id,
            usuario_id,
        )


def _inativar(file_id: str | None) -> int:
    if not file_id:
        return 0

    cliente_drive = (
        ClienteDrive.objects.filter(pasta_cliente_id=file_id)
        .select_related("cliente")
        .first()
    )
    if cliente_drive:
        cliente_drive.cliente.ativo = False
        cliente_drive.cliente.save(update_fields=["ativo"])
        return 1

    processo_drive = (
        ProcessoDrive.objects.filter(pasta_id=file_id)
        .select_related("processo")
        .first()
    )
    if processo_drive:
        processo_drive.processo.status = "Inativo (pasta removida do Drive)"
        processo_drive.processo.save(update_fields=["status"])
        return 1

    # Not a tracked folder: might be a document mirror instead.
    DocumentoCliente.objects.filter(drive_file_id=file_id).delete()
    return 0
