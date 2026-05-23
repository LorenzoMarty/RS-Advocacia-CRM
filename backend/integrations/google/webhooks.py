import logging
from datetime import timedelta, timezone as datetime_timezone
from secrets import token_urlsafe
from uuid import uuid4

from django.conf import settings
from django.urls import reverse
from django.utils import timezone

from integrations.google.calendar import _execute, sync_single_calendar
from integrations.google.client import calendar_service
from integrations.models import GoogleCalendar

logger = logging.getLogger(__name__)


def webhook_url(request=None) -> str:
    configured = getattr(settings, "GOOGLE_CALENDAR_WEBHOOK_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    if request is None:
        return ""
    return request.build_absolute_uri(reverse("google_calendar_webhook"))


def _expiration_from_google(value):
    if not value:
        return None
    try:
        return timezone.datetime.fromtimestamp(int(value) / 1000, tz=datetime_timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _watch_is_current(calendar: GoogleCalendar) -> bool:
    if not calendar.watch_channel_id or not calendar.watch_resource_id:
        return False
    if not calendar.watch_expiration:
        return False
    renewal_hours = int(getattr(settings, "GOOGLE_WATCH_RENEWAL_HOURS", 24))
    return calendar.watch_expiration > timezone.now() + timedelta(hours=renewal_hours)


def stop_watch(service, calendar: GoogleCalendar) -> None:
    if not calendar.watch_channel_id or not calendar.watch_resource_id:
        return
    try:
        _execute(
            lambda: service.channels().stop(
                body={
                    "id": calendar.watch_channel_id,
                    "resourceId": calendar.watch_resource_id,
                }
            ),
            "Nao foi possivel encerrar watch do Google Calendar.",
        )
    except Exception:
        logger.exception("Falha ao encerrar watch Google Calendar.")


def ensure_watch(usuario, calendar: GoogleCalendar, request=None) -> bool:
    address = webhook_url(request)
    if not address:
        logger.info("GOOGLE_CALENDAR_WEBHOOK_URL nao configurada; watch ignorado.")
        return False
    if _watch_is_current(calendar):
        return True

    service = calendar_service(usuario)
    stop_watch(service, calendar)

    channel_id = str(uuid4())
    channel_token = token_urlsafe(32)
    response = _execute(
        lambda: service.events().watch(
            calendarId=calendar.calendar_id,
            body={
                "id": channel_id,
                "type": "web_hook",
                "address": address,
                "token": channel_token,
            },
        ),
        "Nao foi possivel registrar watch do Google Calendar.",
    )
    calendar.watch_channel_id = channel_id
    calendar.watch_resource_id = str(response.get("resourceId") or "")
    calendar.watch_token = channel_token
    calendar.watch_expiration = _expiration_from_google(response.get("expiration"))
    calendar.save(
        update_fields=[
            "watch_channel_id",
            "watch_resource_id",
            "watch_token",
            "watch_expiration",
        ]
    )
    return True


def ensure_watches(usuario, request=None) -> int:
    count = 0
    for calendar in usuario.google_account.calendars.filter(enabled=True):
        if ensure_watch(usuario, calendar, request=request):
            count += 1
    return count


def handle_notification(headers) -> dict:
    channel_id = headers.get("X-Goog-Channel-ID") or headers.get("x-goog-channel-id")
    channel_token = headers.get("X-Goog-Channel-Token") or headers.get(
        "x-goog-channel-token"
    )
    resource_id = headers.get("X-Goog-Resource-ID") or headers.get("x-goog-resource-id")
    resource_state = headers.get("X-Goog-Resource-State") or headers.get(
        "x-goog-resource-state"
    )

    calendar = GoogleCalendar.objects.select_related("account__usuario").filter(
        watch_channel_id=channel_id,
        watch_token=channel_token,
    ).first()
    if calendar is None:
        return {"status": "ignorado"}
    if resource_id and calendar.watch_resource_id and resource_id != calendar.watch_resource_id:
        return {"status": "ignorado"}

    calendar.last_notification_at = timezone.now()
    calendar.save(update_fields=["last_notification_at"])

    if resource_state == "sync":
        return {"status": "registrado"}

    summary = sync_single_calendar(calendar)
    return {"status": "sincronizado", "sincronizacao_google": summary}
