from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime

from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
    isoformat_ou_nulo,
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
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
        "responsavel": prazo.responsavel,
        "criado_por": prazo.criado_por,
        "observacoes": prazo.observacoes,
        "concluido": prazo.concluido,
        "tempo_decorrido_segundos": prazo.tempo_decorrido_segundos,
        "timer_iniciado_em": isoformat_ou_nulo(prazo.timer_iniciado_em),
        "criado_em": isoformat_ou_nulo(prazo.criado_em),
        "atualizado_em": isoformat_ou_nulo(prazo.atualizado_em),
    }


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

    prazos = Prazo.objects.select_related("processo__cliente").all()
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
        prazo = Prazo.objects.select_related("processo__cliente").get(pk=prazo.pk)
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
        Prazo.objects.select_related("processo__cliente"), pk=prazo_id
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

    form = PrazoForm(payload, instance=prazo)
    if form.is_valid():
        prazo = form.save()
        prazo = Prazo.objects.select_related("processo__cliente").get(pk=prazo.pk)
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
        Prazo.objects.select_related("processo__cliente"), pk=prazo_id
    )

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    update_fields = ["atualizado_em"]

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

        prazo.tempo_decorrido_segundos = tempo_decorrido_segundos
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


@app_permissions_required("prazos.delete_prazo")
def excluir_prazo(request, prazo_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    prazo = get_object_or_404(Prazo, pk=prazo_id)
    deleted_id = str(prazo.pk)
    prazo.delete()
    return resposta_sucesso({"id": deleted_id}, mensagem="Prazo excluido com sucesso.")
