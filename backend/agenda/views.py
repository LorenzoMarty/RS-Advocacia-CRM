from django.shortcuts import get_object_or_404

from agenda.forms import EventoForm
from agenda.models import Evento
from agenda.services.google_calendar import (
    criar_evento_google,
    sincronizar_agenda_google,
    atualizar_evento_google,
    deletar_evento_google,
)
from core.permissions import app_permissions_required
from core.utils import (
    resposta_erro,
    erros_formulario,
    isoformat_ou_nulo,
    metodo_nao_permitido,
    ler_corpo_json,
    converter_campos_datahora,
    resposta_sucesso,
)
from usuarios.models import Usuario

EVENTO_DATETIME_FIELDS = ("data_inicio", "data_fim", "lembrete_em")


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
    usuario_id = request.session.get("usuario_id")
    if usuario_id:
        usuario = Usuario.objects.filter(pk=usuario_id).first()
        if usuario is not None:
            return usuario

    usuario_requisicao = getattr(request, "user", None)
    if usuario_requisicao and getattr(usuario_requisicao, "is_authenticated", False):
        identificador = (
            getattr(usuario_requisicao, "email", "")
            or getattr(usuario_requisicao, "username", "")
        )
        if identificador:
            return Usuario.objects.filter(email__iexact=identificador).first()

    return None


def serialize_evento(evento):
    cliente_nome = evento.cliente.nome if evento.cliente_id else ""
    processo_numero = evento.processo.numero_processo if evento.processo_id else ""
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
        "cliente_id": str(evento.cliente_id),
        "cliente_nome": cliente_nome,
        "processo_id": str(evento.processo_id),
        "processo_numero": processo_numero,
        "responsavel": evento.responsavel,
        "criado_por": evento.criado_por,
        "local": evento.local,
        "observacoes": evento.observacoes,
        "lembrete_em": isoformat_ou_nulo(evento.lembrete_em),
        "concluido": evento.concluido,
    }


def _evento_api_payload(request):
    payload = ler_corpo_json(request)
    return converter_campos_datahora(payload, EVENTO_DATETIME_FIELDS)


@app_permissions_required("agenda.view_evento")
def listar_eventos(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    sincronizacao_google = None
    try:
        sincronizacao_google = sincronizar_agenda_google(_usuario_google_atual(request))
    except Exception:
        sincronizacao_google = None

    eventos = Evento.objects.select_related("cliente", "processo").all()
    serialized = [serialize_evento(evento) for evento in eventos]
    payload = {"eventos": serialized}
    if sincronizacao_google is not None:
        payload["sincronizacao_google"] = sincronizacao_google
    return resposta_sucesso(payload)


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

        try:
            google_id = criar_evento_google(_usuario_google_atual(request), evento)
            if isinstance(google_id, str) and google_id.strip():
                evento.google_event_id = google_id
                evento.save(update_fields=["google_event_id"])
        except Exception:
            pass

        evento = Evento.objects.select_related("cliente", "processo").get(pk=evento.pk)
        serialized = serialize_evento(evento)

        return resposta_sucesso(
            {"evento": serialized},
            mensagem="Evento criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("agenda.view_evento")
def detalhes_evento(request, evento_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    evento = get_object_or_404(
        Evento.objects.select_related("cliente", "processo"), pk=evento_id
    )
    serialized = serialize_evento(evento)
    return resposta_sucesso({"evento": serialized})


@app_permissions_required("agenda.change_evento")
def editar_evento(request, evento_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    evento = get_object_or_404(Evento, pk=evento_id)

    try:
        payload = _evento_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = EventoForm(payload, instance=evento)
    if form.is_valid():
        evento = form.save()

        try:
            google_id = atualizar_evento_google(_usuario_google_atual(request), evento)
            if (
                isinstance(google_id, str)
                and google_id.strip()
                and not evento.google_event_id
            ):
                evento.google_event_id = google_id
                evento.save(update_fields=["google_event_id"])
        except Exception:
            pass

        evento = Evento.objects.select_related("cliente", "processo").get(pk=evento.pk)
        serialized = serialize_evento(evento)
        return resposta_sucesso(
            {"evento": serialized},
            mensagem="Evento atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("agenda.delete_evento")
def excluir_evento(request, evento_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    evento = get_object_or_404(Evento, pk=evento_id)

    try:
        deletar_evento_google(_usuario_google_atual(request), evento)
    except Exception:
        pass

    deleted_id = str(evento.pk)
    evento.delete()

    return resposta_sucesso({"id": deleted_id}, mensagem="Evento excluído com sucesso.")


@app_permissions_required("agenda.view_evento")
def eventos_calendario(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    eventos = Evento.objects.all()
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
        resumo = sincronizar_agenda_google(_usuario_google_atual(request))
    except Exception:
        return resposta_erro(
            "Não foi possível sincronizar com o Google Calendar agora. "
            "Verifique a conexão da conta e tente novamente.",
            status=502,
        )

    if not resumo["conectado"]:
        return resposta_erro(
            "Conecte o Google Calendar para sincronizar os compromissos.",
            status=400,
        )

    eventos = Evento.objects.select_related("cliente", "processo").all()
    serialized = [serialize_evento(evento) for evento in eventos]
    return resposta_sucesso(
        {
            "eventos": serialized,
            "sincronizacao_google": resumo,
        },
        mensagem="Agenda sincronizada com Google Calendar.",
    )
