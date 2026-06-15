from django.db import migrations


ASSISTENTE_NAMES = (
    "Assistente Jurídico",
    "Assistente Juridico",
)
STANDARD_NAMES = (
    "Advogado",
    "Estagiário",
    "Estagiario",
)
STANDARD_PERMISSION_APP_LABELS = (
    "agenda",
    "clientes",
    "documentos",
    "meetings",
    "peticoes",
    "prazos",
    "processos",
    "productivity",
    "prospeccao",
)


def remove_assistente_and_reset_permissions(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    Usuario = apps.get_model("usuarios", "Usuario")

    Usuario.objects.filter(cargo__in=ASSISTENTE_NAMES).update(cargo="Advogado")
    Group.objects.filter(name__in=ASSISTENTE_NAMES).delete()

    standard_permissions = Permission.objects.filter(
        content_type__app_label__in=STANDARD_PERMISSION_APP_LABELS
    )
    for grupo in Group.objects.filter(name__in=STANDARD_NAMES):
        grupo.permissions.set(standard_permissions)

    all_permissions = Permission.objects.all()
    for grupo in Group.objects.filter(name="Administrador"):
        grupo.permissions.set(all_permissions)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0008_reset_cargo_permissions"),
    ]

    operations = [
        migrations.RunPython(remove_assistente_and_reset_permissions, noop),
    ]
