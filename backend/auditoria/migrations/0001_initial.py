from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="RegistroAuditoria",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "acao",
                    models.CharField(
                        choices=[
                            ("criado", "Criado"),
                            ("atualizado", "Atualizado"),
                            ("excluido", "Excluído"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "entidade_tipo",
                    models.CharField(
                        choices=[("processo", "Processo"), ("prazo", "Prazo")],
                        max_length=20,
                    ),
                ),
                ("entidade_id", models.CharField(max_length=40)),
                ("entidade_rotulo", models.CharField(blank=True, max_length=255)),
                ("autor_id", models.IntegerField(blank=True, null=True)),
                ("autor_nome", models.CharField(blank=True, max_length=150)),
                ("resumo", models.CharField(max_length=500)),
                ("alteracoes", models.JSONField(blank=True, default=dict)),
                ("criado_em", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "verbose_name": "Registro de auditoria",
                "verbose_name_plural": "Registros de auditoria",
                "ordering": ("-criado_em", "-id"),
            },
        ),
        migrations.AddIndex(
            model_name="registroauditoria",
            index=models.Index(
                fields=["entidade_tipo", "entidade_id"],
                name="auditoria_r_entidad_0c3d6e_idx",
            ),
        ),
    ]
