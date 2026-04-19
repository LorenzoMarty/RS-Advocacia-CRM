import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0004_usuario_google_sub"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="usuario",
            name="senha",
        ),
        migrations.AddField(
            model_name="usuario",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="usuario",
            name="picture",
            field=models.URLField(blank=True, null=True),
        ),
    ]
