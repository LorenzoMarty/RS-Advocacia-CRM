from django.db import migrations


ASSISTENTE_NAMES = (
    "Assistente Jurídico",
    "Assistente Juridico",
    "Assistente juridico",
    "assistente juridico",
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


def _group_by_name(Group, name):
    return Group.objects.filter(name=name).first()


def _sync_auth_groups(User, usuario, cargo):
    auth_user = (
        User.objects.filter(username__iexact=usuario.email).first()
        or User.objects.filter(email__iexact=usuario.email).first()
    )
    if auth_user:
        auth_user.groups.set([cargo])


def normalize_legacy_cargos(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    User = apps.get_model("auth", "User")
    Usuario = apps.get_model("usuarios", "Usuario")

    advogado = _group_by_name(Group, "Advogado")
    administrador = _group_by_name(Group, "Administrador")

    if advogado:
        Usuario.objects.filter(cargo__in=ASSISTENTE_NAMES).update(cargo=advogado.name)

    for usuario in Usuario.objects.all():
        cargo = None
        if str(usuario.cargo).isdigit():
            cargo = Group.objects.filter(pk=int(usuario.cargo)).first()
        elif usuario.cargo in ASSISTENTE_NAMES:
            cargo = advogado
        elif usuario.cargo:
            cargo = Group.objects.filter(name=usuario.cargo).first()

        if cargo is None:
            continue

        if usuario.cargo != cargo.name:
            usuario.cargo = cargo.name
            usuario.save(update_fields=["cargo"])
        _sync_auth_groups(User, usuario, cargo)

    Group.objects.filter(name__in=ASSISTENTE_NAMES).delete()

    standard_permissions = Permission.objects.filter(
        content_type__app_label__in=STANDARD_PERMISSION_APP_LABELS
    )
    for grupo in Group.objects.filter(name__in=STANDARD_NAMES):
        grupo.permissions.set(standard_permissions)

    if administrador:
        administrador.permissions.set(Permission.objects.all())


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0009_remove_assistente_juridico"),
    ]

    operations = [
        migrations.RunPython(normalize_legacy_cargos, noop),
    ]
