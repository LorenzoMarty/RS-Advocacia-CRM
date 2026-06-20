from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("auditoria", "0002_registroauditoria_processo_contexto"),
    ]

    operations = [
        migrations.AlterField(
            model_name="registroauditoria",
            name="entidade_tipo",
            field=models.CharField(
                choices=[
                    ("processo", "Processo"),
                    ("prazo", "Prazo"),
                    ("peticao", "Petição"),
                    ("evento", "Evento"),
                ],
                max_length=20,
            ),
        ),
    ]
