from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0003_align_cargo_with_auth_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="google_sub",
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                unique=True,
            ),
        ),
    ]
