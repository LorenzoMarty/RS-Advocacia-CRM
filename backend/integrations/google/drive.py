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
import json
import logging
import time as time_module
from typing import Any

from google.auth.transport.requests import AuthorizedSession
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

from integrations.google.exceptions import GoogleApiError

logger = logging.getLogger(__name__)

RESUMABLE_UPLOAD_URL = (
    "https://www.googleapis.com/upload/drive/v3/files"
    "?uploadType=resumable&supportsAllDrives=true"
)

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
                # Log the real Google reason (status + body); the message that
                # reaches the client is intentionally generic.
                detalhe = getattr(exc, "content", b"") or b""
                if isinstance(detalhe, bytes):
                    detalhe = detalhe.decode("utf-8", "replace")
                logger.warning(
                    "Drive API falhou (status=%s): %s | %s",
                    status,
                    error_message,
                    detalhe[:500],
                )
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


def list_folders(service, parent_id: str) -> list[dict[str, Any]]:
    """List non-trashed folders directly under ``parent_id`` (id and name)."""
    query = (
        f"'{_escape_query_value(parent_id)}' in parents "
        f"and mimeType = '{FOLDER_MIME_TYPE}' "
        f"and trashed = false"
    )
    folders: list[dict[str, Any]] = []
    page_token: str | None = None
    while True:
        response = _execute(
            lambda token=page_token: service.files().list(
                q=query,
                spaces="drive",
                fields="nextPageToken, files(id, name)",
                orderBy="name",
                pageSize=100,
                pageToken=token,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            ),
            "Nao foi possivel listar as pastas do Google Drive.",
        )
        folders.extend(response.get("files", []) if response else [])
        page_token = response.get("nextPageToken") if response else None
        if not page_token:
            break
    return folders


def delete_folder(service, folder_id: str) -> None:
    """Permanently delete folder ``folder_id`` and its contents (404 = success)."""
    try:
        _execute(
            lambda: service.files().delete(
                fileId=folder_id,
                supportsAllDrives=True,
            ),
            "Nao foi possivel excluir a pasta do Google Drive.",
        )
    except GoogleApiError as exc:
        cause = exc.__cause__
        status = getattr(getattr(cause, "resp", None), "status", None)
        if status != 404:
            raise


def get_file(service, file_id: str) -> dict[str, Any]:
    """Return metadata (``FILE_FIELDS``) of ``file_id``."""
    return _execute(
        lambda: service.files().get(
            fileId=file_id,
            fields=FILE_FIELDS,
            supportsAllDrives=True,
        ),
        "Nao foi possivel consultar o arquivo no Google Drive.",
    )


def delete_file(service, file_id: str) -> None:
    """Permanently delete ``file_id``; a missing file (404) counts as success."""
    try:
        _execute(
            lambda: service.files().delete(
                fileId=file_id,
                supportsAllDrives=True,
            ),
            "Nao foi possivel excluir o arquivo do Google Drive.",
        )
    except GoogleApiError as exc:
        cause = exc.__cause__
        status = getattr(getattr(cause, "resp", None), "status", None)
        if status != 404:
            raise


def create_resumable_upload_session(
    credentials,
    *,
    name: str,
    parent_id: str,
    mime_type: str,
    size_bytes: int,
    origin: str,
) -> str:
    """Open a resumable upload session and return its session URI.

    The browser then PUTs the bytes straight to Google (no Authorization
    header needed on the PUT). ``origin`` must match the page's origin so the
    CORS headers of the session allow the browser request. The file only
    exists in Drive after the upload completes.

    The googleapiclient SDK does not expose the session URI, so this is the
    one raw HTTP call of the module, authenticated via ``AuthorizedSession``
    (google-auth), which also refreshes the access token when needed.
    """
    session = AuthorizedSession(credentials)
    headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mime_type or "application/octet-stream",
        "X-Upload-Content-Length": str(size_bytes),
    }
    if origin:
        headers["Origin"] = origin
    body = {"name": name, "parents": [parent_id]}
    try:
        response = session.post(
            RESUMABLE_UPLOAD_URL,
            headers=headers,
            data=json.dumps(body),
            timeout=30,
        )
    except Exception as exc:
        raise GoogleApiError(
            "Nao foi possivel iniciar o upload para o Google Drive."
        ) from exc
    session_url = response.headers.get("Location", "")
    if response.status_code != 200 or not session_url:
        raise GoogleApiError("Nao foi possivel iniciar o upload para o Google Drive.")
    return session_url


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
