import django.db.models.deletion
from django.db import migrations, models


def preencher_responsavel(apps, schema_editor):
    Prazo = apps.get_model("prazos", "Prazo")
    Usuario = apps.get_model("usuarios", "Usuario")

    usuarios_por_nome = {
        usuario.nome.strip().casefold(): usuario
        for usuario in Usuario.objects.all()
        if usuario.nome
    }

    for prazo in Prazo.objects.exclude(responsavel_texto="").iterator():
        usuario = usuarios_por_nome.get(prazo.responsavel_texto.strip().casefold())
        if usuario is not None:
            prazo.responsavel = usuario
            prazo.save(update_fields=["responsavel"])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("prazos", "0003_prazo_drive_file_id_prazo_link_drive"),
        ("usuarios", "0010_normalize_legacy_cargos"),
    ]

    operations = [
        migrations.RenameField(
            model_name="prazo",
            old_name="responsavel",
            new_name="responsavel_texto",
        ),
        migrations.AddField(
            model_name="prazo",
            name="responsavel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="prazos_responsavel",
                to="usuarios.usuario",
            ),
        ),
        migrations.RunPython(preencher_responsavel, reverse_noop),
        migrations.RemoveField(
            model_name="prazo",
            name="responsavel_texto",
        ),
    ]
