import json
from collections.abc import Iterable, Mapping
from typing import Any

from django.core.serializers.json import DjangoJSONEncoder
from django.http import HttpRequest, JsonResponse
from django.utils.dateparse import parse_datetime


def resposta_sucesso(
    dados: Any = None,
    mensagem: str = "",
    status: int = 200,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "sucesso": True,
        "dados": dados if dados is not None else {},
    }
    if mensagem:
        payload["mensagem"] = mensagem
    return JsonResponse(payload, status=status, encoder=DjangoJSONEncoder)


def resposta_erro(erros: Any, status: int = 400) -> JsonResponse:
    if isinstance(erros, str):
        erros = {"detalhe": [erros]}
    return JsonResponse({"sucesso": False, "erros": erros}, status=status)


def erros_formulario(form) -> dict[str, list[str]]:
    return {
        field: [error["message"] for error in field_errors]
        for field, field_errors in form.errors.get_json_data().items()
    }


def metodo_nao_permitido(metodos_permitidos: Iterable[str]) -> JsonResponse:
    permitidos = ", ".join(metodos_permitidos)
    return resposta_erro(
        {"metodo": [f"Método não permitido. Use: {permitidos}."]},
        status=405,
    )


def ler_corpo_json(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("JSON inválido.") from exc

    if not isinstance(payload, dict):
        raise ValueError("O corpo da requisição deve ser um objeto JSON.")

    return payload


def dados_com_aliases(
    payload: Mapping[str, Any],
    aliases: Mapping[str, str],
) -> dict[str, Any]:
    data = dict(payload)
    for source, target in aliases.items():
        if source in payload and target not in data:
            data[target] = payload[source]
    return data


def converter_campos_datahora(
    payload: Mapping[str, Any],
    campos: Iterable[str],
) -> dict[str, Any]:
    data = dict(payload)

    for campo in campos:
        valor = data.get(campo)
        if isinstance(valor, str):
            convertido = parse_datetime(valor)
            if convertido is not None:
                data[campo] = convertido

    return data


def isoformat_ou_nulo(valor: Any) -> str | None:
    if valor is None:
        return None
    return valor.isoformat()
