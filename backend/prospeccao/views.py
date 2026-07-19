from django.shortcuts import get_object_or_404
from django.utils import timezone

from clientes.forms import ClienteForm
from clientes.models import Cliente
from clientes.views import serialize_cliente
from core.pagination import paginar
from core.permissions import app_permissions_required
from core.utils import (
    erros_formulario,
    isoformat_ou_nulo,
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from productivity.views import _current_usuario

from .forms import InteracaoForm, ProspectForm
from .models import InteracaoProspect, Prospect


def serialize_interacao(interacao: InteracaoProspect):
    return {
        "id": str(interacao.pk),
        "pk": interacao.pk,
        "prospect_id": str(interacao.prospect_id),
        "tipo": interacao.tipo,
        "descricao": interacao.descricao,
        "data": isoformat_ou_nulo(interacao.data),
        "usuario_id": str(interacao.usuario_id) if interacao.usuario_id else "",
        "usuario_nome": interacao.usuario.nome if interacao.usuario else "",
        "criado_em": isoformat_ou_nulo(interacao.criado_em),
    }


def serialize_prospect(prospect: Prospect, incluir_interacoes: bool = False):
    responsavel = prospect.responsavel_interno
    dados = {
        "id": str(prospect.pk),
        "pk": prospect.pk,
        "nome": prospect.nome,
        "telefone": prospect.telefone,
        "email": prospect.email,
        "origem_contato": prospect.origem_contato,
        "tipo_demanda_juridica": prospect.tipo_demanda_juridica,
        "descricao_caso": prospect.descricao_caso,
        "responsavel_id": str(responsavel.pk) if responsavel else "",
        "responsavel_nome": responsavel.nome if responsavel else "",
        "status_prospeccao": prospect.status_prospeccao,
        "prioridade": prospect.prioridade,
        "proxima_acao": prospect.proxima_acao,
        "observacoes": prospect.observacoes,
        "data_ultimo_contato": (
            prospect.data_ultimo_contato.isoformat()
            if prospect.data_ultimo_contato
            else ""
        ),
        "cliente_convertido_id": (
            str(prospect.cliente_convertido_id)
            if prospect.cliente_convertido_id
            else ""
        ),
        "convertido_em": isoformat_ou_nulo(prospect.convertido_em),
        "total_interacoes": prospect.interacoes.count(),
        "data_criacao": isoformat_ou_nulo(prospect.data_criacao),
        "atualizado_em": isoformat_ou_nulo(prospect.atualizado_em),
    }
    if incluir_interacoes:
        dados["interacoes"] = [
            serialize_interacao(interacao)
            for interacao in prospect.interacoes.select_related("usuario").all()
        ]
    return dados


def _prospect_api_payload(request):
    payload = ler_corpo_json(request)
    data = dict(payload)
    if "responsavel_id" in data and "responsavel_interno" not in data:
        data["responsavel_interno"] = data["responsavel_id"]
    return data


def _prospects_base_queryset():
    return Prospect.objects.select_related("responsavel_interno", "cliente_convertido")


@app_permissions_required("prospeccao.view_prospect")
def listar_prospects(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    prospects = _prospects_base_queryset().all()

    status = request.GET.get("status", "").strip()
    if status:
        prospects = prospects.filter(status_prospeccao=status)

    responsavel = request.GET.get("responsavel", "").strip()
    if responsavel:
        prospects = prospects.filter(responsavel_interno_id=responsavel)

    busca = request.GET.get("q", "").strip()
    if busca:
        from django.db.models import Q

        prospects = prospects.filter(
            Q(nome__icontains=busca)
            | Q(email__icontains=busca)
            | Q(telefone__icontains=busca)
        )

    # Limite alto (não paginação de UI): frontend carrega tudo no store
    # global — isto é só um teto de segurança.
    pagina, paginacao = paginar(prospects, request, limite_padrao=1000, limite_maximo=5000)
    return resposta_sucesso(
        {
            "prospects": [serialize_prospect(prospect) for prospect in pagina],
            "paginacao": paginacao,
        }
    )


@app_permissions_required("prospeccao.add_prospect")
def criar_prospect(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _prospect_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ProspectForm(payload)
    if form.is_valid():
        prospect = form.save()
        prospect = _prospects_base_queryset().get(pk=prospect.pk)
        return resposta_sucesso(
            {"prospect": serialize_prospect(prospect, incluir_interacoes=True)},
            mensagem="Prospect criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("prospeccao.view_prospect")
def detalhes_prospect(request, prospect_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    prospect = get_object_or_404(_prospects_base_queryset(), pk=prospect_id)
    return resposta_sucesso(
        {"prospect": serialize_prospect(prospect, incluir_interacoes=True)}
    )


@app_permissions_required("prospeccao.change_prospect")
def editar_prospect(request, prospect_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    prospect = get_object_or_404(Prospect, pk=prospect_id)

    try:
        payload = _prospect_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = ProspectForm(payload, instance=prospect)
    if form.is_valid():
        prospect = form.save()
        prospect = _prospects_base_queryset().get(pk=prospect.pk)
        return resposta_sucesso(
            {"prospect": serialize_prospect(prospect, incluir_interacoes=True)},
            mensagem="Prospect atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("prospeccao.delete_prospect")
def excluir_prospect(request, prospect_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    prospect = get_object_or_404(Prospect, pk=prospect_id)
    deleted_id = str(prospect.pk)
    prospect.delete()
    return resposta_sucesso(
        {"id": deleted_id}, mensagem="Prospect excluído com sucesso."
    )


@app_permissions_required("prospeccao.view_prospect")
def listar_interacoes(request, prospect_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    prospect = get_object_or_404(Prospect, pk=prospect_id)
    interacoes = prospect.interacoes.select_related("usuario").all()
    return resposta_sucesso(
        {"interacoes": [serialize_interacao(interacao) for interacao in interacoes]}
    )


@app_permissions_required("prospeccao.change_prospect")
def criar_interacao(request, prospect_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    prospect = get_object_or_404(Prospect, pk=prospect_id)

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    data = dict(payload)
    data["prospect"] = prospect.pk
    if not data.get("usuario"):
        usuario_atual = _current_usuario(request)
        if usuario_atual:
            data["usuario"] = usuario_atual.pk

    form = InteracaoForm(data)
    if form.is_valid():
        interacao = form.save()
        prospect.data_ultimo_contato = timezone.localdate()
        prospect.save(update_fields=["data_ultimo_contato", "atualizado_em"])
        interacao = InteracaoProspect.objects.select_related("usuario").get(
            pk=interacao.pk
        )
        return resposta_sucesso(
            {"interacao": serialize_interacao(interacao)},
            mensagem="Interação registrada.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("prospeccao.change_prospect")
def converter_prospect(request, prospect_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    prospect = get_object_or_404(Prospect, pk=prospect_id)

    if prospect.cliente_convertido_id:
        return resposta_erro(
            {"conversao": ["Este prospect já foi convertido em cliente."]},
            status=409,
        )

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    cliente_id = payload.get("cliente_id")
    if cliente_id:
        cliente = get_object_or_404(Cliente, pk=cliente_id)
    else:
        from core.permission_utils import user_has_permission

        if not user_has_permission(request, "clientes.add_cliente"):
            return resposta_erro(
                {"permissao": ["Permissão insuficiente para criar cliente."]},
                status=403,
            )

        dados_cliente = {
            "nome": payload.get("nome", prospect.nome),
            "email": payload.get("email", prospect.email),
            "telefone": payload.get("telefone", prospect.telefone),
            "cpf": payload.get("cpf", ""),
            "tipo_cliente": payload.get("tipo_cliente", "esporadico"),
            "obs": payload.get("obs", prospect.descricao_caso),
        }
        form = ClienteForm(dados_cliente)
        if not form.is_valid():
            return resposta_erro(erros_formulario(form), status=400)
        cliente = form.save()

    prospect.cliente_convertido = cliente
    prospect.convertido_em = timezone.now()
    prospect.status_prospeccao = "Convertido"
    prospect.save(
        update_fields=[
            "cliente_convertido",
            "convertido_em",
            "status_prospeccao",
            "atualizado_em",
        ]
    )
    prospect = _prospects_base_queryset().get(pk=prospect.pk)

    return resposta_sucesso(
        {
            "prospect": serialize_prospect(prospect, incluir_interacoes=True),
            "cliente": serialize_cliente(cliente),
        },
        mensagem="Prospect convertido em cliente.",
    )
