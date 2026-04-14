from collections.abc import Iterable
from typing import Any

from django.contrib.auth.models import AnonymousUser


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
