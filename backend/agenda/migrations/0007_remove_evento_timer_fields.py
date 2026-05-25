from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("agenda", "0006_evento_timer_fields"),
        ("prazos", "0002_migrate_eventos_prazo"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="evento",
            name="tempo_decorrido_segundos",
        ),
        migrations.RemoveField(
            model_name="evento",
            name="timer_iniciado_em",
        ),
    ]
