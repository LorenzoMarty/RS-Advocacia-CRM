from collections.abc import Iterable, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.urls import reverse


ACCESSIBLE_ROUTE_RULES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("agenda.view_evento", "clientes.view_cliente", "processos.view_processo"), "dashboard"),
    (("clientes.view_cliente",), "listar_clientes"),
    (("processos.view_processo",), "listar_processos"),
    (("agenda.view_evento",), "listar_eventos"),
    (("usuarios.view_usuario",), "listar_usuarios"),
    (("auth.view_group",), "listar_cargos"),
)


def resolve_user(subject: Any):
    if hasattr(subject, "user"):
        return getattr(subject, "user")
    return subject


def normalize_permissions(permissions: str | Iterable[str]) -> tuple[str, ...]:
    if isinstance(permissions, str):
        return tuple(permission.strip() for permission in permissions.split(",") if permission.strip())
    return tuple(str(permission).strip() for permission in permissions if str(permission).strip())


def user_has_permission(subject: Any, permission: str) -> bool:
    user = resolve_user(subject)
    if not permission or user is None or isinstance(user, AnonymousUser):
        return False
    return bool(getattr(user, "is_authenticated", False) and user.has_perm(permission))


def user_has_any_permissions(subject: Any, permissions: str | Iterable[str]) -> bool:
    normalized = normalize_permissions(permissions)
    return any(user_has_permission(subject, permission) for permission in normalized)


def user_has_all_permissions(subject: Any, permissions: str | Iterable[str]) -> bool:
    normalized = normalize_permissions(permissions)
    return bool(normalized) and all(user_has_permission(subject, permission) for permission in normalized)


def get_accessible_url(subject: Any, fallback_route: str = "logout") -> str:
    for permissions, route_name in ACCESSIBLE_ROUTE_RULES:
        if user_has_all_permissions(subject, permissions):
            return reverse(route_name)
    return reverse(fallback_route)


def get_permitted_url_or_fallback(
    subject: Any,
    permission: str,
    route_name: str,
    *,
    args: Sequence[Any] | None = None,
    fallback_route: str = "logout",
) -> str:
    if user_has_permission(subject, permission):
        return reverse(route_name, args=args or [])
    return get_accessible_url(subject, fallback_route=fallback_route)
