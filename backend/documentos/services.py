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

from .models import ClienteDrive, DocumentoCliente, PastaGerenciada

# Subfolders created under every client folder, in display order.
SUBPASTAS = ("Petições", "Documentos", "Outros")

# Fixed folders of the client document template (the per-process folders are
# created from the client's processos; see ``ensure_client_template``).
TEMPLATE_FOLDERS = (
    "1. DOCUMENTOS PESSOAIS",
    "2. CONTRATOS E PROCURAÇÕES",
)

# Subfolders created under each process folder.
PROCESSO_SUBPASTAS = ("PETIÇÕES", "PROTOCOLADOS", "RECURSOS")


def _root_folder_id() -> str:
    root = getattr(settings, "GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not root:
        raise GoogleConfigurationError("GOOGLE_DRIVE_ROOT_FOLDER_ID não configurado.")
    return root


def _validar_categoria(categoria: str) -> str:
    if categoria not in DocumentoCliente.CATEGORIA_SUBPASTA:
        raise ValueError("Categoria de documento inválida.")
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


def ensure_pasta_reunioes(usuario, cliente) -> str:
    """Find-or-create the client's "Reuniões" folder; cache and return its id.

    Idempotent. The folder holds both meeting audio and the generated meeting
    documents. Owned here (documentos is the owner of the client folder tree);
    meetings calls this instead of recreating the folder logic.
    """
    registro = ClienteDrive.objects.filter(cliente=cliente).first()
    if registro and registro.pasta_reunioes_id:
        return registro.pasta_reunioes_id

    service, pasta_cliente_id = _ensure_cliente_root(usuario, cliente)
    pasta_reunioes_id = drive.ensure_folder(service, "Reuniões", pasta_cliente_id)

    registro = ClienteDrive.objects.filter(cliente=cliente).first()
    if registro:
        registro.pasta_reunioes_id = pasta_reunioes_id
        registro.save(update_fields=["pasta_reunioes_id"])
    return pasta_reunioes_id


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


def _nome_numerado(ordem: int, nome_base: str) -> str:
    """Display name of a managed folder: ``"<ordem>. <nome_base>"``."""
    return f"{ordem}. {nome_base}"


def pastas_gerenciadas_ids(parent_id: str) -> set[str]:
    """Drive ids of managed (auto-numbered) folders under ``parent_id``."""
    return set(
        PastaGerenciada.objects.filter(parent_drive_id=parent_id).values_list(
            "drive_folder_id", flat=True
        )
    )


def criar_pasta(usuario, cliente, *, nome: str, parent_id: str) -> dict:
    """Create an auto-numbered subfolder under ``parent_id``; track it.

    The next number is one past the count of managed siblings, so the sequence
    is gap-free. Returns the Drive metadata (its ``name`` already carries the
    number prefix).
    """
    service = drive_service(usuario)
    ordem = PastaGerenciada.objects.filter(parent_drive_id=parent_id).count() + 1
    meta = drive.create_folder(service, _nome_numerado(ordem, nome), parent_id)
    PastaGerenciada.objects.create(
        cliente=cliente,
        parent_drive_id=parent_id,
        drive_folder_id=meta["id"],
        ordem=ordem,
        nome_base=nome,
    )
    return meta


def renomear_pasta(usuario, cliente, folder_id: str, novo_nome: str) -> dict:
    """Rename a managed folder, keeping its number; return Drive metadata."""
    registro = PastaGerenciada.objects.filter(
        cliente=cliente, drive_folder_id=folder_id
    ).first()
    if registro is None:
        raise ValueError("Apenas pastas criadas por você podem ser renomeadas.")
    registro.nome_base = novo_nome
    registro.save(update_fields=["nome_base"])
    service = drive_service(usuario)
    return drive.rename_file(
        service, folder_id, _nome_numerado(registro.ordem, novo_nome)
    )


def excluir_pasta(usuario, cliente, folder_id: str) -> None:
    """Delete ``folder_id`` from Drive; renumber managed siblings to close the gap.

    Works for both managed and structural folders: structural folders are simply
    deleted (no row to renumber).
    """
    service = drive_service(usuario)
    drive.delete_folder(service, folder_id)

    registro = PastaGerenciada.objects.filter(
        cliente=cliente, drive_folder_id=folder_id
    ).first()
    if registro is None:
        return

    parent_id = registro.parent_drive_id
    ordem_removida = registro.ordem
    registro.delete()

    posteriores = PastaGerenciada.objects.filter(
        parent_drive_id=parent_id, ordem__gt=ordem_removida
    ).order_by("ordem")
    for irmao in posteriores:
        irmao.ordem -= 1
        irmao.save(update_fields=["ordem"])
        drive.rename_file(
            service, irmao.drive_folder_id, _nome_numerado(irmao.ordem, irmao.nome_base)
        )


# --- Documento de entidade (petições/prazos): 1 ref de Doc por entidade -------

# Corpo HTML mínimo de um Doc em branco (Drive converte para Google Doc).
EMPTY_DOC_HTML = "<p></p>"


def pasta_peticoes_cliente(usuario, cliente) -> str:
    """Return the id of the client's "Petições" folder (creating the tree if needed)."""
    estrutura = ensure_client_drive_structure(usuario, cliente)
    return estrutura.pasta_peticoes_id


def pasta_processo_id(usuario, processo) -> str:
    """Find-or-create the Drive folder of ``processo`` under its client; return id."""
    service, pasta_cliente_id = _ensure_cliente_root(usuario, processo.cliente)
    return drive.ensure_folder(
        service, _nome_pasta_processo(processo), pasta_cliente_id
    )


def pasta_peticoes_processo(usuario, processo) -> str:
    """Return the id of the ``"PETIÇÕES"`` folder inside ``processo``'s Drive folder.

    Creates the process folder and the subfolder if needed.
    """
    pasta_processo = pasta_processo_id(usuario, processo)
    service = drive_service(usuario)
    return drive.ensure_folder(service, PROCESSO_SUBPASTAS[0], pasta_processo)


def mover_documento_peticao(usuario, *, file_id: str, processo) -> None:
    """Move a petition's Drive doc into ``processo``'s ``"PETIÇÕES"`` folder.

    No-op when the file is already there. Best-effort: the caller decides whether
    a Drive failure should abort the edit.
    """
    if not file_id:
        return
    destino = pasta_peticoes_processo(usuario, processo)
    service = drive_service(usuario)
    meta = drive.get_file(service, file_id)
    parents = meta.get("parents") or []
    if destino in parents:
        return
    old_parent = parents[0] if parents else ""
    drive.move_file(service, file_id, destino, old_parent)


def criar_documento_branco(usuario, *, parent_id: str, nome: str) -> dict:
    """Create a blank Google Doc named ``nome`` under ``parent_id``; return metadata."""
    service = drive_service(usuario)
    return drive.create_google_doc(service, nome, parent_id, EMPTY_DOC_HTML)


def excluir_arquivo(usuario, file_id: str) -> None:
    """Delete a Drive file by id (404 counts as success)."""
    service = drive_service(usuario)
    drive.delete_file(service, file_id)


def nome_pasta_processo(processo) -> str:
    """Public display name for a process Drive folder (``"<area> - <numero>"``)."""
    return _nome_pasta_processo(processo)


def renomear_pasta_cliente(usuario, cliente, novo_nome: str) -> None:
    """Rename the client's root Drive folder to ``novo_nome``.

    No-op when the client has no Drive folder yet. Best-effort: the caller
    decides whether a Drive failure should abort the edit.
    """
    registro = ClienteDrive.objects.filter(cliente=cliente).first()
    if not registro or not registro.pasta_cliente_id:
        return
    service = drive_service(usuario)
    drive.rename_file(service, registro.pasta_cliente_id, novo_nome)


def renomear_pasta_processo(usuario, processo, nome_antigo: str) -> None:
    """Rename the process Drive folder from ``nome_antigo`` to its current name.

    Locates the folder by its previous display name under the client root; no-op
    when the client has no Drive folder or the old folder is absent.
    """
    pasta_cliente_id = _client_root_id(processo.cliente)
    if not pasta_cliente_id:
        return
    service = drive_service(usuario)
    novo_nome = _nome_pasta_processo(processo)
    if novo_nome == nome_antigo:
        return
    for pasta in drive.list_folders(service, pasta_cliente_id):
        if pasta.get("name") == nome_antigo:
            drive.rename_file(service, pasta["id"], novo_nome)
            return


def upload_para_pasta(
    usuario, *, folder_id: str, nome: str, content: bytes, mime_type: str
) -> dict:
    """Upload a file into an arbitrary Drive folder and return its metadata.

    Unlike :func:`upload_documento`, this does not mirror the file in the
    ``DocumentoCliente`` table — the folder explorer reads from Drive directly.
    """
    service = drive_service(usuario)
    return drive.upload_file(service, nome, folder_id, content, mime_type)
