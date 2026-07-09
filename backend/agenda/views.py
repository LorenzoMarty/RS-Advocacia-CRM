import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime

from agenda.forms import EventoForm
from agenda.models import Evento
from agenda.tasks import sincronizar_evento_google_calendar
from auditoria import services as auditoria_services
from auditoria.models import RegistroAuditoria
from core.permissions import app_permissions_required
from core.utils import (
    converter_campos_datahora,
    erros_formulario,
    isoformat_ou_nulo,
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from integrations.google.calendar import delete_remote_event, sync_agenda
from integrations.google.exceptions import GoogleAuthorizationRequired
from integrations.google.oauth import current_usuario

EVENTO_DATETIME_FIELDS = ("data_inicio", "data_fim", "lembrete_em")
ATTENDANCE_STATUS = {"Compareceu", "Não compareceu"}
EVENTO_FORM_FIELDS = {
    "titulo",
    "tipo_evento",
    "prioridade",
    "descricao",
    "data_inicio",
    "data_fim",
    "lembrete_em",
    "cliente",
    "processo",
    "responsavel",
    "status",
    "local",
    "observacoes",
    "concluido",
}
logger = logging.getLogger(__name__)


def _eventos_compromisso_queryset():
    return Evento.objects.exclude(tipo_evento__icontains="prazo")


def _resolver_criador_evento(request):
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


def _usuario_google_atual(request):
    return current_usuario(request)


def _sincronizar_evento_se_conectado(request, evento):
    """Agenda a sincronizacao do evento com o Google Calendar em background.

    Chamadas ao Google Calendar sao rede real e nao devem bloquear a resposta
    HTTP de criar/editar evento. O resultado (sincronizado/nao_conectado) nao
    e mais retornado sincronamente porque nenhum consumidor do frontend usava
    esse valor (ver client-side agenda.saveEvent / markEventAttendance).
    """
    usuario = _usuario_google_atual(request)
    if usuario is None:
        return {"status": "nao_conectado"}

    if getattr(settings, "CELERY_BROKER_URL", None):
        sincronizar_evento_google_calendar.delay(evento.pk, usuario.pk)
    else:
        # Dev sem Redis/Celery: roda inline, best-effort (mesmo padrao do
        # MEETINGS_PROCESSING_MODE=inline).
        sincronizar_evento_google_calendar(evento.pk, usuario.pk)

    return {"status": "agendado"}


def serialize_evento(evento: Evento):
    cliente_nome = evento.cliente.nome if evento.cliente_id else ""
    processo_numero = evento.processo.numero_processo if evento.processo_id else ""
    responsavel_nome = evento.responsavel.nome if evento.responsavel_id else ""
    return {
        "id": str(evento.pk),
        "pk": evento.pk,
        "titulo": evento.titulo,
        "descricao": evento.descricao,
        "data_inicio": isoformat_ou_nulo(evento.data_inicio),
        "data_fim": isoformat_ou_nulo(evento.data_fim),
        "tipo_evento": evento.tipo_evento,
        "status": evento.status,
        "prioridade": evento.prioridade,
        "cliente_id": str(evento.cliente_id) if evento.cliente_id else "",
        "cliente_nome": cliente_nome,
        "processo_id": str(evento.processo_id) if evento.processo_id else "",
        "processo_numero": processo_numero,
        "responsavel": str(evento.responsavel_id) if evento.responsavel_id else "",
        "responsavel_nome": responsavel_nome,
        "criado_por": evento.criado_por,
        "local": evento.local,
        "observacoes": evento.observacoes,
        "lembrete_em": isoformat_ou_nulo(evento.lembrete_em),
        "concluido": evento.concluido,
    }


def _evento_api_payload(request):
    payload = ler_corpo_json(request)
    if "completed" in payload and "concluido" not in payload:
        payload["concluido"] = payload["completed"]
    return converter_campos_datahora(payload, EVENTO_DATETIME_FIELDS)


def _evento_form_payload(evento: Evento):
    return {
        "titulo": evento.titulo,
        "tipo_evento": evento.tipo_evento,
        "prioridade": evento.prioridade,
        "descricao": evento.descricao,
        "data_inicio": evento.data_inicio,
        "data_fim": evento.data_fim,
        "lembrete_em": evento.lembrete_em,
        "cliente": evento.cliente_id,
        "processo": evento.processo_id,
        "responsavel": evento.responsavel_id,
        "status": evento.status,
        "local": evento.local,
        "observacoes": evento.observacoes,
        "concluido": evento.concluido,
    }


def _is_partial_evento_payload(payload):
    return not EVENTO_FORM_FIELDS.issubset(payload.keys())


@app_permissions_required("agenda.view_evento")
def listar_eventos(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    eventos = _eventos_compromisso_queryset().select_related("cliente", "processo", "responsavel")

    cliente_id = request.GET.get("cliente_id")
    if cliente_id:
        eventos = eventos.filter(cliente_id=cliente_id)

    data_inicio = parse_datetime(request.GET.get("data_inicio") or "")
    if data_inicio:
        eventos = eventos.filter(data_inicio__gte=data_inicio)

    data_fim = parse_datetime(request.GET.get("data_fim") or "")
    if data_fim:
        eventos = eventos.filter(data_inicio__lte=data_fim)

    eventos = eventos.order_by("data_inicio")
    serialized = [serialize_evento(evento) for evento in eventos]
    return resposta_sucesso({"eventos": serialized})


@app_permissions_required("agenda.add_evento")
def criar_evento(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _evento_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = EventoForm(payload)
    if form.is_valid():
        evento = form.save(commit=False)
        evento.criado_por = _resolver_criador_evento(request)
        evento.save()

        google_sync = _sincronizar_evento_se_conectado(request, evento)

        evento = Evento.objects.select_related("cliente", "processo", "responsavel").get(pk=evento.pk)
        serialized = serialize_evento(evento)

        auditoria_services.registrar(
            request,
            acao=RegistroAuditoria.ACAO_CRIADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_EVENTO,
            entidade_id=evento.pk,
            rotulo=evento.titulo or "",
            processo_id=evento.processo_id or "",
            processo_rotulo=evento.processo.numero_processo if evento.processo_id else "",
        )

        return resposta_sucesso(
            {"evento": serialized, "sincronizacao_google": google_sync},
            mensagem="Evento criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("agenda.view_evento")
def detalhes_evento(request, evento_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    evento = get_object_or_404(
        _eventos_compromisso_queryset().select_related("cliente", "processo", "responsavel"),
        pk=evento_id,
    )
    serialized = serialize_evento(evento)
    return resposta_sucesso({"evento": serialized})


@app_permissions_required("agenda.change_evento")
def marcar_comparecimento(request, evento_id):
    if request.method not in {"POST", "PATCH", "PUT"}:
        return metodo_nao_permitido(["POST", "PATCH", "PUT"])

    evento = get_object_or_404(
        _eventos_compromisso_queryset().select_related("cliente", "processo", "responsavel"),
        pk=evento_id,
    )
    antes = serialize_evento(evento)

    try:
        payload = _evento_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    status = (payload.get("status") or "").strip()
    if status not in ATTENDANCE_STATUS:
        return resposta_erro(
            {"status": ["Use Compareceu ou Não compareceu."]},
            status=400,
        )

    evento.status = status
    evento.concluido = True
    evento.save(update_fields=["status", "concluido", "updated_at"])

    google_sync = _sincronizar_evento_se_conectado(request, evento)

    evento = Evento.objects.select_related("cliente", "processo", "responsavel").get(pk=evento.pk)
    serialized = serialize_evento(evento)
    alteracoes = auditoria_services.calcular_diff(antes, serialized)
    if alteracoes:
        auditoria_services.registrar(
            request,
            acao=RegistroAuditoria.ACAO_ATUALIZADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_EVENTO,
            entidade_id=evento.pk,
            rotulo=evento.titulo or "",
            alteracoes=alteracoes,
            processo_id=evento.processo_id or "",
            processo_rotulo=evento.processo.numero_processo if evento.processo_id else "",
        )

    return resposta_sucesso(
        {"evento": serialized, "sincronizacao_google": google_sync},
        mensagem="Comparecimento atualizado com sucesso.",
    )


@app_permissions_required("agenda.change_evento")
def editar_evento(request, evento_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    evento = get_object_or_404(
        _eventos_compromisso_queryset().select_related("cliente", "processo", "responsavel"),
        pk=evento_id,
    )
    antes = serialize_evento(evento)

    try:
        payload = _evento_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    if request.method == "PATCH" or _is_partial_evento_payload(payload):
        payload = {**_evento_form_payload(evento), **payload}

    form = EventoForm(payload, instance=evento)
    if form.is_valid():
        evento = form.save()

        google_sync = _sincronizar_evento_se_conectado(request, evento)

        evento = Evento.objects.select_related("cliente", "processo", "responsavel").get(pk=evento.pk)
        serialized = serialize_evento(evento)

        alteracoes = auditoria_services.calcular_diff(antes, serialized)
        if alteracoes:
            auditoria_services.registrar(
                request,
                acao=RegistroAuditoria.ACAO_ATUALIZADO,
                entidade_tipo=RegistroAuditoria.ENTIDADE_EVENTO,
                entidade_id=evento.pk,
                rotulo=evento.titulo or "",
                alteracoes=alteracoes,
                processo_id=evento.processo_id or "",
                processo_rotulo=evento.processo.numero_processo if evento.processo_id else "",
            )

        return resposta_sucesso(
            {"evento": serialized, "sincronizacao_google": google_sync},
            mensagem="Evento atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("agenda.delete_evento")
def excluir_evento(request, evento_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    evento = get_object_or_404(
        _eventos_compromisso_queryset().select_related("processo"),
        pk=evento_id,
    )
    deleted_id = str(evento.pk)
    deleted_titulo = evento.titulo or ""
    deleted_processo_id = evento.processo_id or ""
    deleted_processo_rotulo = evento.processo.numero_processo if evento.processo_id else ""

    try:
        delete_remote_event(_usuario_google_atual(request), evento)
    except GoogleAuthorizationRequired as exc:
        return resposta_erro(str(exc), status=409)
    except Exception:
        logger.exception("Erro ao excluir evento no Google Calendar.")
        return resposta_erro(
            "Não foi possível excluir o evento no Google Calendar. Tente novamente.",
            status=502,
        )

    evento.delete()

    auditoria_services.registrar(
        request,
        acao=RegistroAuditoria.ACAO_EXCLUIDO,
        entidade_tipo=RegistroAuditoria.ENTIDADE_EVENTO,
        entidade_id=deleted_id,
        rotulo=deleted_titulo,
        processo_id=deleted_processo_id,
        processo_rotulo=deleted_processo_rotulo,
    )

    return resposta_sucesso({"id": deleted_id}, mensagem="Evento excluído com sucesso.")


@app_permissions_required("agenda.view_evento")
def eventos_calendario(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    eventos = _eventos_compromisso_queryset().all()
    serialized = [
        {
            "titulo": evento.titulo,
            "data_inicio": evento.data_inicio.isoformat(),
            "data_fim": evento.data_fim.isoformat(),
        }
        for evento in eventos
    ]
    return resposta_sucesso({"eventos": serialized})


@app_permissions_required("agenda.view_evento")
def sincronizar_google_calendar(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        resumo = sync_agenda(_usuario_google_atual(request))
    except GoogleAuthorizationRequired as exc:
        return resposta_erro(str(exc), status=401)
    except Exception:
        logger.exception("Erro inesperado ao sincronizar Google Calendar.")
        return resposta_erro(
            "Não foi possível sincronizar com o Google Calendar agora. "
            "Verifique a conexão da conta e tente novamente.",
            status=502,
        )

    eventos = (
        _eventos_compromisso_queryset().select_related("cliente", "processo", "responsavel").all()
    )
    serialized = [serialize_evento(evento) for evento in eventos]
    return resposta_sucesso(
        {
            "eventos": serialized,
            "sincronizacao_google": resumo,
        },
        mensagem="Agenda sincronizada com Google Calendar.",
    )
