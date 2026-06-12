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

# Fixed folders of the client document template (the per-process folders are
# created from the client's processos; see ``ensure_client_template``).
TEMPLATE_FOLDERS = (
    "1. DOCUMENTOS PESSOAIS",
    "2. CONTRATOS E PROCURAÇÕES",
    "5. OUTROS",
)

# Subfolders created under each process folder.
PROCESSO_SUBPASTAS = ("PETIÇÕES", "PROTOCOLADOS", "RECURSOS")


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


# --- Folder explorer (Drive-live; no DB mirror of the folder tree) -----------


def _nome_pasta_processo(processo) -> str:
    """Folder name for a process: ``"<area juridica> - <numero>"``."""
    area = (processo.area_juridica or "").strip()
    numero = (processo.numero_processo or "").strip()
    if area and numero:
        return f"{area} - {numero}"
    return area or numero or f"Processo {processo.pk}"


def _client_root_id(cliente) -> str:
    """Return the cached Drive id of the client's root folder, or ``""``."""
    registro = ClienteDrive.objects.filter(cliente=cliente).first()
    return registro.pasta_cliente_id if registro else ""


def _ensure_cliente_root(usuario, cliente):
    """Find-or-create the client's root folder; cache its id in ClienteDrive.

    Returns ``(service, pasta_cliente_id)``. Reuses an existing ``ClienteDrive``
    row (including legacy rows created by ``ensure_client_drive_structure``) so
    old and new folder layouts share the same client root.
    """
    service = drive_service(usuario)
    registro = ClienteDrive.objects.filter(cliente=cliente).first()
    if registro and registro.pasta_cliente_id:
        return service, registro.pasta_cliente_id

    root_id = _root_folder_id()
    pasta_cliente_id = drive.ensure_folder(service, cliente.nome, root_id)
    if registro:
        registro.pasta_cliente_id = pasta_cliente_id
        registro.save(update_fields=["pasta_cliente_id"])
    else:
        ClienteDrive.objects.create(
            cliente=cliente,
            pasta_cliente_id=pasta_cliente_id,
            pasta_peticoes_id="",
            pasta_documentos_id="",
            pasta_outros_id="",
        )
    return service, pasta_cliente_id


def ensure_client_template(usuario, cliente) -> str:
    """Idempotently ensure the client's folder template exists; return its root id.

    Creates the fixed template folders plus one folder per process (with the
    PETIÇÕES/PROTOCOLADOS/RECURSOS subfolders). Safe to call repeatedly: each
    folder is find-or-created. Pre-existing folders (e.g. the legacy
    Petições/Documentos/Outros) are left untouched.
    """
    # Imported here to avoid a hard module-load dependency on the processos app.
    from processos.models import Processo

    service, pasta_cliente_id = _ensure_cliente_root(usuario, cliente)

    for nome in TEMPLATE_FOLDERS:
        drive.ensure_folder(service, nome, pasta_cliente_id)

    for processo in Processo.objects.filter(cliente=cliente):
        pasta_processo_id = drive.ensure_folder(
            service, _nome_pasta_processo(processo), pasta_cliente_id
        )
        for subpasta in PROCESSO_SUBPASTAS:
            drive.ensure_folder(service, subpasta, pasta_processo_id)

    return pasta_cliente_id


def listar_conteudo_pasta(usuario, cliente, folder_id: str | None = None) -> dict:
    """List subfolders and files of ``folder_id`` (client root when omitted).

    On a root listing the client template is ensured first, so opening a
    client's documents materializes the folder structure on demand.
    """
    if folder_id:
        raiz_id = _client_root_id(cliente)
        service = drive_service(usuario)
    else:
        raiz_id = ensure_client_template(usuario, cliente)
        folder_id = raiz_id
        service = drive_service(usuario)

    return {
        "folder_id": folder_id,
        "raiz_id": raiz_id,
        "pastas": drive.list_folders(service, folder_id),
        "arquivos": drive.list_files(service, folder_id),
    }


def criar_pasta(usuario, *, nome: str, parent_id: str) -> dict:
    """Create a subfolder ``nome`` under ``parent_id`` and return its metadata."""
    service = drive_service(usuario)
    return drive.create_folder(service, nome, parent_id)


def excluir_pasta(usuario, folder_id: str) -> None:
    """Delete folder ``folder_id`` (and its contents) from Drive."""
    service = drive_service(usuario)
    drive.delete_folder(service, folder_id)


def upload_para_pasta(
    usuario, *, folder_id: str, nome: str, content: bytes, mime_type: str
) -> dict:
    """Upload a file into an arbitrary Drive folder and return its metadata.

    Unlike :func:`upload_documento`, this does not mirror the file in the
    ``DocumentoCliente`` table — the folder explorer reads from Drive directly.
    """
    service = drive_service(usuario)
    return drive.upload_file(service, nome, folder_id, content, mime_type)
