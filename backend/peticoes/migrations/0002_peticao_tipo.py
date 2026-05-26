from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("peticoes", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="peticao",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("Petição", "Petição"),
                    ("Contestação", "Contestação"),
                ],
                default="Petição",
                max_length=30,
            ),
        ),
    ]
