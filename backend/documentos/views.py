import logging
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from clientes.models import Cliente
from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
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

from . import services
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


def _mapear_erro_google(exc):
    """Translate Drive/auth exceptions into the JSON envelope (no stack leak)."""
    if isinstance(exc, GoogleConfigurationError):
        return resposta_erro(str(exc), status=503)
    if isinstance(exc, GoogleAuthorizationRequired):
        return resposta_erro(str(exc), status=401)
    if isinstance(exc, GoogleApiError):
        logger.warning("Erro da API Google Drive: %s", exc)
        return resposta_erro(
            "Nao foi possivel concluir a operacao no Google Drive.", status=502
        )
    return None


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
            {"arquivo": [f"Formato invalido. Use: {formatos}."]}, status=400
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
