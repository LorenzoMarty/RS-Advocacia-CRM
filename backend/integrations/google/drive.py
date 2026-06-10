"""Low-level Google Drive API wrapper.

This module knows how to talk to the Drive v3 API and nothing about the
business domain (clients, petitions, documents). Every function receives a
prebuilt ``service`` object (see :func:`integrations.google.client.drive_service`)
so the layer is trivial to unit test with a mock service.

Higher-level orchestration (per-client folder structure, metadata persistence)
lives in the ``documentos`` app and must call into this module rather than the
Drive SDK directly.
"""

from __future__ import annotations

import io
import time as time_module
from typing import Any

from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

from integrations.google.exceptions import GoogleApiError

FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"

# Fields requested when listing/returning files so callers get stable metadata.
FILE_FIELDS = (
    "id, name, mimeType, webViewLink, createdTime, modifiedTime, size, parents"
)

RETRYABLE_STATUSES = {429, 500, 502, 503, 504}


def _execute(factory, error_message: str):
    """Run a Drive request with bounded retries on transient failures."""
    for attempt in range(3):
        try:
            return factory().execute()
        except HttpError as exc:
            status = getattr(exc.resp, "status", None)
            if status not in RETRYABLE_STATUSES or attempt == 2:
                raise GoogleApiError(error_message) from exc
            time_module.sleep(0.35 * (attempt + 1))


def _escape_query_value(value: str) -> str:
    """Escape a literal for use inside a Drive ``q`` string."""
    return value.replace("\\", "\\\\").replace("'", "\\'")


def find_folder(service, name: str, parent_id: str) -> str | None:
    """Return the id of a non-trashed folder named ``name`` under ``parent_id``."""
    query = (
        f"mimeType = '{FOLDER_MIME_TYPE}' "
        f"and name = '{_escape_query_value(name)}' "
        f"and '{_escape_query_value(parent_id)}' in parents "
        f"and trashed = false"
    )
    response = _execute(
        lambda: service.files().list(
            q=query,
            spaces="drive",
            fields="files(id, name)",
            pageSize=1,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
        ),
        "Nao foi possivel localizar a pasta no Google Drive.",
    )
    files = response.get("files", []) if response else []
    return files[0]["id"] if files else None


def create_folder(service, name: str, parent_id: str) -> dict[str, Any]:
    """Create a folder named ``name`` under ``parent_id`` and return its metadata."""
    body = {
        "name": name,
        "mimeType": FOLDER_MIME_TYPE,
        "parents": [parent_id],
    }
    return _execute(
        lambda: service.files().create(
            body=body,
            fields="id, name, parents",
            supportsAllDrives=True,
        ),
        "Nao foi possivel criar a pasta no Google Drive.",
    )


def ensure_folder(service, name: str, parent_id: str) -> str:
    """Return the id of folder ``name`` under ``parent_id``, creating it if absent."""
    existing = find_folder(service, name, parent_id)
    if existing:
        return existing
    return create_folder(service, name, parent_id)["id"]


def upload_file(
    service,
    name: str,
    parent_id: str,
    content: bytes,
    mime_type: str,
) -> dict[str, Any]:
    """Upload ``content`` as a new file ``name`` under ``parent_id``."""
    media = MediaIoBaseUpload(
        io.BytesIO(content),
        mimetype=mime_type or "application/octet-stream",
        resumable=False,
    )
    body = {"name": name, "parents": [parent_id]}
    return _execute(
        lambda: service.files().create(
            body=body,
            media_body=media,
            fields=FILE_FIELDS,
            supportsAllDrives=True,
        ),
        "Nao foi possivel enviar o arquivo para o Google Drive.",
    )


def update_file(
    service,
    file_id: str,
    content: bytes,
    mime_type: str,
) -> dict[str, Any]:
    """Replace the content of ``file_id`` with ``content`` (creates a new revision)."""
    media = MediaIoBaseUpload(
        io.BytesIO(content),
        mimetype=mime_type or "application/octet-stream",
        resumable=False,
    )
    return _execute(
        lambda: service.files().update(
            fileId=file_id,
            media_body=media,
            fields=FILE_FIELDS,
            supportsAllDrives=True,
        ),
        "Nao foi possivel atualizar o arquivo no Google Drive.",
    )


def list_files(service, parent_id: str) -> list[dict[str, Any]]:
    """List non-trashed, non-folder files directly under ``parent_id``."""
    query = (
        f"'{_escape_query_value(parent_id)}' in parents "
        f"and mimeType != '{FOLDER_MIME_TYPE}' "
        f"and trashed = false"
    )
    files: list[dict[str, Any]] = []
    page_token: str | None = None
    while True:
        response = _execute(
            lambda token=page_token: service.files().list(
                q=query,
                spaces="drive",
                fields=f"nextPageToken, files({FILE_FIELDS})",
                pageSize=100,
                pageToken=token,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            ),
            "Nao foi possivel listar os arquivos do Google Drive.",
        )
        files.extend(response.get("files", []) if response else [])
        page_token = response.get("nextPageToken") if response else None
        if not page_token:
            break
    return files


def download_file(service, file_id: str) -> bytes:
    """Download and return the raw bytes of ``file_id``."""
    try:
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _status, done = downloader.next_chunk()
        return buffer.getvalue()
    except HttpError as exc:
        raise GoogleApiError(
            "Nao foi possivel baixar o arquivo do Google Drive."
        ) from exc
