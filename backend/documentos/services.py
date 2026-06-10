"""Business layer for client document storage on Google Drive.

This module owns the per-client folder structure and the metadata mirror. It
talks to Drive exclusively through :mod:`integrations.google.drive` (the
integration layer) and never imports the Drive SDK directly, keeping business
rules separate from API plumbing.

Drive layout managed here::

    <root>/<Nome do Cliente>/Petições
                            /Documentos
                            /Outros
"""

from __future__ import annotations

from django.conf import settings

from integrations.google import drive
from integrations.google.client import drive_service
from integrations.google.exceptions import GoogleConfigurationError

from .models import ClienteDrive, DocumentoCliente

# Subfolders created under every client folder, in display order.
SUBPASTAS = ("Petições", "Documentos", "Outros")


def _root_folder_id() -> str:
    root = getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not root:
        raise GoogleConfigurationError("GOOGLE_DRIVE_ROOT_FOLDER_ID nao configurado.")
    return root


def _validar_categoria(categoria: str) -> str:
    if categoria not in DocumentoCliente.CATEGORIA_SUBPASTA:
        raise ValueError("Categoria de documento invalida.")
    return categoria


def ensure_client_drive_structure(usuario, cliente) -> ClienteDrive:
    """Guarantee the client's Drive folder tree exists; return cached ids.

    Idempotent: reuses a stored :class:`ClienteDrive` when present, otherwise
    find-or-creates each folder under the configured root and persists the ids.
    Stability is keyed on ``cliente.pk`` so clients sharing a name keep distinct
    rows even though their Drive folders share a display name.
    """
    existing = ClienteDrive.objects.filter(cliente=cliente).first()
    if existing:
        return existing

    service = drive_service(usuario)
    root_id = _root_folder_id()

    pasta_cliente_id = drive.ensure_folder(service, cliente.nome, root_id)
    pasta_peticoes_id = drive.ensure_folder(service, "Petições", pasta_cliente_id)
    pasta_documentos_id = drive.ensure_folder(service, "Documentos", pasta_cliente_id)
    pasta_outros_id = drive.ensure_folder(service, "Outros", pasta_cliente_id)

    return ClienteDrive.objects.create(
        cliente=cliente,
        pasta_cliente_id=pasta_cliente_id,
        pasta_peticoes_id=pasta_peticoes_id,
        pasta_documentos_id=pasta_documentos_id,
        pasta_outros_id=pasta_outros_id,
    )


def upload_documento(
    usuario,
    cliente,
    *,
    categoria: str,
    nome: str,
    content: bytes,
    mime_type: str,
) -> DocumentoCliente:
    """Upload a file into the client's category folder and mirror its metadata.

    Duplicate policy: when a document with the same ``(cliente, categoria, nome)``
    already exists, its Drive content is replaced via ``files.update`` (new
    revision, same ``drive_file_id``); otherwise a new file and row are created.
    """
    _validar_categoria(categoria)
    estrutura = ensure_client_drive_structure(usuario, cliente)
    pasta_id = estrutura.pasta_para_categoria(categoria)
    service = drive_service(usuario)

    existente = DocumentoCliente.objects.filter(
        cliente=cliente, categoria=categoria, nome=nome
    ).first()

    if existente:
        meta = drive.update_file(service, existente.drive_file_id, content, mime_type)
        existente.mime_type = mime_type
        existente.tamanho_bytes = len(content)
        existente.drive_folder_id = pasta_id
        existente.link_visualizacao = meta.get("webViewLink", "") or ""
        existente.save()
        return existente

    meta = drive.upload_file(service, nome, pasta_id, content, mime_type)
    return DocumentoCliente.objects.create(
        cliente=cliente,
        categoria=categoria,
        nome=nome,
        mime_type=mime_type,
        tamanho_bytes=len(content),
        drive_file_id=meta["id"],
        drive_folder_id=pasta_id,
        link_visualizacao=meta.get("webViewLink", "") or "",
    )


def listar_documentos(cliente, *, categoria: str | None = None):
    """Return the client's documents from the DB (no Drive round-trip)."""
    queryset = DocumentoCliente.objects.filter(cliente=cliente)
    if categoria is not None:
        _validar_categoria(categoria)
        queryset = queryset.filter(categoria=categoria)
    return list(queryset)


def list_client_files(cliente):
    return listar_documentos(cliente)


def list_client_petitions(cliente):
    return listar_documentos(cliente, categoria=DocumentoCliente.CATEGORIA_PETICAO)


def list_client_documents(cliente):
    return listar_documentos(cliente, categoria=DocumentoCliente.CATEGORIA_DOCUMENTO)


def baixar_documento(usuario, documento: DocumentoCliente) -> bytes:
    """Download the raw bytes of a stored document from Drive."""
    service = drive_service(usuario)
    return drive.download_file(service, documento.drive_file_id)
