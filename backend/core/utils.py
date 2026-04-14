import json
from collections.abc import Iterable, Mapping
from typing import Any

from django.core.serializers.json import DjangoJSONEncoder
from django.http import HttpRequest, JsonResponse
from django.utils.dateparse import parse_datetime


def success_response(data: Any = None, message: str = "", status: int = 200) -> JsonResponse:
    payload: dict[str, Any] = {
        "success": True,
        "data": data if data is not None else {},
    }
    if message:
        payload["message"] = message
    return JsonResponse(payload, status=status, encoder=DjangoJSONEncoder)


def error_response(errors: Any, status: int = 400) -> JsonResponse:
    if isinstance(errors, str):
        errors = {"detail": [errors]}
    return JsonResponse({"success": False, "errors": errors}, status=status)


def form_errors(form) -> dict[str, list[str]]:
    return {
        field: [error["message"] for error in field_errors]
        for field, field_errors in form.errors.get_json_data().items()
    }


def method_not_allowed(allowed_methods: Iterable[str]) -> JsonResponse:
    allowed = ", ".join(allowed_methods)
    return error_response({"method": [f"Metodo nao permitido. Use: {allowed}."]}, status=405)


def parse_body(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("JSON invalido.") from exc

    if not isinstance(payload, dict):
        raise ValueError("O corpo da requisicao deve ser um objeto JSON.")

    return payload


def payload_with_aliases(
    payload: Mapping[str, Any],
    aliases: Mapping[str, str],
) -> dict[str, Any]:
    data = dict(payload)
    for source, target in aliases.items():
        if source in payload and target not in data:
            data[target] = payload[source]
    return data


def coerce_datetime_fields(payload: Mapping[str, Any], fields: Iterable[str]) -> dict[str, Any]:
    data = dict(payload)

    for field in fields:
        value = data.get(field)
        if isinstance(value, str):
            parsed = parse_datetime(value)
            if parsed is not None:
                data[field] = parsed

    return data


def isoformat_or_none(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat()


api_success = success_response
api_error = error_response
parse_json_body = parse_body
