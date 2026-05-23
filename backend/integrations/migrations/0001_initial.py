import base64
import hashlib
import django.db.models.deletion
from cryptography.fernet import Fernet
from django.conf import settings
from django.db import migrations, models


def _encrypt(value):
    if not value:
        return ""
    configured_key = getattr(settings, "GOOGLE_TOKEN_ENCRYPTION_KEY", "").strip()
    key = configured_key.encode("ascii") if configured_key else base64.urlsafe_b64encode(
        hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    )
    return Fernet(key).encrypt(value.encode("utf-8")).decode("ascii")


def migrate_existing_google_data(apps, schema_editor):
    Usuario = apps.get_model("usuarios", "Usuario")
    Evento = apps.get_model("agenda", "Evento")
    GoogleAccount = apps.get_model("integrations", "GoogleAccount")
    GoogleCalendar = apps.get_model("integrations", "GoogleCalendar")
    GoogleEventLink = apps.get_model("integrations", "GoogleEventLink")

    for usuario in Usuario.objects.exclude(google_sub__isnull=True).exclude(google_sub=""):
        account, _ = GoogleAccount.objects.update_or_create(
            usuario_id=usuario.pk,
            defaults={
                "sub": usuario.google_sub,
                "email": usuario.email,
                "access_token_ciphertext": _encrypt(usuario.google_token),
                "refresh_token_ciphertext": _encrypt(usuario.google_refresh_token),
                "token_expiry": usuario.google_token_expiry,
            },
        )
        GoogleCalendar.objects.get_or_create(
            account_id=account.pk,
            calendar_id=getattr(settings, "GOOGLE_CALENDAR_ID", "primary") or "primary",
            defaults={
                "summary": "Agenda principal do Google",
                "timezone": getattr(settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE),
                "primary": getattr(settings, "GOOGLE_CALENDAR_ID", "primary") == "primary",
                "enabled": True,
            },
        )

    if GoogleAccount.objects.count() == 1:
        calendar = GoogleCalendar.objects.filter(account=GoogleAccount.objects.first()).first()
        if calendar:
            for evento in Evento.objects.exclude(google_event_id__isnull=True).exclude(google_event_id=""):
                GoogleEventLink.objects.get_or_create(
                    calendar_id=calendar.pk,
                    evento_id=evento.pk,
                    defaults={"google_event_id": evento.google_event_id},
                )


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('agenda', '0003_alter_evento_google_event_id'),
        ('usuarios', '0006_usuario_google_refresh_token_usuario_google_token_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='GoogleAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sub', models.CharField(max_length=255, unique=True)),
                ('email', models.EmailField(max_length=254)),
                ('scopes', models.TextField(blank=True, default='')),
                ('access_token_ciphertext', models.TextField(blank=True, default='')),
                ('refresh_token_ciphertext', models.TextField(blank=True, default='')),
                ('token_expiry', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('usuario', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='google_account', to='usuarios.usuario')),
            ],
        ),
        migrations.CreateModel(
            name='GoogleCalendar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('calendar_id', models.CharField(max_length=512)),
                ('summary', models.CharField(blank=True, default='', max_length=255)),
                ('timezone', models.CharField(blank=True, default='', max_length=100)),
                ('primary', models.BooleanField(default=False)),
                ('enabled', models.BooleanField(default=True)),
                ('sync_token_ciphertext', models.TextField(blank=True, default='')),
                ('last_synced_at', models.DateTimeField(blank=True, null=True)),
                ('account', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='calendars', to='integrations.googleaccount')),
            ],
        ),
        migrations.CreateModel(
            name='GoogleEventLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('google_event_id', models.TextField()),
                ('etag', models.CharField(blank=True, default='', max_length=255)),
                ('local_payload_hash', models.CharField(blank=True, default='', max_length=64)),
                ('remote_deleted_at', models.DateTimeField(blank=True, null=True)),
                ('last_synced_at', models.DateTimeField(blank=True, null=True)),
                ('calendar', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='event_links', to='integrations.googlecalendar')),
                ('evento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='google_links', to='agenda.evento')),
            ],
        ),
        migrations.AddConstraint(
            model_name='googlecalendar',
            constraint=models.UniqueConstraint(fields=('account', 'calendar_id'), name='unique_google_calendar_per_account'),
        ),
        migrations.AddConstraint(
            model_name='googleeventlink',
            constraint=models.UniqueConstraint(fields=('calendar', 'evento'), name='unique_google_link_per_event_calendar'),
        ),
        migrations.AddConstraint(
            model_name='googleeventlink',
            constraint=models.UniqueConstraint(fields=('calendar', 'google_event_id'), name='unique_google_event_per_calendar'),
        ),
        migrations.RunPython(migrate_existing_google_data, migrations.RunPython.noop),
    ]
