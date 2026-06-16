from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("auditoria", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="registroauditoria",
            name="processo_id",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="registroauditoria",
            name="processo_rotulo",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="registroauditoria",
            name="entidade_tipo",
            field=models.CharField(
                choices=[
                    ("processo", "Processo"),
                    ("prazo", "Prazo"),
                    ("peticao", "PetiÃ§Ã£o"),
                ],
                max_length=20,
            ),
        ),
    ]
