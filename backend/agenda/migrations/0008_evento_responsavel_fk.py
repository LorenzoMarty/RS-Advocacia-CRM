from django.db import migrations, models
import django.db.models.deletion


def vincular_responsavel(apps, schema_editor):
    """Casa o nome textual de cada evento com um Usuario existente.

    Eventos cujo responsavel textual nao corresponder a nenhum Usuario
    ficam com responsavel_fk nulo (texto livre original e perdido).
    """
    Evento = apps.get_model("agenda", "Evento")
    Usuario = apps.get_model("usuarios", "Usuario")

    usuarios_por_nome = {}
    for usuario in Usuario.objects.all():
        nome = (usuario.nome or "").strip().casefold()
        if nome:
            usuarios_por_nome.setdefault(nome, usuario.pk)

    for evento in Evento.objects.all().iterator():
        nome = (evento.responsavel or "").strip().casefold()
        usuario_pk = usuarios_por_nome.get(nome)
        if usuario_pk:
            evento.responsavel_fk_id = usuario_pk
            evento.save(update_fields=["responsavel_fk"])


def desvincular_responsavel(apps, schema_editor):
    Evento = apps.get_model("agenda", "Evento")
    Evento.objects.update(responsavel_fk=None)


class Migration(migrations.Migration):

    dependencies = [
        ("agenda", "0007_remove_evento_timer_fields"),
        ("usuarios", "0007_remove_usuario_google_refresh_token_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="evento",
            name="responsavel_fk",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="eventos_responsavel",
                to="usuarios.usuario",
            ),
        ),
        migrations.RunPython(vincular_responsavel, desvincular_responsavel),
        migrations.RemoveField(
            model_name="evento",
            name="responsavel",
        ),
        migrations.RenameField(
            model_name="evento",
            old_name="responsavel_fk",
            new_name="responsavel",
        ),
    ]
