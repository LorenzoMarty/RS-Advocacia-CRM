import django.db.models.deletion
from django.db import migrations, models


def preencher_advogado_responsavel(apps, schema_editor):
    Processo = apps.get_model("processos", "Processo")
    Usuario = apps.get_model("usuarios", "Usuario")

    usuarios_por_nome = {
        usuario.nome.strip().casefold(): usuario
        for usuario in Usuario.objects.all()
        if usuario.nome
    }

    for processo in Processo.objects.exclude(advogado_responsavel_texto="").iterator():
        usuario = usuarios_por_nome.get(processo.advogado_responsavel_texto.strip().casefold())
        if usuario is not None:
            processo.advogado_responsavel = usuario
            processo.save(update_fields=["advogado_responsavel"])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("processos", "0003_processo_data_ultima_movimentacao"),
        ("usuarios", "0010_normalize_legacy_cargos"),
    ]

    operations = [
        migrations.RenameField(
            model_name="processo",
            old_name="advogado_responsavel",
            new_name="advogado_responsavel_texto",
        ),
        migrations.AddField(
            model_name="processo",
            name="advogado_responsavel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="processos_responsavel",
                to="usuarios.usuario",
            ),
        ),
        migrations.RunPython(preencher_advogado_responsavel, reverse_noop),
        migrations.RemoveField(
            model_name="processo",
            name="advogado_responsavel_texto",
        ),
    ]
