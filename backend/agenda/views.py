from django.shortcuts import get_object_or_404

from agenda.forms import EventoForm
from agenda.models import Evento
from core.permissions import app_permissions_required
from core.utils import (
    coerce_datetime_fields,
    error_response,
    form_errors,
    isoformat_or_none,
    method_not_allowed,
    parse_body,
    payload_with_aliases,
    success_response,
)


EVENTO_API_ALIASES = {
    "title": "titulo",
    "description": "descricao",
    "start": "data_inicio",
    "end": "data_fim",
    "type": "tipo_evento",
    "priority": "prioridade",
    "clientId": "cliente",
    "processId": "processo",
    "responsible": "responsavel",
    "location": "local",
    "notes": "observacoes",
    "reminderAt": "lembrete_em",
    "completed": "concluido",
}

EVENTO_DATETIME_FIELDS = ("data_inicio", "data_fim", "lembrete_em")


def _resolve_evento_criado_por(request):
    session_name = (request.session.get("usuario_nome") or "").strip()
    if session_name:
        return session_name

    request_user = getattr(request, "user", None)
    if request_user and getattr(request_user, "is_authenticated", False):
        full_name_getter = getattr(request_user, "get_full_name", None)
        if callable(full_name_getter):
            full_name = full_name_getter().strip()
            if full_name:
                return full_name

        for attr in ("first_name", "username", "email"):
            value = (getattr(request_user, attr, "") or "").strip()
            if value:
                return value

    return "Interno"


def serialize_evento(evento):
    cliente_nome = evento.cliente.nome if evento.cliente_id else ""
    processo_numero = evento.processo.numero_processo if evento.processo_id else ""
    return {
        "id": str(evento.pk),
        "pk": evento.pk,
        "titulo": evento.titulo,
        "title": evento.titulo,
        "descricao": evento.descricao,
        "description": evento.descricao,
        "data_inicio": isoformat_or_none(evento.data_inicio),
        "start": isoformat_or_none(evento.data_inicio),
        "data_fim": isoformat_or_none(evento.data_fim),
        "end": isoformat_or_none(evento.data_fim),
        "tipo_evento": evento.tipo_evento,
        "type": evento.tipo_evento,
        "status": evento.status,
        "prioridade": evento.prioridade,
        "priority": evento.prioridade,
        "cliente_id": str(evento.cliente_id),
        "clientId": str(evento.cliente_id),
        "cliente_nome": cliente_nome,
        "clientName": cliente_nome,
        "processo_id": str(evento.processo_id),
        "processId": str(evento.processo_id),
        "processo_numero": processo_numero,
        "processNumber": processo_numero,
        "responsavel": evento.responsavel,
        "responsible": evento.responsavel,
        "criado_por": evento.criado_por,
        "createdBy": evento.criado_por,
        "local": evento.local,
        "location": evento.local,
        "observacoes": evento.observacoes,
        "notes": evento.observacoes,
        "lembrete_em": isoformat_or_none(evento.lembrete_em),
        "reminderAt": isoformat_or_none(evento.lembrete_em),
        "concluido": evento.concluido,
        "completed": evento.concluido,
    }


def _evento_api_payload(request):
    payload = parse_body(request)
    payload = payload_with_aliases(payload, EVENTO_API_ALIASES)
    return coerce_datetime_fields(payload, EVENTO_DATETIME_FIELDS)


@app_permissions_required("agenda.view_evento")
def listar_eventos(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    eventos = Evento.objects.select_related("cliente", "processo").all()
    serialized = [serialize_evento(evento) for evento in eventos]
    return success_response({"eventos": serialized, "events": serialized})


@app_permissions_required("agenda.add_evento")
def criar_evento(request):
    if request.method != "POST":
        return method_not_allowed(["POST"])

    try:
        payload = _evento_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = EventoForm(payload)
    if form.is_valid():
        evento = form.save(commit=False)
        evento.criado_por = _resolve_evento_criado_por(request)
        evento.save()
        evento = Evento.objects.select_related("cliente", "processo").get(pk=evento.pk)
        serialized = serialize_evento(evento)
        return success_response(
            {"evento": serialized, "event": serialized},
            message="Evento criado com sucesso.",
            status=201,
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("agenda.view_evento")
def detalhes_evento(request, evento_id):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    evento = get_object_or_404(Evento.objects.select_related("cliente", "processo"), pk=evento_id)
    serialized = serialize_evento(evento)
    return success_response({"evento": serialized, "event": serialized})


@app_permissions_required("agenda.change_evento")
def editar_evento(request, evento_id):
    if request.method not in {"PUT", "PATCH"}:
        return method_not_allowed(["PUT", "PATCH"])

    evento = get_object_or_404(Evento, pk=evento_id)

    try:
        payload = _evento_api_payload(request)
    except ValueError as exc:
        return error_response(str(exc), status=400)

    form = EventoForm(payload, instance=evento)
    if form.is_valid():
        evento = form.save()
        evento = Evento.objects.select_related("cliente", "processo").get(pk=evento.pk)
        serialized = serialize_evento(evento)
        return success_response(
            {"evento": serialized, "event": serialized},
            message="Evento atualizado com sucesso.",
        )

    return error_response(form_errors(form), status=400)


@app_permissions_required("agenda.delete_evento")
def excluir_evento(request, evento_id):
    if request.method != "DELETE":
        return method_not_allowed(["DELETE"])

    evento = get_object_or_404(Evento, pk=evento_id)
    deleted_id = str(evento.pk)
    evento.delete()
    return success_response({"id": deleted_id}, message="Evento excluido com sucesso.")


@app_permissions_required("agenda.view_evento")
def eventos_calendario(request):
    if request.method != "GET":
        return method_not_allowed(["GET"])

    eventos = Evento.objects.all()
    serialized = [
        {
            "title": evento.titulo,
            "start": evento.data_inicio.isoformat(),
            "end": evento.data_fim.isoformat(),
        }
        for evento in eventos
    ]
    return success_response({"eventos": serialized, "events": serialized})
