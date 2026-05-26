from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("meetings", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="reuniao",
            name="pauta",
        ),
    ]
