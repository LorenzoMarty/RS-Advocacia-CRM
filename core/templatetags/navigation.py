from django import template
from django.urls import reverse

from core.permission_utils import user_has_all_permissions, user_has_any_permissions, user_has_permission

register = template.Library()

PRIMARY_NAVIGATION = (
    {
        "key": "dashboard",
        "label": "Dashboard",
        "mobile_label": "Painel",
        "url_name": "dashboard",
        "icon": "dashboard",
        "permissions": ("agenda.view_evento", "clientes.view_cliente", "processos.view_processo"),
        "permission_mode": "all",
    },
    {
        "key": "clientes",
        "label": "Clientes",
        "mobile_label": "Clientes",
        "url_name": "listar_clientes",
        "icon": "clientes",
        "permissions": ("clientes.view_cliente",),
    },
    {
        "key": "processos",
        "label": "Processos",
        "mobile_label": "Processos",
        "url_name": "listar_processos",
        "icon": "processos",
        "permissions": ("processos.view_processo",),
    },
    {
        "key": "agenda",
        "label": "Agenda",
        "mobile_label": "Agenda",
        "url_name": "listar_eventos",
        "icon": "agenda",
        "permissions": ("agenda.view_evento",),
    },
    {
        "key": "usuarios",
        "label": "Usuários",
        "mobile_label": "Usuários",
        "url_name": "listar_usuarios",
        "icon": "usuarios",
        "match_prefixes": ("listar_usuarios", "listar_cargos"),
        "permissions": ("usuarios.view_usuario", "auth.view_group"),
        "permission_mode": "any",
    },
)


def _is_active(request, item):
    if request is None:
        return False

    current_name = getattr(getattr(request, "resolver_match", None), "url_name", "")
    path = getattr(request, "path", "") or ""
    url_name = item["url_name"]
    match_prefixes = item.get("match_prefixes", (url_name,))

    if url_name == "dashboard":
        return current_name == "dashboard" or path == reverse("dashboard")

    return any(path.startswith(reverse(match_url_name)) for match_url_name in match_prefixes)


def _resolve_item_destination(request, item):
    resolved_item = dict(item)

    if resolved_item["key"] == "usuarios" and request is not None:
        if user_has_permission(request, "usuarios.view_usuario"):
            resolved_item["url_name"] = "listar_usuarios"
            resolved_item["label"] = "Usuários"
            resolved_item["mobile_label"] = "Usuários"
        elif user_has_permission(request, "auth.view_group"):
            resolved_item["url_name"] = "listar_cargos"
            resolved_item["label"] = "Cargos"
            resolved_item["mobile_label"] = "Cargos"

    return resolved_item


def _has_item_permission(request, item):
    permissions = item.get("permissions")
    if not permissions:
        return True

    if item.get("permission_mode") == "all":
        return user_has_all_permissions(request, permissions)

    return user_has_any_permissions(request, permissions)


@register.simple_tag(takes_context=True)
def get_primary_navigation(context):
    request = context.get("request")
    items = []

    for item in PRIMARY_NAVIGATION:
        if not _has_item_permission(request, item):
            continue
        resolved_item = _resolve_item_destination(request, item)
        items.append(
            {
                **resolved_item,
                "url": reverse(resolved_item["url_name"]),
                "active": _is_active(request, resolved_item),
            }
        )

    return items


@register.simple_tag(takes_context=True)
def get_home_navigation_url(context):
    items = get_primary_navigation(context)
    if items:
        return items[0]["url"]
    return reverse("logout")
