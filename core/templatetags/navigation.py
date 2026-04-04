from django import template
from django.urls import reverse

register = template.Library()

PRIMARY_NAVIGATION = (
    {
        "key": "dashboard",
        "label": "Dashboard",
        "mobile_label": "Painel",
        "url_name": "dashboard",
        "icon": "dashboard",
    },
    {
        "key": "clientes",
        "label": "Clientes",
        "mobile_label": "Clientes",
        "url_name": "listar_clientes",
        "icon": "clientes",
    },
    {
        "key": "processos",
        "label": "Processos",
        "mobile_label": "Processos",
        "url_name": "listar_processos",
        "icon": "processos",
    },
    {
        "key": "agenda",
        "label": "Agenda",
        "mobile_label": "Agenda",
        "url_name": "listar_eventos",
        "icon": "agenda",
    },
    {
        "key": "usuarios",
        "label": "Usuários",
        "mobile_label": "Usuários",
        "url_name": "listar_usuarios",
        "icon": "usuarios",
    },
)


def _is_active(request, url_name):
    if request is None:
        return False

    current_name = getattr(getattr(request, "resolver_match", None), "url_name", "")
    path = getattr(request, "path", "") or ""

    if url_name == "dashboard":
        return current_name == "dashboard" or path == reverse("dashboard")

    return path.startswith(reverse(url_name))


@register.simple_tag(takes_context=True)
def get_primary_navigation(context):
    request = context.get("request")
    items = []

    for item in PRIMARY_NAVIGATION:
        items.append(
            {
                **item,
                "url": reverse(item["url_name"]),
                "active": _is_active(request, item["url_name"]),
            }
        )

    return items
