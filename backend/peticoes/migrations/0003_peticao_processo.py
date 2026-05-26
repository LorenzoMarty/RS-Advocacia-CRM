from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("processos", "0001_initial"),
        ("peticoes", "0002_peticao_tipo"),
    ]

    operations = [
        migrations.AddField(
            model_name="peticao",
            name="processo",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="peticoes",
                to="processos.processo",
            ),
        ),
    ]
