"""Business layer for storing meeting recordings on Google Drive.

Mirrors the pattern of :mod:`documentos.services`: talks to Drive exclusively
through :mod:`integrations.google.drive` and never imports the Drive SDK.

Upload flow (Vercel functions cap request bodies at ~4.5 MB, so the audio
never passes through the backend):

1. ``criar_sessao_upload`` opens a Drive resumable session with the uploader's
   OAuth token and returns the session URL to the browser.
2. The browser PUTs the blob straight to Google (no Authorization header).
3. ``confirmar_upload`` verifies the resulting file (parent folder + size) and
   creates the :class:`~meetings.models.Gravacao` row pointing at it.

Drive layout::

    <root>/<Nome do Cliente>/Reuniões      (reuniao com cliente)
    <root>/Reuniões avulsas                (reuniao sem cliente)
"""

from __future__ import annotations

import logging

from django.conf import settings

from integrations.google import drive
from integrations.google.client import credentials_for_usuario, drive_service
from integrations.google.exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)

from .audio import max_audio_bytes
from .models import Gravacao

logger = logging.getLogger(__name__)

PASTA_REUNIOES = "Reuniões"
PASTA_REUNIOES_AVULSAS = "Reuniões avulsas"


def _root_folder_id() -> str:
    root = getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not root:
        raise GoogleConfigurationError("GOOGLE_DRIVE_ROOT_FOLDER_ID nao configurado.")
    return root


def pasta_gravacoes_reuniao(usuario, reuniao) -> str:
    """Return (creating if needed) the Drive folder id for the meeting's audio."""
    service = drive_service(usuario)
    root_id = _root_folder_id()

    if reuniao.cliente is not None:
        pasta_cliente_id = drive.ensure_folder(service, reuniao.cliente.nome, root_id)
        return drive.ensure_folder(service, PASTA_REUNIOES, pasta_cliente_id)
    return drive.ensure_folder(service, PASTA_REUNIOES_AVULSAS, root_id)


def criar_sessao_upload(
    usuario,
    reuniao,
    *,
    nome: str,
    mime_type: str,
    tamanho_bytes: int,
) -> dict[str, str]:
    """Open a resumable upload session for the browser; returns url + folder id."""
    pasta_id = pasta_gravacoes_reuniao(usuario, reuniao)
    upload_url = drive.create_resumable_upload_session(
        credentials_for_usuario(usuario),
        name=nome,
        parent_id=pasta_id,
        mime_type=mime_type,
        size_bytes=tamanho_bytes,
        origin=(getattr(settings, "FRONTEND_URL", "") or "").rstrip("/"),
    )
    return {"upload_url": upload_url, "pasta_id": pasta_id}


def confirmar_upload(
    usuario,
    reuniao,
    *,
    drive_file_id: str,
    nome_original: str,
    mime_type: str,
    ordem: int = 0,
) -> Gravacao:
    """Verify the uploaded Drive file and create the Gravacao row for it.

    Validates that the file really sits in the meeting's recordings folder
    (the browser only holds a session URL, but the id it reports back is
    checked against Drive) and that the final size respects the audio limit.
    """
    service = drive_service(usuario)
    meta = drive.get_file(service, drive_file_id)

    pasta_id = pasta_gravacoes_reuniao(usuario, reuniao)
    if pasta_id not in (meta.get("parents") or []):
        raise ValueError("O arquivo enviado nao esta na pasta de gravacoes da reuniao.")

    tamanho = int(meta.get("size") or 0)
    if tamanho <= 0 or tamanho > max_audio_bytes():
        excluir_arquivo_drive(usuario, drive_file_id)
        raise ValueError(
            f"O arquivo deve ter no maximo {settings.MEETINGS_MAX_AUDIO_SIZE_MB} MB."
        )

    return Gravacao.objects.create(
        reuniao=reuniao,
        drive_file_id=drive_file_id,
        enviada_por=usuario,
        nome_original=(nome_original or meta.get("name") or "gravacao")[:255],
        mime_type=mime_type or meta.get("mimeType") or "",
        tamanho_bytes=tamanho,
        ordem=ordem,
    )


def baixar_audio_drive(gravacao: Gravacao) -> bytes:
    """Download the recording bytes using the uploader's credentials.

    Raises :class:`GoogleAuthorizationRequired` when there is no usable token
    (uploader removed or Google account disconnected) so the caller can fail
    the recording with an actionable message.
    """
    if gravacao.enviada_por is None:
        raise GoogleAuthorizationRequired(
            "Gravacao sem usuario associado. Reenvie o audio."
        )
    service = drive_service(gravacao.enviada_por)
    return drive.download_file(service, gravacao.drive_file_id)


def excluir_arquivo_drive(usuario, drive_file_id: str) -> None:
    service = drive_service(usuario)
    drive.delete_file(service, drive_file_id)


def excluir_audio_drive(gravacao: Gravacao) -> None:
    """Best-effort removal of the recording's Drive file (logs and moves on)."""
    if not gravacao.drive_file_id or gravacao.enviada_por is None:
        if gravacao.drive_file_id:
            logger.warning(
                "Gravacao %s tem drive_file_id mas nenhum usuario associado; "
                "arquivo permanece no Drive.",
                gravacao.pk,
            )
        return
    try:
        excluir_arquivo_drive(gravacao.enviada_por, gravacao.drive_file_id)
    except (GoogleAuthorizationRequired, GoogleApiError, GoogleConfigurationError):
        logger.exception("Falha ao apagar arquivo Drive da gravacao %s.", gravacao.pk)
