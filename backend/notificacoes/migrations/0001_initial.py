import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("usuarios", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notificacao",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tipo", models.CharField(choices=[("prazo", "Prazo"), ("evento", "Evento"), ("reuniao", "Reunião"), ("sistema", "Sistema")], max_length=20)),
                ("titulo", models.CharField(max_length=200)),
                ("mensagem", models.TextField(blank=True)),
                ("link", models.CharField(blank=True, max_length=200)),
                ("lida", models.BooleanField(default=False)),
                ("criada_em", models.DateTimeField(auto_now_add=True)),
                ("usuario", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notificacoes", to="usuarios.usuario")),
            ],
            options={"ordering": ["-criada_em"]},
        ),
    ]
