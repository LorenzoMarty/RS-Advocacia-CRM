"""Business layer for storing meeting recordings on Google Drive.

Mirrors the pattern of :mod:`documentos.services`: talks to Drive exclusively
through :mod:`integrations.google.drive` and never imports the Drive SDK.

Upload flow (audio never passes through the backend — uploaded directly to Drive
by the browser for efficiency and to avoid server memory pressure):

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
from django.utils import timezone

from integrations.google import drive
from integrations.google.client import credentials_for_usuario, drive_service
from integrations.google.exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)

from .audio import max_audio_bytes
from .document import build_meeting_document_html, meeting_document_title
from .models import Gravacao, Reuniao

logger = logging.getLogger(__name__)

PASTA_REUNIOES = "Reuniões"
PASTA_REUNIOES_AVULSAS = "Reuniões avulsas"


def _root_folder_id() -> str:
    root = getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not root:
        raise GoogleConfigurationError("GOOGLE_DRIVE_ROOT_FOLDER_ID não configurado.")
    return root


def pasta_gravacoes_reuniao(usuario, reuniao) -> str:
    """Return (creating if needed) the Drive folder id for the meeting's audio."""
    service = drive_service(usuario)
    root_id = _root_folder_id()

    if reuniao.cliente is not None:
        pasta_cliente_id = drive.ensure_folder(service, reuniao.cliente.nome, root_id)
        return drive.ensure_folder(service, PASTA_REUNIOES, pasta_cliente_id)
    return drive.ensure_folder(service, PASTA_REUNIOES_AVULSAS, root_id)


def pasta_documento_reuniao(usuario, reuniao) -> str:
    """Folder id for the meeting document.

    For meetings with a client, delegates to :mod:`documentos.services` (owner of
    the client folder tree) so the "Reuniões" folder id is cached on
    ``ClienteDrive``. Resolves to the same Drive folder the audio uses.
    """
    if reuniao.cliente_id is not None:
        # Local import avoids a hard module-load dependency on the documentos app.
        from documentos.services import ensure_pasta_reunioes

        return ensure_pasta_reunioes(usuario, reuniao.cliente)
    return pasta_gravacoes_reuniao(usuario, reuniao)


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
        raise ValueError("O arquivo enviado não está na pasta de gravações da reunião.")

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


def transcricao_completa(reuniao) -> str:
    """Concatenate the segment transcripts in capture order."""
    partes = [
        gravacao.transcricao.strip()
        for gravacao in reuniao.gravacoes.order_by("ordem", "criada_em")
        if gravacao.transcricao and gravacao.transcricao.strip()
    ]
    return "\n\n".join(partes)


def salvar_reuniao_como_documento(usuario, reuniao) -> Reuniao:
    """Generate the meeting document (Google Doc) in the client's Reuniões folder.

    Stores the resulting Drive id/link on the meeting. Raises ``ValueError`` if
    the meeting has no textual content yet (no summary and no transcript).
    """
    resumo = (reuniao.resumo or "").strip()
    transcricao = transcricao_completa(reuniao)
    if not resumo and not transcricao:
        raise ValueError("Reunião sem conteúdo para gerar o documento.")

    pasta_id = pasta_documento_reuniao(usuario, reuniao)
    html = build_meeting_document_html(
        titulo=reuniao.titulo,
        cliente_nome=reuniao.cliente.nome if reuniao.cliente_id else "",
        data_reuniao=reuniao.data_reuniao,
        resumo=resumo,
        transcricao=transcricao,
    )
    service = drive_service(usuario)
    meta = drive.create_google_doc(
        service, meeting_document_title(reuniao), pasta_id, html
    )

    reuniao.documento_drive_id = meta.get("id", "") or ""
    reuniao.documento_link = meta.get("webViewLink", "") or ""
    reuniao.documento_gerado_em = timezone.now()
    reuniao.save(
        update_fields=[
            "documento_drive_id",
            "documento_link",
            "documento_gerado_em",
            "atualizado_em",
        ]
    )
    return reuniao


def _apagar_audios_reuniao(reuniao) -> int:
    """Delete the meeting's audio files from Drive and clear their references.

    Keeps the ``Gravacao`` rows (and their transcripts) — only the audio asset
    is removed. Returns how many files were deleted. Best-effort per file.
    """
    apagadas = 0
    for gravacao in reuniao.gravacoes.exclude(drive_file_id=""):
        excluir_audio_drive(gravacao)
        Gravacao.objects.filter(pk=gravacao.pk).update(
            drive_file_id="", tamanho_bytes=0
        )
        apagadas += 1
    return apagadas


def finalizar_reuniao(usuario, reuniao) -> dict:
    """Save the meeting document and, when enabled, delete the audio.

    The document is always (re)generated. Audio is only removed when
    ``MEETINGS_DELETE_AUDIO_AFTER_DOC`` is enabled AND the document was saved
    successfully — the guard the user validates before turning deletion on.
    """
    salvar_reuniao_como_documento(usuario, reuniao)

    audios_apagados = 0
    if (
        getattr(settings, "MEETINGS_DELETE_AUDIO_AFTER_DOC", False)
        and reuniao.documento_drive_id
    ):
        audios_apagados = _apagar_audios_reuniao(reuniao)

    return {
        "documento_drive_id": reuniao.documento_drive_id,
        "documento_link": reuniao.documento_link,
        "audios_apagados": audios_apagados,
    }
