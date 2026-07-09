from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from auditoria import services as auditoria_services
from auditoria.models import RegistroAuditoria
from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
    isoformat_ou_nulo,
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from documentos import services as documentos_services
from documentos.views import SUPPORTED_DOCUMENT_EXTENSIONS
from integrations.google.exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)
from integrations.google.oauth import current_usuario
from integrations.google.responses import mapear_erro_google
from prazos.forms import PrazoForm
from prazos.models import Prazo


def _resolver_criador_prazo(request):
    nome_sessao = (request.session.get("usuario_nome") or "").strip()
    if nome_sessao:
        return nome_sessao

    usuario_requisicao = getattr(request, "user", None)
    if usuario_requisicao and getattr(usuario_requisicao, "is_authenticated", False):
        obter_nome_completo = getattr(usuario_requisicao, "get_full_name", None)
        if callable(obter_nome_completo):
            nome_completo = obter_nome_completo().strip()
            if nome_completo:
                return nome_completo

        for atributo in ("first_name", "username", "email"):
            valor = (getattr(usuario_requisicao, atributo, "") or "").strip()
            if valor:
                return valor

    return "Interno"


def serialize_prazo(prazo: Prazo):
    cliente = prazo.processo.cliente if prazo.processo_id else None
    return {
        "id": str(prazo.pk),
        "pk": prazo.pk,
        "titulo": prazo.titulo,
        "descricao": prazo.descricao,
        "data_limite": prazo.data_limite.isoformat() if prazo.data_limite else "",
        "status": prazo.status,
        "prioridade": prazo.prioridade,
        "cliente_id": str(cliente.pk) if cliente else "",
        "cliente_nome": cliente.nome if cliente else "",
        "processo_id": str(prazo.processo_id),
        "processo_numero": prazo.processo.numero_processo if prazo.processo_id else "",
        "responsavel": str(prazo.responsavel_id) if prazo.responsavel_id else "",
        "responsavel_nome": prazo.responsavel.nome if prazo.responsavel_id else "",
        "criado_por": prazo.criado_por,
        "observacoes": prazo.observacoes,
        "link_drive": prazo.link_drive,
        "drive_file_id": prazo.drive_file_id,
        "concluido": prazo.concluido,
        "tempo_decorrido_segundos": prazo.tempo_decorrido_segundos,
        "timer_iniciado_em": isoformat_ou_nulo(prazo.timer_iniciado_em),
        "criado_em": isoformat_ou_nulo(prazo.criado_em),
        "atualizado_em": isoformat_ou_nulo(prazo.atualizado_em),
    }


def _prazo_elapsed_seconds(prazo: Prazo, now=None) -> int:
    elapsed_seconds = int(prazo.tempo_decorrido_segundos or 0)
    if not prazo.timer_iniciado_em:
        return elapsed_seconds

    now = now or timezone.now()
    return elapsed_seconds + max(0, int((now - prazo.timer_iniciado_em).total_seconds()))


def _is_pending_prazo_status(status: str) -> bool:
    return (status or "").strip().casefold() in {"pendente", "a fazer"}


def _prazo_api_payload(request):
    payload = ler_corpo_json(request)
    data = dict(payload)

    if "processo_id" in data and "processo" not in data:
        data["processo"] = data["processo_id"]
    if "data" in data and "data_limite" not in data:
        data["data_limite"] = data["data"]

    return data


@app_permissions_required("prazos.view_prazo")
def listar_prazos(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    prazos = Prazo.objects.select_related("processo__cliente", "responsavel").all()
    return resposta_sucesso({"prazos": [serialize_prazo(prazo) for prazo in prazos]})


@app_permissions_required("prazos.add_prazo")
def criar_prazo(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _prazo_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = PrazoForm(payload)
    if form.is_valid():
        prazo = form.save(commit=False)
        prazo.criado_por = _resolver_criador_prazo(request)
        prazo.save()
        prazo = Prazo.objects.select_related("processo__cliente", "responsavel").get(pk=prazo.pk)
        auditoria_services.registrar(
            request,
            acao=RegistroAuditoria.ACAO_CRIADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_PRAZO,
            entidade_id=prazo.pk,
            rotulo=prazo.titulo,
            processo_id=prazo.processo_id,
            processo_rotulo=prazo.processo.numero_processo if prazo.processo_id else "",
        )
        return resposta_sucesso(
            {"prazo": serialize_prazo(prazo)},
            mensagem="Prazo criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("prazos.view_prazo")
def detalhes_prazo(request, prazo_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    prazo = get_object_or_404(
        Prazo.objects.select_related("processo__cliente", "responsavel"), pk=prazo_id
    )
    return resposta_sucesso({"prazo": serialize_prazo(prazo)})


@app_permissions_required("prazos.change_prazo")
def editar_prazo(request, prazo_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    prazo = get_object_or_404(Prazo, pk=prazo_id)

    try:
        payload = _prazo_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    antes = serialize_prazo(prazo)

    form = PrazoForm(payload, instance=prazo)
    if form.is_valid():
        prazo = form.save()
        prazo = Prazo.objects.select_related("processo__cliente", "responsavel").get(pk=prazo.pk)
        alteracoes = auditoria_services.calcular_diff(antes, serialize_prazo(prazo))
        if alteracoes:
            auditoria_services.registrar(
                request,
                acao=RegistroAuditoria.ACAO_ATUALIZADO,
                entidade_tipo=RegistroAuditoria.ENTIDADE_PRAZO,
                entidade_id=prazo.pk,
                rotulo=prazo.titulo,
                alteracoes=alteracoes,
                processo_id=prazo.processo_id,
                processo_rotulo=(
                    prazo.processo.numero_processo if prazo.processo_id else ""
                ),
            )
        return resposta_sucesso(
            {"prazo": serialize_prazo(prazo)},
            mensagem="Prazo atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("prazos.change_prazo")
def atualizar_timer_prazo(request, prazo_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    prazo = get_object_or_404(
        Prazo.objects.select_related("processo__cliente", "responsavel"), pk=prazo_id
    )

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    update_fields = ["atualizado_em"]
    current_elapsed_seconds = _prazo_elapsed_seconds(prazo)

    if "tempo_decorrido_segundos" in payload:
        try:
            tempo_decorrido_segundos = int(payload.get("tempo_decorrido_segundos") or 0)
        except (TypeError, ValueError):
            return resposta_erro(
                {"tempo_decorrido_segundos": ["Informe um numero inteiro."]},
                status=400,
            )

        if tempo_decorrido_segundos < 0:
            return resposta_erro(
                {"tempo_decorrido_segundos": ["O tempo não pode ser negativo."]},
                status=400,
            )

        prazo.tempo_decorrido_segundos = max(
            int(prazo.tempo_decorrido_segundos or 0),
            current_elapsed_seconds,
            tempo_decorrido_segundos,
        )
        update_fields.append("tempo_decorrido_segundos")

    if "timer_iniciado_em" in payload:
        timer_iniciado_em = payload.get("timer_iniciado_em")
        if timer_iniciado_em in ("", None):
            prazo.timer_iniciado_em = None
        elif isinstance(timer_iniciado_em, str):
            parsed_timer = parse_datetime(timer_iniciado_em)
            if parsed_timer is None:
                return resposta_erro(
                    {"timer_iniciado_em": ["Informe uma data/hora valida."]},
                    status=400,
                )
            prazo.timer_iniciado_em = parsed_timer
            if not prazo.concluido and _is_pending_prazo_status(prazo.status):
                prazo.status = "Em andamento"
                update_fields.append("status")
        else:
            return resposta_erro(
                {"timer_iniciado_em": ["Informe uma data/hora valida."]},
                status=400,
            )
        update_fields.append("timer_iniciado_em")

    prazo.save(update_fields=update_fields)
    return resposta_sucesso(
        {"prazo": serialize_prazo(prazo)}, mensagem="Timer atualizado."
    )


_GOOGLE_ERRORS = (
    GoogleConfigurationError,
    GoogleAuthorizationRequired,
    GoogleApiError,
)


@app_permissions_required("prazos.change_prazo")
def documento_prazo(request, prazo_id):
    """Create (POST) a blank Doc in the process folder, or remove (DELETE) the ref.

    DELETE com ``?apagar=1`` também exclui o arquivo no Drive (era temporário).
    """
    if request.method not in {"POST", "DELETE"}:
        return metodo_nao_permitido(["POST", "DELETE"])

    prazo = get_object_or_404(
        Prazo.objects.select_related("processo", "processo__cliente", "responsavel"), pk=prazo_id
    )
    usuario = current_usuario(request)

    if request.method == "POST":
        nome = (prazo.titulo.strip() or "Prazo")[:255]
        try:
            parent_id = documentos_services.pasta_processo_id(usuario, prazo.processo)
            meta = documentos_services.criar_documento_branco(
                usuario, parent_id=parent_id, nome=nome
            )
        except _GOOGLE_ERRORS as exc:
            return mapear_erro_google(exc)

        prazo.drive_file_id = meta["id"]
        prazo.link_drive = meta.get("webViewLink", "") or ""
        prazo.save(update_fields=["drive_file_id", "link_drive", "atualizado_em"])
        return resposta_sucesso(
            {"prazo": serialize_prazo(prazo)},
            mensagem="Documento criado no Google Drive.",
            status=201,
        )

    apagar = request.GET.get("apagar") == "1"
    if apagar and prazo.drive_file_id:
        try:
            documentos_services.excluir_arquivo(usuario, prazo.drive_file_id)
        except _GOOGLE_ERRORS as exc:
            return mapear_erro_google(exc)

    prazo.drive_file_id = ""
    prazo.link_drive = ""
    prazo.save(update_fields=["drive_file_id", "link_drive", "atualizado_em"])
    return resposta_sucesso(
        {"prazo": serialize_prazo(prazo)}, mensagem="Documento removido do prazo."
    )


@app_permissions_required("prazos.change_prazo")
def upload_documento_prazo(request, prazo_id):
    """Upload a file into the process folder and set it as the prazo's document."""
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    prazo = get_object_or_404(
        Prazo.objects.select_related("processo", "processo__cliente", "responsavel"), pk=prazo_id
    )

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

    usuario = current_usuario(request)
    nome = (arquivo.name or "arquivo")[:255]
    try:
        parent_id = documentos_services.pasta_processo_id(usuario, prazo.processo)
        meta = documentos_services.upload_para_pasta(
            usuario,
            folder_id=parent_id,
            nome=nome,
            content=arquivo.read(),
            mime_type=arquivo.content_type or "",
        )
    except _GOOGLE_ERRORS as exc:
        return mapear_erro_google(exc)

    prazo.drive_file_id = meta["id"]
    prazo.link_drive = meta.get("webViewLink", "") or ""
    prazo.save(update_fields=["drive_file_id", "link_drive", "atualizado_em"])
    return resposta_sucesso(
        {"prazo": serialize_prazo(prazo)},
        mensagem="Arquivo enviado ao Google Drive.",
        status=201,
    )


@app_permissions_required("prazos.delete_prazo")
def excluir_prazo(request, prazo_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    prazo = get_object_or_404(Prazo.objects.select_related("processo"), pk=prazo_id)
    deleted_id = str(prazo.pk)
    rotulo = prazo.titulo
    processo_id = prazo.processo_id
    processo_rotulo = prazo.processo.numero_processo if prazo.processo_id else ""
    prazo.delete()
    auditoria_services.registrar(
        request,
        acao=RegistroAuditoria.ACAO_EXCLUIDO,
        entidade_tipo=RegistroAuditoria.ENTIDADE_PRAZO,
        entidade_id=deleted_id,
        rotulo=rotulo,
        processo_id=processo_id,
        processo_rotulo=processo_rotulo,
    )
    return resposta_sucesso({"id": deleted_id}, mensagem="Prazo excluido com sucesso.")
