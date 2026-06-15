from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('peticoes', '0004_peticao_drive_file_id'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='peticao',
            name='area_juridica',
        ),
    ]
