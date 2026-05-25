from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("agenda", "0005_reconcile_evento_updated_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="evento",
            name="tempo_decorrido_segundos",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="evento",
            name="timer_iniciado_em",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
