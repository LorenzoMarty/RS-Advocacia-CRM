from django.db import migrations


def reconcile_google_schema(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'integrations_googleaccount'
                      AND column_name = 'sub'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'integrations_googleaccount'
                      AND column_name = 'google_user_id'
                ) THEN
                    ALTER TABLE integrations_googleaccount
                    RENAME COLUMN sub TO google_user_id;
                END IF;
            END $$;

            ALTER TABLE integrations_googlecalendar
                ADD COLUMN IF NOT EXISTS watch_channel_id varchar(255) NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS watch_resource_id varchar(255) NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS watch_token varchar(255) NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS watch_expiration timestamp with time zone NULL,
                ADD COLUMN IF NOT EXISTS last_notification_at timestamp with time zone NULL;

            ALTER TABLE integrations_googleeventlink
                ADD COLUMN IF NOT EXISTS timezone varchar(100) NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS source_of_truth varchar(20) NOT NULL DEFAULT 'local',
                ADD COLUMN IF NOT EXISTS sync_version integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS remote_updated_at timestamp with time zone NULL,
                ADD COLUMN IF NOT EXISTS remote_sequence integer NULL,
                ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("integrations", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(reconcile_google_schema, migrations.RunPython.noop),
    ]
