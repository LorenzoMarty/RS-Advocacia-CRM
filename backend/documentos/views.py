import logging
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from clientes.models import Cliente
from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from integrations.google.exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)
from integrations.google.oauth import current_usuario
from integrations.google.responses import mapear_erro_google as _mapear_erro_google

from . import importacao, services
from .forms import UploadDocumentoForm
from .models import DocumentoCliente, serialize_documento

logger = logging.getLogger(__name__)

# Allowlisted upload extensions (lawyer documents: petitions, ids, receipts...).
SUPPORTED_DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".odt",
    ".rtf",
    ".txt",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".xls",
    ".xlsx",
    ".csv",
}


@app_permissions_required("documentos.view_documentocliente", "clientes.view_cliente")
def listar_documentos_view(request, cliente_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    categoria = request.GET.get("categoria") or None
    try:
        documentos = services.listar_documentos(cliente, categoria=categoria)
    except ValueError as exc:
        return resposta_erro({"categoria": [str(exc)]}, status=400)

    return resposta_sucesso(
        {"documentos": [serialize_documento(doc) for doc in documentos]}
    )


@app_permissions_required("documentos.add_documentocliente", "clientes.view_cliente")
def upload_documento_view(request, cliente_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)

    form = UploadDocumentoForm(request.POST)
    if not form.is_valid():
        return resposta_erro(erros_formulario(form), status=400)

    arquivo = request.FILES.get("arquivo") or next(iter(request.FILES.values()), None)
    if arquivo is None:
        return resposta_erro({"arquivo": ["Envie um arquivo."]}, status=400)

    extension = Path(arquivo.name or "").suffix.lower()
    if extension not in SUPPORTED_DOCUMENT_EXTENSIONS:
        formatos = ", ".join(
            sorted(ext.removeprefix(".") for ext in SUPPORTED_DOCUMENT_EXTENSIONS)
        )
        return resposta_erro(
            {"arquivo": [f"Formato inválido. Use: {formatos}."]}, status=400
        )

    max_bytes = settings.DRIVE_MAX_FILE_SIZE_MB * 1024 * 1024
    if arquivo.size > max_bytes:
        return resposta_erro(
            {
                "arquivo": [
                    f"O arquivo deve ter no maximo {settings.DRIVE_MAX_FILE_SIZE_MB} MB."
                ]
            },
            status=400,
        )

    nome = (form.cleaned_data.get("nome") or arquivo.name or "arquivo")[:255]
    usuario = current_usuario(request)

    try:
        documento = services.upload_documento(
            usuario,
            cliente,
            categoria=form.cleaned_data["categoria"],
            nome=nome,
            content=arquivo.read(),
            mime_type=arquivo.content_type or "",
        )
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    return resposta_sucesso(
        {"documento": serialize_documento(documento)},
        mensagem="Documento enviado ao Google Drive.",
        status=201,
    )


@app_permissions_required("documentos.view_documentocliente", "clientes.view_cliente")
def estrutura_drive_view(request, cliente_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    usuario = current_usuario(request)
    try:
        estrutura = services.ensure_client_drive_structure(usuario, cliente)
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    return resposta_sucesso(
        {
            "estrutura": {
                "cliente": str(cliente.pk),
                "pasta_cliente_id": estrutura.pasta_cliente_id,
                "pasta_peticoes_id": estrutura.pasta_peticoes_id,
                "pasta_documentos_id": estrutura.pasta_documentos_id,
                "pasta_outros_id": estrutura.pasta_outros_id,
            }
        }
    )


# --- Folder explorer (Drive-live) -------------------------------------------


def _serialize_pasta(pasta: dict, gerenciadas: set[str] | None = None):
    folder_id = pasta.get("id", "")
    return {
        "id": folder_id,
        "nome": pasta.get("name", ""),
        # True only for user-created auto-numbered folders (renameable/renumbered).
        "gerenciada": bool(gerenciadas and folder_id in gerenciadas),
    }


def _serialize_arquivo(arquivo: dict):
    return {
        "id": arquivo.get("id", ""),
        "nome": arquivo.get("name", ""),
        "mime_type": arquivo.get("mimeType", ""),
        "link": arquivo.get("webViewLink", ""),
        "tamanho_bytes": int(arquivo.get("size") or 0),
        "modificado_em": arquivo.get("modifiedTime", ""),
    }


@app_permissions_required("documentos.view_documentocliente", "clientes.view_cliente")
def listar_drive_view(request, cliente_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    folder_id = request.GET.get("folder_id") or None
    usuario = current_usuario(request)
    try:
        conteudo = services.listar_conteudo_pasta(usuario, cliente, folder_id)
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    gerenciadas = services.pastas_gerenciadas_ids(conteudo["folder_id"])
    return resposta_sucesso(
        {
            "folder_id": conteudo["folder_id"],
            "raiz_id": conteudo["raiz_id"],
            "pastas": [_serialize_pasta(p, gerenciadas) for p in conteudo["pastas"]],
            "arquivos": [_serialize_arquivo(a) for a in conteudo["arquivos"]],
        }
    )


@app_permissions_required("documentos.add_documentocliente", "clientes.view_cliente")
def criar_pasta_view(request, cliente_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    nome = (payload.get("nome") or "").strip()[:255]
    parent_id = (payload.get("parent_id") or "").strip()
    if not nome:
        return resposta_erro({"nome": ["Informe o nome da pasta."]}, status=400)
    if not parent_id:
        return resposta_erro({"parent_id": ["Pasta de destino inválida."]}, status=400)

    usuario = current_usuario(request)
    try:
        pasta = services.criar_pasta(usuario, cliente, nome=nome, parent_id=parent_id)
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    return resposta_sucesso(
        {"pasta": _serialize_pasta(pasta, {pasta.get("id", "")})},
        mensagem="Pasta criada no Google Drive.",
        status=201,
    )


@app_permissions_required("documentos.change_documentocliente", "clientes.view_cliente")
def renomear_pasta_view(request, cliente_id, folder_id):
    cliente = get_object_or_404(Cliente, pk=cliente_id)
    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    novo_nome = (payload.get("nome") or "").strip()[:255]
    if not novo_nome:
        return resposta_erro({"nome": ["Informe o nome da pasta."]}, status=400)

    usuario = current_usuario(request)
    try:
        pasta = services.renomear_pasta(usuario, cliente, folder_id, novo_nome)
    except ValueError as exc:
        return resposta_erro({"folder_id": [str(exc)]}, status=400)
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    return resposta_sucesso(
        {"pasta": _serialize_pasta(pasta, {folder_id})},
        mensagem="Pasta renomeada no Google Drive.",
    )


@app_permissions_required("documentos.delete_documentocliente", "clientes.view_cliente")
def excluir_pasta_view(request, cliente_id, folder_id):
    cliente = get_object_or_404(Cliente, pk=cliente_id)
    # Guard: never let the explorer delete the client's root folder.
    if folder_id == services._client_root_id(cliente):
        return resposta_erro(
            {"folder_id": ["Não é possível excluir a pasta raiz do cliente."]},
            status=400,
        )

    usuario = current_usuario(request)
    try:
        services.excluir_pasta(usuario, cliente, folder_id)
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    return resposta_sucesso(
        {"id": folder_id}, mensagem="Pasta excluída do Google Drive."
    )


@app_permissions_required("clientes.view_cliente")
def gerenciar_pasta_view(request, cliente_id, folder_id):
    """Dispatch the folder item endpoint: PATCH renames, DELETE removes."""
    if request.method in {"PATCH", "PUT"}:
        return renomear_pasta_view(request, cliente_id, folder_id)
    if request.method == "DELETE":
        return excluir_pasta_view(request, cliente_id, folder_id)
    return metodo_nao_permitido(["PATCH", "DELETE"])


@app_permissions_required("documentos.add_documentocliente", "clientes.view_cliente")
def upload_drive_view(request, cliente_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    get_object_or_404(Cliente, pk=cliente_id)

    folder_id = (request.POST.get("folder_id") or "").strip()
    if not folder_id:
        return resposta_erro({"folder_id": ["Pasta de destino inválida."]}, status=400)

    arquivo = request.FILES.get("arquivo") or next(iter(request.FILES.values()), None)
    if arquivo is None:
        return resposta_erro({"arquivo": ["Envie um arquivo."]}, status=400)

    extension = Path(arquivo.name or "").suffix.lower()
    if extension not in SUPPORTED_DOCUMENT_EXTENSIONS:
        formatos = ", ".join(
            sorted(ext.removeprefix(".") for ext in SUPPORTED_DOCUMENT_EXTENSIONS)
        )
        return resposta_erro(
            {"arquivo": [f"Formato inválido. Use: {formatos}."]}, status=400
        )

    max_bytes = settings.DRIVE_MAX_FILE_SIZE_MB * 1024 * 1024
    if arquivo.size > max_bytes:
        return resposta_erro(
            {
                "arquivo": [
                    f"O arquivo deve ter no maximo {settings.DRIVE_MAX_FILE_SIZE_MB} MB."
                ]
            },
            status=400,
        )

    nome = (arquivo.name or "arquivo")[:255]
    usuario = current_usuario(request)
    try:
        arquivo_meta = services.upload_para_pasta(
            usuario,
            folder_id=folder_id,
            nome=nome,
            content=arquivo.read(),
            mime_type=arquivo.content_type or "",
        )
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    return resposta_sucesso(
        {"arquivo": _serialize_arquivo(arquivo_meta)},
        mensagem="Arquivo enviado ao Google Drive.",
        status=201,
    )


@app_permissions_required("documentos.view_documentocliente", "clientes.view_cliente")
def download_documento_view(request, cliente_id, doc_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    # Scoped to the client in the URL: prevents reading another client's document.
    documento = get_object_or_404(DocumentoCliente, pk=doc_id, cliente=cliente)

    usuario = current_usuario(request)
    try:
        content = services.baixar_documento(usuario, documento)
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    response = HttpResponse(
        content,
        content_type=documento.mime_type or "application/octet-stream",
    )
    response["Content-Disposition"] = f'attachment; filename="{documento.nome}"'
    return response


# --- Drive import wizard (scan existing folder -> suggest -> confirm) ------


@app_permissions_required("documentos.view_documentocliente", "clientes.view_cliente")
def escanear_importacao_view(request, cliente_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    try:
        corpo = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    folder_id = (corpo.get("folder_id") or "").strip() or services._client_root_id(
        cliente
    )
    if not folder_id:
        return resposta_erro(
            {"folder_id": ["Informe a pasta do Google Drive a escanear."]},
            status=400,
        )

    usuario = current_usuario(request)
    try:
        arvore = importacao.escanear_arvore(usuario, folder_id)
    except (
        GoogleConfigurationError,
        GoogleAuthorizationRequired,
        GoogleApiError,
    ) as exc:
        return _mapear_erro_google(exc)

    plano = importacao.sugerir_plano(arvore, cliente)
    return resposta_sucesso(plano)


@app_permissions_required(
    "documentos.add_documentocliente", "processos.add_processo", "clientes.view_cliente"
)
def confirmar_importacao_view(request, cliente_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    cliente = get_object_or_404(Cliente, pk=cliente_id)
    try:
        corpo = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    processos = corpo.get("processos") or []
    documentos = corpo.get("documentos") or []
    if not isinstance(processos, list) or not isinstance(documentos, list):
        return resposta_erro(
            {"corpo": ["'processos' e 'documentos' devem ser listas."]}, status=400
        )

    resultado = importacao.confirmar_importacao(cliente, processos, documentos)
    return resposta_sucesso(
        {
            "processos_criados": len(resultado["processos"]),
            "documentos_criados": len(resultado["documentos"]),
        },
        mensagem="Importação concluída.",
    )
