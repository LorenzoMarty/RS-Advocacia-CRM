import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("processos", "0002_alter_processo_numero_processo_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="Prazo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("titulo", models.CharField(max_length=200)),
                ("descricao", models.TextField(blank=True)),
                ("data_limite", models.DateField()),
                ("responsavel", models.CharField(max_length=100)),
                ("status", models.CharField(max_length=50)),
                ("prioridade", models.CharField(default="Alta", max_length=50)),
                ("observacoes", models.TextField(blank=True)),
                ("concluido", models.BooleanField(default=False)),
                ("tempo_decorrido_segundos", models.PositiveIntegerField(default=0)),
                ("timer_iniciado_em", models.DateTimeField(blank=True, null=True)),
                ("criado_por", models.CharField(blank=True, max_length=100)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                (
                    "processo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="prazos",
                        to="processos.processo",
                    ),
                ),
            ],
            options={
                "ordering": ("data_limite", "id"),
            },
        ),
    ]
