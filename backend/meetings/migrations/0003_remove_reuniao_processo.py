from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("meetings", "0002_remove_reuniao_pauta"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="reuniao",
            name="processo",
        ),
    ]
