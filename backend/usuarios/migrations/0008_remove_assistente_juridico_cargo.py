from django.db import migrations

ASSISTENTE_NAMES = ["Assistente Jurídico", "Assistente Juridico"]
ESTAGIARIO_NAME = "Estagiário"


def remove_assistente_juridico(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Usuario = apps.get_model("usuarios", "Usuario")

    assistente_groups = list(Group.objects.filter(name__in=ASSISTENTE_NAMES))
    if not assistente_groups:
        # Nada legado para remover: não semeia nada num banco limpo, preservando
        # o seeding tardio de _ensure_default_cargos (só popula com base zerada).
        return

    # Reusa a lógica de runtime (mesmo padrão do command sync_cargos): get_or_create do
    # cargo Estagiário + aplica o conjunto padrão de permissões (igual ao de Advogado).
    from usuarios.views import _get_or_create_cargo

    estagiario = _get_or_create_cargo(ESTAGIARIO_NAME)

    for grupo in assistente_groups:
        if estagiario is not None:
            for user in grupo.user_set.all():
                user.groups.remove(grupo)
                user.groups.add(estagiario)
        grupo.delete()

    Usuario.objects.filter(cargo__in=ASSISTENTE_NAMES).update(cargo=ESTAGIARIO_NAME)


def noop(apps, schema_editor):
    # Sem reversão: não recriamos um cargo legado.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0007_remove_usuario_google_refresh_token_and_more"),
    ]

    operations = [
        migrations.RunPython(remove_assistente_juridico, noop),
    ]
