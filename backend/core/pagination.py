"""Shared offset/limit pagination for list views.

Single source of truth for the ``?limit=&offset=`` query-param contract used
by clientes/processos/usuarios/auditoria, so the parsing rules (defaults,
clamping) and the ``paginacao`` response shape never drift between apps.
"""

from __future__ import annotations

from django.db.models import QuerySet
from django.http import HttpRequest

LIMITE_PADRAO = 100
LIMITE_MAXIMO = 300


def resolver_limite(
    request: HttpRequest,
    *,
    limite_padrao: int = LIMITE_PADRAO,
    limite_maximo: int = LIMITE_MAXIMO,
) -> int:
    try:
        limite = int(request.GET.get("limit") or limite_padrao)
    except (TypeError, ValueError):
        return limite_padrao
    if limite <= 0:
        return limite_padrao
    return min(limite, limite_maximo)


def resolver_offset(request: HttpRequest) -> int:
    try:
        offset = int(request.GET.get("offset") or 0)
    except (TypeError, ValueError):
        return 0
    return max(0, offset)


def paginar(
    queryset: QuerySet,
    request: HttpRequest,
    *,
    limite_padrao: int = LIMITE_PADRAO,
    limite_maximo: int = LIMITE_MAXIMO,
) -> tuple[QuerySet, dict[str, int | bool]]:
    """Slice ``queryset`` per the request's limit/offset and return the
    matching ``paginacao`` metadata block for the response envelope."""
    total = queryset.count()
    limit = resolver_limite(
        request, limite_padrao=limite_padrao, limite_maximo=limite_maximo
    )
    offset = resolver_offset(request)
    pagina = queryset[offset : offset + limit]
    meta = {
        "offset": offset,
        "limit": limit,
        "total": total,
        "tem_mais": offset + limit < total,
    }
    return pagina, meta
