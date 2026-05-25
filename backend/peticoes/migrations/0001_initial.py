import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("clientes", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Peticao",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("adverso", models.CharField(max_length=200)),
                ("responsavel_acao", models.CharField(max_length=100)),
                ("link_drive", models.URLField(blank=True, max_length=500)),
                ("motivo_pendente", models.TextField(blank=True)),
                ("area_juridica", models.CharField(max_length=100)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("Pendente", "Pendente"),
                            ("Em andamento", "Em andamento"),
                            ("Protocolar", "Protocolar"),
                            ("Protocolado", "Protocolado"),
                        ],
                        default="Pendente",
                        max_length=50,
                    ),
                ),
                ("criado_por", models.CharField(blank=True, max_length=100)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                (
                    "cliente",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="peticoes",
                        to="clientes.cliente",
                    ),
                ),
            ],
            options={
                "ordering": ("status", "cliente__nome", "adverso"),
            },
        ),
    ]
