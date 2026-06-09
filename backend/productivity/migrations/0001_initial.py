# Generated manually for productivity module.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("usuarios", "0007_remove_usuario_google_refresh_token_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductivityGoal",
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
                    "daily_hours",
                    models.DecimalField(decimal_places=2, default=6, max_digits=5),
                ),
                (
                    "weekly_hours",
                    models.DecimalField(decimal_places=2, default=30, max_digits=5),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="productivity_goal",
                        to="usuarios.usuario",
                    ),
                ),
            ],
            options={
                "ordering": ("user__nome",),
            },
        ),
        migrations.CreateModel(
            name="TimeEntry",
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
                ("task_id", models.CharField(db_index=True, max_length=64)),
                (
                    "task_type",
                    models.CharField(
                        choices=[
                            ("peticao", "Petição"),
                            ("contestacao", "Contestação"),
                            ("prazo", "Prazo"),
                        ],
                        db_index=True,
                        max_length=20,
                    ),
                ),
                ("started_at", models.DateTimeField()),
                ("paused_at", models.DateTimeField(blank=True, null=True)),
                ("resumed_at", models.DateTimeField(blank=True, null=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("total_seconds", models.PositiveIntegerField(default=0)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("running", "Rodando"),
                            ("paused", "Pausado"),
                            ("stopped", "Encerrado"),
                        ],
                        db_index=True,
                        default="running",
                        max_length=20,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="time_entries",
                        to="usuarios.usuario",
                    ),
                ),
            ],
            options={
                "ordering": ("-started_at", "-id"),
                "indexes": [
                    models.Index(
                        fields=["user", "status"], name="productivit_user_id_c01942_idx"
                    ),
                    models.Index(
                        fields=["task_type", "task_id"],
                        name="productivit_task_ty_fb7d0c_idx",
                    ),
                ],
            },
        ),
    ]
