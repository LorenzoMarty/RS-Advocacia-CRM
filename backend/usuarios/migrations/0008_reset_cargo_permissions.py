from django.db import migrations
from django.db.models import Q

# Cargos gerenciados e seus papéis. O Administrador recebe todas as permissões;
# os demais recebem o conjunto padrão (Advogado), sem usuarios.* nem financeiro.*.
# Inclui variantes sem acento por robustez contra dados legados no banco.
ADMIN_NAMES = ["Administrador"]
STANDARD_NAMES = [
    "Advogado",
    "Assistente Jurídico",
    "Assistente Juridico",
    "Estagiário",
    "Estagiario",
]


def reset_cargo_permissions(apps, schema_editor):
    # Faxina única e AUTORITATIVA: substitui (set) o conjunto de permissões de cada
    # cargo gerenciado, removendo excessos acumulados. Cargos customizados pelo
    # admin (qualquer outro nome) não são tocados.
    from usuarios.views import ADVOGADO_CARGO_PERMISSIONS

    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")

    permission_filter = Q()
    for permission_path in ADVOGADO_CARGO_PERMISSIONS:
        app_label, codename = permission_path.split(".", 1)
        permission_filter |= Q(
            content_type__app_label=app_label, codename=codename
        )
    standard_perms = list(Permission.objects.filter(permission_filter))

    for grupo in Group.objects.filter(name__in=STANDARD_NAMES):
        grupo.permissions.set(standard_perms)

    all_perms = list(Permission.objects.all())
    for grupo in Group.objects.filter(name__in=ADMIN_NAMES):
        grupo.permissions.set(all_perms)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0007_remove_usuario_google_refresh_token_and_more"),
    ]

    operations = [
        migrations.RunPython(reset_cargo_permissions, noop),
    ]
