from django import template

from core.permission_utils import (
    user_has_all_permissions,
    user_has_any_permissions,
    user_has_permission,
)

register = template.Library()


@register.filter
def has_perm(subject, permission: str) -> bool:
    return user_has_permission(subject, permission)


@register.filter
def has_any_perms(subject, permissions: str) -> bool:
    return user_has_any_permissions(subject, permissions)


@register.filter
def has_all_perms(subject, permissions: str) -> bool:
    return user_has_all_permissions(subject, permissions)
