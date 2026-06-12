"""Shared audio-upload validation rules for meeting recordings.

Used both by the legacy multipart view (validates a real uploaded file) and by
the Drive resumable-session endpoints (validate the metadata the browser
declares before any byte is uploaded). Pure functions, no Django imports beyond
settings.
"""

from __future__ import annotations

import mimetypes
from pathlib import Path

from django.conf import settings

SUPPORTED_AUDIO_EXTENSIONS = {
    ".flac",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".m4a",
    ".ogg",
    ".wav",
    ".webm",
}
SUPPORTED_AUDIO_MIME_PREFIXES = ("audio/",)
SUPPORTED_AUDIO_MIME_TYPES = {
    "application/ogg",
    "video/mp4",
    "video/webm",
}
MIME_EXTENSION_FALLBACKS = {
    "audio/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "application/ogg": ".ogg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
}


def extensao_audio(nome: str, content_type: str = "") -> str:
    """Best-effort extension from the filename, falling back to the MIME type."""
    extension = Path(nome or "").suffix.lower()
    if extension:
        return extension

    content_type = (content_type or "").split(";")[0].lower()
    guessed = MIME_EXTENSION_FALLBACKS.get(content_type) or mimetypes.guess_extension(
        content_type
    )
    return (guessed or "").lower()


def mime_audio_suportado(content_type: str) -> bool:
    content_type = (content_type or "").split(";")[0].lower()
    return (
        content_type.startswith(SUPPORTED_AUDIO_MIME_PREFIXES)
        or content_type in SUPPORTED_AUDIO_MIME_TYPES
    )


def formatos_suportados() -> str:
    return ", ".join(
        sorted(ext.removeprefix(".") for ext in SUPPORTED_AUDIO_EXTENSIONS)
    )


def max_audio_bytes() -> int:
    return settings.MEETINGS_MAX_AUDIO_SIZE_MB * 1024 * 1024


def validar_audio_declarado(
    nome: str, content_type: str, tamanho_bytes: int
) -> dict[str, list[str]]:
    """Validate declared upload metadata; returns field errors (empty = ok)."""
    erros: dict[str, list[str]] = {}

    extension = extensao_audio(nome, content_type)
    if extension not in SUPPORTED_AUDIO_EXTENSIONS and not mime_audio_suportado(
        content_type
    ):
        erros["audio"] = [f"Formato inválido. Use: {formatos_suportados()}."]

    if tamanho_bytes <= 0:
        erros.setdefault("audio", []).append("Tamanho do arquivo inválido.")
    elif tamanho_bytes > max_audio_bytes():
        erros.setdefault("audio", []).append(
            f"O arquivo deve ter no máximo {settings.MEETINGS_MAX_AUDIO_SIZE_MB} MB."
        )

    return erros
