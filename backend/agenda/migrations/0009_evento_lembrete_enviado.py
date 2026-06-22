from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("agenda", "0008_evento_responsavel_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="evento",
            name="lembrete_enviado",
            field=models.BooleanField(default=False),
        ),
    ]
