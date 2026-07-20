from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from ai.models import ConfiguracaoIA, UsoIA
from core.permissions import app_permissions_required
from core.utils import ler_corpo_json, metodo_nao_permitido, resposta_erro, resposta_sucesso
from integrations.google.oauth import current_usuario


def _mascarar_api_key(valor: str) -> str:
    if not valor:
        return ""
    if len(valor) <= 4:
        return "•" * len(valor)
    return f"{'•' * (len(valor) - 4)}{valor[-4:]}"


@app_permissions_required("ai.view_configuracaoia")
def configuracao_ia(request):
    if request.method == "GET":
        api_key = ConfiguracaoIA.obter_api_key_ativa()
        return resposta_sucesso(
            {
                "configurada": bool(api_key),
                "api_key_mascarada": _mascarar_api_key(api_key),
            }
        )

    if request.method == "POST":
        try:
            payload = ler_corpo_json(request)
        except ValueError as exc:
            return resposta_erro(str(exc), status=400)

        api_key = str(payload.get("api_key") or "").strip()
        if not api_key:
            return resposta_erro({"api_key": ["Informe a API key."]}, status=400)

        config = ConfiguracaoIA.objects.first() or ConfiguracaoIA()
        config.set_api_key(api_key)
        config.atualizado_por = current_usuario(request)
        config.save()
        return resposta_sucesso(
            {"configurada": True, "api_key_mascarada": _mascarar_api_key(api_key)},
            mensagem="API key salva com sucesso.",
        )

    if request.method == "DELETE":
        config = ConfiguracaoIA.objects.first()
        if config:
            config.set_api_key("")
            config.atualizado_por = current_usuario(request)
            config.save()
        return resposta_sucesso(
            {"configurada": False, "api_key_mascarada": ""},
            mensagem="API key removida.",
        )

    return metodo_nao_permitido(["GET", "POST", "DELETE"])


def _resumo_periodo(desde) -> dict:
    registros = UsoIA.objects.filter(criado_em__gte=desde) if desde else UsoIA.objects.all()
    total_usd = sum(registro.custo_usd for registro in registros)
    return {"custo_usd": round(total_usd, 4)}


@app_permissions_required("ai.view_configuracaoia")
def custo_ia(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    agora = timezone.now()
    inicio_mes_atual = agora.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    inicio_mes_anterior = (inicio_mes_atual - timedelta(days=1)).replace(day=1)

    todos = UsoIA.objects.all()
    total_usd = round(sum(registro.custo_usd for registro in todos), 4)

    mes_atual = _resumo_periodo(inicio_mes_atual)
    registros_mes_anterior = UsoIA.objects.filter(
        criado_em__gte=inicio_mes_anterior, criado_em__lt=inicio_mes_atual
    )
    mes_anterior_usd = round(
        sum(registro.custo_usd for registro in registros_mes_anterior), 4
    )

    por_operacao = []
    agregado = (
        UsoIA.objects.values("operacao")
        .annotate(
            tokens_entrada=Sum("tokens_entrada"), tokens_saida=Sum("tokens_saida")
        )
        .order_by("operacao")
    )
    for item in agregado:
        registros_operacao = UsoIA.objects.filter(operacao=item["operacao"])
        custo = round(
            sum(registro.custo_usd for registro in registros_operacao), 4
        )
        por_operacao.append(
            {
                "operacao": item["operacao"],
                "tokens_entrada": item["tokens_entrada"] or 0,
                "tokens_saida": item["tokens_saida"] or 0,
                "custo_usd": custo,
            }
        )

    return resposta_sucesso(
        {
            "total_usd": total_usd,
            "mes_atual_usd": mes_atual["custo_usd"],
            "mes_anterior_usd": mes_anterior_usd,
            "por_operacao": por_operacao,
        }
    )
