import hashlib
import json
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from googleapiclient.errors import HttpError

from agenda.models import Evento
from clientes.models import Cliente
from integrations.google.client import account_for_usuario, calendar_service
from integrations.google.exceptions import GoogleApiError
from integrations.models import GoogleCalendar, GoogleEventLink
from processos.models import Processo

SYNC_CLIENT_NAME = "Google Agenda"
SYNC_PROCESS_NUMBER = "GOOGLE-CALENDAR"


def calendar_label(usuario=None) -> str:
    if usuario is not None:
        try:
            enabled = usuario.google_account.calendars.filter(enabled=True).first()
            if enabled:
                return enabled.summary or enabled.calendar_id
        except Exception:
            pass
    return getattr(settings, "GOOGLE_CALENDAR_ID", "primary") or "primary"


def ensure_default_calendar(usuario) -> GoogleCalendar:
    account = account_for_usuario(usuario)
    calendar_id = getattr(settings, "GOOGLE_CALENDAR_ID", "primary") or "primary"
    calendar, _ = GoogleCalendar.objects.get_or_create(
        account=account,
        calendar_id=calendar_id,
        defaults={
            "summary": "Agenda principal do Google" if calendar_id == "primary" else calendar_id,
            "timezone": getattr(settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE),
            "primary": calendar_id == "primary",
            "enabled": True,
        },
    )
    return calendar


def enabled_calendars(usuario):
    account = account_for_usuario(usuario)
    calendars = list(account.calendars.filter(enabled=True))
    if not calendars:
        calendars = [ensure_default_calendar(usuario)]
    return calendars


def list_available_calendars(usuario) -> list[dict]:
    service = calendar_service(usuario)
    page_token = None
    calendars = []
    while True:
        response = service.calendarList().list(pageToken=page_token).execute()
        for item in response.get("items", []):
            calendar, created = GoogleCalendar.objects.get_or_create(
                account=account_for_usuario(usuario),
                calendar_id=item["id"],
                defaults={
                    "summary": item.get("summary", ""),
                    "timezone": item.get("timeZone", ""),
                    "primary": bool(item.get("primary")),
                    "enabled": False,
                },
            )
            if not created:
                calendar.summary = item.get("summary", "")
                calendar.timezone = item.get("timeZone", "")
                calendar.primary = bool(item.get("primary"))
                calendar.save(update_fields=["summary", "timezone", "primary"])
            calendars.append(
                {
                    "id": calendar.calendar_id,
                    "summary": calendar.summary,
                    "timezone": calendar.timezone,
                    "primary": calendar.primary,
                    "enabled": calendar.enabled,
                }
            )
        page_token = response.get("nextPageToken")
        if not page_token:
            return calendars


def configure_calendars(usuario, calendar_ids: list[str]) -> list[dict]:
    requested = {str(item).strip() for item in calendar_ids if str(item).strip()}
    if not requested:
        raise ValueError("Selecione ao menos um calendario Google.")
    available = {item["id"]: item for item in list_available_calendars(usuario)}
    unknown = requested.difference(available)
    if unknown:
        raise ValueError("Calendario Google invalido ou sem acesso.")

    account = account_for_usuario(usuario)
    account.calendars.update(enabled=False)
    for calendar_id in requested:
        calendar = account.calendars.get(calendar_id=calendar_id)
        calendar.enabled = True
        calendar.set_sync_token(None)
        calendar.save(update_fields=["enabled", "sync_token_ciphertext"])
    return list_available_calendars(usuario)


def _aware(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def event_payload(evento) -> dict:
    return {
        "summary": evento.titulo,
        "description": evento.descricao or "",
        "location": evento.local or "",
        "start": {
            "dateTime": _aware(evento.data_inicio).isoformat(),
            "timeZone": getattr(settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE),
        },
        "end": {
            "dateTime": _aware(evento.data_fim).isoformat(),
            "timeZone": getattr(settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE),
        },
    }


def _payload_hash(evento) -> str:
    value = json.dumps(event_payload(evento), sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _google_datetime(value: dict | None):
    if not value:
        return None
    if value.get("dateTime"):
        parsed = parse_datetime(value["dateTime"])
        return _aware(parsed) if parsed else None
    parsed_date = parse_date(value.get("date", ""))
    if not parsed_date:
        return None
    tz = ZoneInfo(getattr(settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE))
    return datetime.combine(parsed_date, time.min, tzinfo=tz)


def _remote_fields(item: dict) -> dict | None:
    start = _google_datetime(item.get("start"))
    end = _google_datetime(item.get("end"))
    if not start:
        return None
    if not end or end <= start:
        end = start + timedelta(hours=1)
    return {
        "titulo": item.get("summary") or "Evento Google",
        "descricao": item.get("description") or "",
        "local": item.get("location") or "",
        "data_inicio": start,
        "data_fim": end,
    }


def _technical_process(usuario) -> Processo:
    cliente = Cliente.objects.filter(nome=SYNC_CLIENT_NAME).first()
    if cliente is None:
        cliente = Cliente.objects.create(
            nome=SYNC_CLIENT_NAME,
            email="google-calendar@example.com",
            telefone="00000000000",
            cpf="000.000.000-00",
            tipo_cliente="esporadico",
            obs="Cliente tecnico para sincronizacao Google.",
        )
    processo = Processo.objects.filter(numero_processo=SYNC_PROCESS_NUMBER).first()
    if processo is None:
        processo = Processo.objects.create(
            numero_processo=SYNC_PROCESS_NUMBER,
            cliente=cliente,
            descricao="Processo tecnico do Google Calendar.",
            vara="Google Calendar",
            area_juridica="Administrativo",
            status="Ativo",
            advogado_responsavel=(getattr(usuario, "nome", "") or "Google Calendar")[:100],
        )
    return processo


def _create_imported_event(usuario, item: dict) -> Evento | None:
    fields = _remote_fields(item)
    if fields is None:
        return None
    processo = _technical_process(usuario)
    return Evento.objects.create(
        cliente=processo.cliente,
        processo=processo,
        tipo_evento="Reuniao",
        status="Agendado",
        prioridade="Media",
        responsavel=(getattr(usuario, "nome", "") or "Google Calendar")[:100],
        criado_por="Google Calendar",
        observacoes="Sincronizado do Google Calendar.",
        concluido=False,
        **fields,
    )


def _update_from_remote(evento: Evento, item: dict) -> None:
    fields = _remote_fields(item)
    if fields is None:
        return
    changed = []
    for name, value in fields.items():
        if getattr(evento, name) != value:
            setattr(evento, name, value)
            changed.append(name)
    if changed:
        evento.save(update_fields=changed)


def _save_link(calendar: GoogleCalendar, evento: Evento, item: dict) -> GoogleEventLink:
    link, _ = GoogleEventLink.objects.update_or_create(
        calendar=calendar,
        google_event_id=str(item["id"]),
        defaults={
            "evento": evento,
            "etag": str(item.get("etag") or ""),
            "local_payload_hash": _payload_hash(evento),
            "remote_deleted_at": None,
            "last_synced_at": timezone.now(),
        },
    )
    return link


def _matching_local_event(calendar: GoogleCalendar, item: dict) -> Evento | None:
    fields = _remote_fields(item)
    if fields is None:
        return None
    return (
        Evento.objects.filter(
            titulo=fields["titulo"],
            descricao=fields["descricao"],
            local=fields["local"],
            data_inicio=fields["data_inicio"],
            data_fim=fields["data_fim"],
        )
        .exclude(google_links__calendar=calendar)
        .first()
    )


def sync_local_event(usuario, evento: Evento) -> int:
    service = calendar_service(usuario)
    synchronized = 0
    for calendar in enabled_calendars(usuario):
        link = GoogleEventLink.objects.filter(calendar=calendar, evento=evento).first()
        payload = event_payload(evento)
        if link:
            item = (
                service.events()
                .update(
                    calendarId=calendar.calendar_id,
                    eventId=link.google_event_id,
                    body=payload,
                )
                .execute()
            )
        else:
            item = (
                service.events()
                .insert(calendarId=calendar.calendar_id, body=payload)
                .execute()
            )
        _save_link(calendar, evento, item)
        synchronized += 1
    return synchronized


def delete_remote_event(usuario, evento: Evento) -> int:
    account = getattr(usuario, "google_account", None)
    if account is None:
        return 0
    links = list(
        GoogleEventLink.objects.filter(calendar__account=account, evento=evento).select_related(
            "calendar"
        )
    )
    if not links:
        return 0
    service = calendar_service(usuario)
    for link in links:
        try:
            service.events().delete(
                calendarId=link.calendar.calendar_id,
                eventId=link.google_event_id,
            ).execute()
        except HttpError as exc:
            if getattr(exc.resp, "status", None) != 410:
                raise GoogleApiError("Nao foi possivel excluir o evento no Google.") from exc
    return len(links)


def _pull_page(service, calendar: GoogleCalendar) -> tuple[list[dict], str]:
    items = []
    page_token = None
    while True:
        kwargs = {
            "calendarId": calendar.calendar_id,
            "pageToken": page_token,
            "singleEvents": True,
            "showDeleted": True,
            "maxResults": 2500,
        }
        if calendar.sync_token:
            kwargs["syncToken"] = calendar.sync_token
        else:
            past_days = getattr(settings, "GOOGLE_SYNC_PAST_DAYS", 180)
            kwargs["timeMin"] = (timezone.now() - timedelta(days=past_days)).isoformat()
        response = service.events().list(**kwargs).execute()
        items.extend(response.get("items", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            return items, str(response.get("nextSyncToken") or "")


def _pull_remote_events(service, calendar: GoogleCalendar) -> tuple[list[dict], str]:
    try:
        return _pull_page(service, calendar)
    except HttpError as exc:
        if getattr(exc.resp, "status", None) != 410 or not calendar.sync_token:
            raise
        calendar.set_sync_token(None)
        calendar.save(update_fields=["sync_token_ciphertext"])
        return _pull_page(service, calendar)


def sync_calendar(usuario, calendar: GoogleCalendar, service) -> dict:
    summary = {
        "importados": 0,
        "atualizados": 0,
        "exportados": 0,
        "cancelados": 0,
        "vinculados": 0,
    }
    remote_items, next_sync_token = _pull_remote_events(service, calendar)
    for item in remote_items:
        google_id = str(item.get("id") or "").strip()
        if not google_id:
            continue
        link = GoogleEventLink.objects.filter(
            calendar=calendar, google_event_id=google_id
        ).select_related("evento").first()
        if item.get("status") == "cancelled":
            if link and link.evento.status.casefold() != "cancelado":
                link.evento.status = "Cancelado"
                link.evento.save(update_fields=["status"])
                link.remote_deleted_at = timezone.now()
                link.last_synced_at = timezone.now()
                link.save(update_fields=["remote_deleted_at", "last_synced_at"])
                summary["cancelados"] += 1
            continue
        if link:
            _update_from_remote(link.evento, item)
            _save_link(calendar, link.evento, item)
            summary["atualizados"] += 1
        else:
            evento = _matching_local_event(calendar, item)
            if evento:
                _save_link(calendar, evento, item)
                summary["vinculados"] += 1
                continue
            evento = _create_imported_event(usuario, item)
            if evento:
                _save_link(calendar, evento, item)
                summary["importados"] += 1

    threshold = timezone.now() - timedelta(days=getattr(settings, "GOOGLE_SYNC_PAST_DAYS", 180))
    local_events = Evento.objects.filter(data_inicio__gte=threshold).exclude(
        status__iexact="Cancelado"
    )
    for evento in local_events:
        link = GoogleEventLink.objects.filter(calendar=calendar, evento=evento).first()
        current_hash = _payload_hash(evento)
        if link and link.local_payload_hash == current_hash:
            continue
        payload = event_payload(evento)
        if link:
            item = (
                service.events()
                .update(
                    calendarId=calendar.calendar_id,
                    eventId=link.google_event_id,
                    body=payload,
                )
                .execute()
            )
        else:
            item = (
                service.events()
                .insert(calendarId=calendar.calendar_id, body=payload)
                .execute()
            )
        _save_link(calendar, evento, item)
        summary["exportados"] += 1

    calendar.set_sync_token(next_sync_token)
    calendar.last_synced_at = timezone.now()
    calendar.save(update_fields=["sync_token_ciphertext", "last_synced_at"])
    return summary


def sync_agenda(usuario) -> dict:
    service = calendar_service(usuario)
    total = {
        "conectado": True,
        "importados": 0,
        "atualizados": 0,
        "exportados": 0,
        "cancelados": 0,
        "vinculados": 0,
    }
    for calendar in enabled_calendars(usuario):
        result = sync_calendar(usuario, calendar, service)
        for key in ("importados", "atualizados", "exportados", "cancelados", "vinculados"):
            total[key] += result.get(key, 0)
    return total
