from django.db import migrations


def reconcile_evento_updated_at(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            ALTER TABLE agenda_evento
                ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();
            """)


class Migration(migrations.Migration):
    dependencies = [
        ("agenda", "0004_remove_evento_google_event_id"),
    ]

    operations = [
        migrations.RunPython(reconcile_evento_updated_at, migrations.RunPython.noop),
    ]
