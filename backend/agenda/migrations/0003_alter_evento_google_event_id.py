from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("agenda", "0002_evento_google_event_id"),
    ]

    operations = [
        migrations.AlterField(
            model_name="evento",
            name="google_event_id",
            field=models.TextField(blank=True, null=True),
        ),
    ]
