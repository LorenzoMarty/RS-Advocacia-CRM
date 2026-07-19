from datetime import date

from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date

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

from .forms import LancamentoForm
from .models import (
    CATEGORIAS_DESPESA,
    CATEGORIAS_RECEITA,
    STATUS_CANCELADO,
    STATUS_PAGO,
    STATUS_PENDENTE,
    TIPO_DESPESA,
    TIPO_RECEITA,
    Lancamento,
)

ORDENACOES_PERMITIDAS = {
    "data_vencimento": "data_vencimento",
    "-data_vencimento": "-data_vencimento",
    "valor": "valor",
    "-valor": "-valor",
    "descricao": "descricao",
    "-descricao": "-descricao",
}


def serialize_lancamento(lancamento: Lancamento):
    cliente = lancamento.cliente_relacionado
    caso = lancamento.caso_relacionado
    return {
        "id": str(lancamento.pk),
        "pk": lancamento.pk,
        "descricao": lancamento.descricao,
        "tipo": lancamento.tipo,
        "categoria": lancamento.categoria,
        "valor": str(lancamento.valor),
        "data_vencimento": (
            lancamento.data_vencimento.isoformat() if lancamento.data_vencimento else ""
        ),
        "data_pagamento": (
            lancamento.data_pagamento.isoformat() if lancamento.data_pagamento else ""
        ),
        "status": lancamento.status,
        "status_exibicao": lancamento.status_exibicao,
        "atrasado": lancamento.atrasado,
        "cliente_id": str(cliente.pk) if cliente else "",
        "cliente_nome": cliente.nome if cliente else "",
        "caso_id": str(caso.pk) if caso else "",
        "caso_numero": caso.numero_processo if caso else "",
        "observacoes": lancamento.observacoes,
        "criado_em": isoformat_ou_nulo(lancamento.criado_em),
        "atualizado_em": isoformat_ou_nulo(lancamento.atualizado_em),
    }


def _lancamento_api_payload(request):
    payload = ler_corpo_json(request)
    data = dict(payload)
    if "cliente_id" in data and "cliente_relacionado" not in data:
        data["cliente_relacionado"] = data["cliente_id"]
    if "caso_id" in data and "caso_relacionado" not in data:
        data["caso_relacionado"] = data["caso_id"]
    return data


def _base_queryset():
    return Lancamento.objects.select_related("cliente_relacionado", "caso_relacionado")


@app_permissions_required("financeiro.view_lancamento")
def listar_lancamentos(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    lancamentos = _base_queryset().all()

    tipo = request.GET.get("tipo", "").strip()
    if tipo in {TIPO_RECEITA, TIPO_DESPESA}:
        lancamentos = lancamentos.filter(tipo=tipo)

    categoria = request.GET.get("categoria", "").strip()
    if categoria:
        lancamentos = lancamentos.filter(categoria=categoria)

    inicio = parse_date(request.GET.get("inicio", "") or "")
    if inicio:
        lancamentos = lancamentos.filter(data_vencimento__gte=inicio)
    fim = parse_date(request.GET.get("fim", "") or "")
    if fim:
        lancamentos = lancamentos.filter(data_vencimento__lte=fim)

    busca = request.GET.get("q", "").strip()
    if busca:
        lancamentos = lancamentos.filter(
            Q(descricao__icontains=busca)
            | Q(categoria__icontains=busca)
            | Q(cliente_relacionado__nome__icontains=busca)
        )

    status = request.GET.get("status", "").strip()
    hoje = timezone.localdate()
    if status == "Atrasado":
        lancamentos = lancamentos.filter(
            status=STATUS_PENDENTE, data_vencimento__lt=hoje
        )
    elif status:
        lancamentos = lancamentos.filter(status=status)

    ordenar = request.GET.get("ordenar", "-data_vencimento").strip()
    lancamentos = lancamentos.order_by(
        ORDENACOES_PERMITIDAS.get(ordenar, "-data_vencimento"), "id"
    )

    pagina, paginacao = paginar(lancamentos, request)

    return resposta_sucesso(
        {
            "lancamentos": [serialize_lancamento(item) for item in pagina],
            "total": paginacao["total"],
            "paginacao": paginacao,
        }
    )


@app_permissions_required("financeiro.view_lancamento")
def categorias_financeiro(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    return resposta_sucesso(
        {
            "receita": list(CATEGORIAS_RECEITA),
            "despesa": list(CATEGORIAS_DESPESA),
        }
    )


@app_permissions_required("financeiro.add_lancamento")
def criar_lancamento(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    try:
        payload = _lancamento_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = LancamentoForm(payload)
    if form.is_valid():
        lancamento = form.save()
        lancamento = _base_queryset().get(pk=lancamento.pk)
        return resposta_sucesso(
            {"lancamento": serialize_lancamento(lancamento)},
            mensagem="Lançamento criado com sucesso.",
            status=201,
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("financeiro.view_lancamento")
def detalhes_lancamento(request, lancamento_id):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    lancamento = get_object_or_404(_base_queryset(), pk=lancamento_id)
    return resposta_sucesso({"lancamento": serialize_lancamento(lancamento)})


@app_permissions_required("financeiro.change_lancamento")
def editar_lancamento(request, lancamento_id):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    lancamento = get_object_or_404(Lancamento, pk=lancamento_id)

    try:
        payload = _lancamento_api_payload(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    form = LancamentoForm(payload, instance=lancamento)
    if form.is_valid():
        lancamento = form.save()
        lancamento = _base_queryset().get(pk=lancamento.pk)
        return resposta_sucesso(
            {"lancamento": serialize_lancamento(lancamento)},
            mensagem="Lançamento atualizado com sucesso.",
        )

    return resposta_erro(erros_formulario(form), status=400)


@app_permissions_required("financeiro.delete_lancamento")
def excluir_lancamento(request, lancamento_id):
    if request.method != "DELETE":
        return metodo_nao_permitido(["DELETE"])

    lancamento = get_object_or_404(Lancamento, pk=lancamento_id)
    deleted_id = str(lancamento.pk)
    lancamento.delete()
    return resposta_sucesso(
        {"id": deleted_id}, mensagem="Lançamento excluído com sucesso."
    )


@app_permissions_required("financeiro.change_lancamento")
def marcar_pago(request, lancamento_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    lancamento = get_object_or_404(Lancamento, pk=lancamento_id)

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    data_pagamento = parse_date(payload.get("data_pagamento", "") or "")
    if not data_pagamento:
        return resposta_erro(
            {"data_pagamento": ["Informe a data de pagamento."]},
            status=400,
        )

    lancamento.status = STATUS_PAGO
    lancamento.data_pagamento = data_pagamento
    lancamento.save(update_fields=["status", "data_pagamento", "atualizado_em"])
    lancamento = _base_queryset().get(pk=lancamento.pk)
    return resposta_sucesso(
        {"lancamento": serialize_lancamento(lancamento)},
        mensagem="Lançamento marcado como pago.",
    )


@app_permissions_required("financeiro.change_lancamento")
def cancelar_lancamento(request, lancamento_id):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    lancamento = get_object_or_404(Lancamento, pk=lancamento_id)
    lancamento.status = STATUS_CANCELADO
    lancamento.data_pagamento = None
    lancamento.save(update_fields=["status", "data_pagamento", "atualizado_em"])
    lancamento = _base_queryset().get(pk=lancamento.pk)
    return resposta_sucesso(
        {"lancamento": serialize_lancamento(lancamento)},
        mensagem="Lançamento cancelado.",
    )


def _soma(queryset):
    return queryset.aggregate(total=Sum("valor"))["total"] or 0


def _por_categoria(queryset):
    linhas = (
        queryset.values("categoria").annotate(total=Sum("valor")).order_by("-total")
    )
    return [
        {"categoria": linha["categoria"], "total": str(linha["total"] or 0)}
        for linha in linhas
    ]


@app_permissions_required("financeiro.view_lancamento")
def dashboard_financeiro(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    hoje = timezone.localdate()
    inicio_mes = date(hoje.year, hoje.month, 1)

    ativos = Lancamento.objects.exclude(status=STATUS_CANCELADO)
    receitas = ativos.filter(tipo=TIPO_RECEITA)
    despesas = ativos.filter(tipo=TIPO_DESPESA)

    recebido_mes = _soma(
        receitas.filter(
            status=STATUS_PAGO, data_pagamento__gte=inicio_mes, data_pagamento__lte=hoje
        )
    )
    despesas_mes = _soma(
        despesas.filter(
            status=STATUS_PAGO, data_pagamento__gte=inicio_mes, data_pagamento__lte=hoje
        )
    )
    pendente = _soma(receitas.filter(status=STATUS_PENDENTE))
    atrasado = _soma(receitas.filter(status=STATUS_PENDENTE, data_vencimento__lt=hoje))
    saldo_estimado = (_soma(receitas) or 0) - (_soma(despesas) or 0)

    return resposta_sucesso(
        {
            "recebido_mes": str(recebido_mes),
            "despesas_mes": str(despesas_mes),
            "pendente": str(pendente),
            "atrasado": str(atrasado),
            "saldo_estimado": str(saldo_estimado),
            "receita_por_categoria": _por_categoria(receitas),
            "despesa_por_categoria": _por_categoria(despesas),
        }
    )
