import hashlib
import json
import logging
import time as time_module
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from googleapiclient.errors import HttpError

from agenda.models import Evento
from clientes.models import Cliente
from integrations.google.client import account_for_usuario, calendar_service
from integrations.google.exceptions import GoogleApiError
from integrations.models import GoogleCalendar, GoogleEventLink
from processos.models import Processo

logger = logging.getLogger(__name__)

SYNC_CLIENT_NAME = "Google Agenda"
SYNC_PROCESS_NUMBER = "GOOGLE-CALENDAR"
RETRYABLE_STATUSES = {429, 500, 502, 503, 504}


def _execute(factory, error_message: str):
    for attempt in range(3):
        try:
            return factory().execute()
        except HttpError as exc:
            status = getattr(exc.resp, "status", None)
            if status not in RETRYABLE_STATUSES or attempt == 2:
                raise GoogleApiError(error_message) from exc
            time_module.sleep(0.35 * (attempt + 1))


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
            "summary": (
                "Agenda principal do Google"
                if calendar_id == "primary"
                else calendar_id
            ),
            "timezone": getattr(
                settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE
            ),
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
    account = account_for_usuario(usuario)
    page_token = None
    calendars = []
    while True:
        response = _execute(
            lambda: service.calendarList().list(pageToken=page_token),
            "Nao foi possivel listar os calendarios Google.",
        )
        for item in response.get("items", []):
            calendar, created = GoogleCalendar.objects.get_or_create(
                account=account,
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
    from integrations.google.webhooks import stop_watch

    requested = {str(item).strip() for item in calendar_ids if str(item).strip()}
    if not requested:
        raise ValueError("Selecione ao menos um calendario Google.")
    available = {item["id"]: item for item in list_available_calendars(usuario)}
    unknown = requested.difference(available)
    if unknown:
        raise ValueError("Calendario Google invalido ou sem acesso.")

    account = account_for_usuario(usuario)
    service = calendar_service(usuario)
    for calendar in account.calendars.exclude(watch_channel_id=""):
        stop_watch(service, calendar)
    account.calendars.update(
        enabled=False,
        sync_token_ciphertext="",
        watch_channel_id="",
        watch_resource_id="",
        watch_token="",
        watch_expiration=None,
    )
    for calendar_id in requested:
        calendar = account.calendars.get(calendar_id=calendar_id)
        calendar.enabled = True
        calendar.save(update_fields=["enabled"])
    return list_available_calendars(usuario)


def _aware(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def _item_updated_at(item: dict):
    value = item.get("updated")
    parsed = parse_datetime(value) if value else None
    return _aware(parsed) if parsed else None


def _item_sequence(item: dict):
    value = item.get("sequence")
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _item_timezone(item: dict) -> str:
    return (
        item.get("start", {}).get("timeZone")
        or item.get("end", {}).get("timeZone")
        or getattr(settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE)
    )


def event_payload(evento) -> dict:
    return {
        "summary": evento.titulo,
        "description": evento.descricao or "",
        "location": evento.local or "",
        "start": {
            "dateTime": _aware(evento.data_inicio).isoformat(),
            "timeZone": getattr(
                settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE
            ),
        },
        "end": {
            "dateTime": _aware(evento.data_fim).isoformat(),
            "timeZone": getattr(
                settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE
            ),
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
            advogado_responsavel=(getattr(usuario, "nome", "") or "Google Calendar")[
                :100
            ],
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


def _update_from_remote(evento: Evento, item: dict) -> bool:
    fields = _remote_fields(item)
    if fields is None:
        return False
    changed = []
    for name, value in fields.items():
        if getattr(evento, name) != value:
            setattr(evento, name, value)
            changed.append(name)
    if changed:
        evento.save(update_fields=[*changed, "updated_at"])
        return True
    return False


def _save_link(
    calendar: GoogleCalendar,
    evento: Evento,
    item: dict,
    *,
    source_of_truth: str,
) -> GoogleEventLink:
    current_version = (
        GoogleEventLink.objects.filter(
            calendar=calendar,
            google_event_id=str(item["id"]),
        )
        .values_list("sync_version", flat=True)
        .first()
        or 0
    )
    link, _ = GoogleEventLink.objects.update_or_create(
        calendar=calendar,
        google_event_id=str(item["id"]),
        defaults={
            "evento": evento,
            "etag": str(item.get("etag") or ""),
            "local_payload_hash": _payload_hash(evento),
            "timezone": _item_timezone(item),
            "source_of_truth": source_of_truth,
            "sync_version": current_version + 1,
            "remote_updated_at": _item_updated_at(item),
            "remote_sequence": _item_sequence(item),
            "remote_deleted_at": None,
            "last_synced_at": timezone.now(),
        },
    )
    return link


def _google_error_status(exc: GoogleApiError):
    return getattr(
        getattr(getattr(exc, "__cause__", None), "resp", None), "status", None
    )


def _matching_local_event(calendar: GoogleCalendar, item: dict) -> Evento | None:
    fields = _remote_fields(item)
    if fields is None:
        return None
    return (
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .filter(
            titulo=fields["titulo"],
            descricao=fields["descricao"],
            local=fields["local"],
            data_inicio=fields["data_inicio"],
            data_fim=fields["data_fim"],
        )
        .exclude(google_links__calendar=calendar)
        .first()
    )


def _remote_should_win(evento: Evento, link: GoogleEventLink, item: dict) -> bool:
    if not link.last_synced_at:
        return True
    remote_updated_at = _item_updated_at(item)
    if _payload_hash(evento) == link.local_payload_hash:
        return True
    if remote_updated_at and evento.updated_at:
        return remote_updated_at >= evento.updated_at
    return False


def sync_local_event(usuario, evento: Evento) -> int:
    service = calendar_service(usuario)
    synchronized = 0
    for calendar in enabled_calendars(usuario):
        link = GoogleEventLink.objects.filter(calendar=calendar, evento=evento).first()
        payload = event_payload(evento)
        try:
            if link:
                item = _execute(
                    lambda link=link: service.events().update(
                        calendarId=calendar.calendar_id,
                        eventId=link.google_event_id,
                        body=payload,
                    ),
                    "Nao foi possivel atualizar o evento no Google.",
                )
            else:
                item = _execute(
                    lambda: service.events().insert(
                        calendarId=calendar.calendar_id, body=payload
                    ),
                    "Nao foi possivel criar o evento no Google.",
                )
        except GoogleApiError as exc:
            if not link or _google_error_status(exc) not in {404, 410}:
                raise
            link.delete()
            item = _execute(
                lambda: service.events().insert(
                    calendarId=calendar.calendar_id, body=payload
                ),
                "Nao foi possivel recriar o evento no Google.",
            )
        _save_link(
            calendar,
            evento,
            item,
            source_of_truth=GoogleEventLink.SOURCE_LOCAL,
        )
        synchronized += 1
    return synchronized


def delete_remote_event(usuario, evento: Evento) -> int:
    account = getattr(usuario, "google_account", None)
    if account is None:
        return 0
    links = list(
        GoogleEventLink.objects.filter(
            calendar__account=account, evento=evento
        ).select_related("calendar")
    )
    if not links:
        return 0
    service = calendar_service(usuario)
    deleted = 0
    for link in links:
        try:
            _execute(
                lambda link=link: service.events().delete(
                    calendarId=link.calendar.calendar_id,
                    eventId=link.google_event_id,
                ),
                "Nao foi possivel excluir o evento no Google.",
            )
        except GoogleApiError as exc:
            status = getattr(getattr(exc, "__cause__", None), "resp", None)
            if getattr(status, "status", None) not in {404, 410}:
                raise
        deleted += 1
    return deleted


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
        response = _execute(
            lambda kwargs=kwargs: service.events().list(**kwargs),
            "Nao foi possivel listar eventos do Google Calendar.",
        )
        items.extend(response.get("items", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            return items, str(response.get("nextSyncToken") or "")


def _pull_remote_events(service, calendar: GoogleCalendar) -> tuple[list[dict], str]:
    try:
        return _pull_page(service, calendar)
    except GoogleApiError as exc:
        cause = getattr(exc, "__cause__", None)
        if (
            getattr(getattr(cause, "resp", None), "status", None) != 410
            or not calendar.sync_token
        ):
            raise
        calendar.set_sync_token(None)
        calendar.save(update_fields=["sync_token_ciphertext"])
        return _pull_page(service, calendar)


def _delete_remote_copies_for_remote_deletion(
    service, deleted_link: GoogleEventLink
) -> None:
    other_links = (
        GoogleEventLink.objects.filter(evento=deleted_link.evento)
        .exclude(pk=deleted_link.pk)
        .select_related("calendar")
    )
    for link in other_links:
        try:
            _execute(
                lambda link=link: service.events().delete(
                    calendarId=link.calendar.calendar_id,
                    eventId=link.google_event_id,
                ),
                "Nao foi possivel remover copia remota do evento.",
            )
        except GoogleApiError:
            logger.exception("Falha ao remover copia remota apos delete externo.")


def sync_calendar(usuario, calendar: GoogleCalendar, service) -> dict:
    summary = {
        "importados": 0,
        "atualizados": 0,
        "exportados": 0,
        "removidos": 0,
        "vinculados": 0,
        "conflitos": 0,
    }
    remote_items, next_sync_token = _pull_remote_events(service, calendar)
    for item in remote_items:
        google_id = str(item.get("id") or "").strip()
        if not google_id:
            continue
        link = (
            GoogleEventLink.objects.filter(calendar=calendar, google_event_id=google_id)
            .select_related("evento")
            .first()
        )
        if item.get("status") == "cancelled":
            if link:
                with transaction.atomic():
                    evento = link.evento
                    _delete_remote_copies_for_remote_deletion(service, link)
                    evento.delete()
                summary["removidos"] += 1
            continue
        if link:
            if _remote_should_win(link.evento, link, item):
                changed = _update_from_remote(link.evento, item)
                link.evento.refresh_from_db()
                _save_link(
                    calendar,
                    link.evento,
                    item,
                    source_of_truth=GoogleEventLink.SOURCE_GOOGLE,
                )
                if changed:
                    summary["atualizados"] += 1
            else:
                summary["conflitos"] += 1
            continue

        local_event = _matching_local_event(calendar, item)
        if local_event:
            _save_link(
                calendar,
                local_event,
                item,
                source_of_truth=GoogleEventLink.SOURCE_GOOGLE,
            )
            summary["vinculados"] += 1
            continue
        imported_event = _create_imported_event(usuario, item)
        if imported_event:
            _save_link(
                calendar,
                imported_event,
                item,
                source_of_truth=GoogleEventLink.SOURCE_GOOGLE,
            )
            summary["importados"] += 1

    threshold = timezone.now() - timedelta(
        days=getattr(settings, "GOOGLE_SYNC_PAST_DAYS", 180)
    )
    local_events = (
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .filter(data_inicio__gte=threshold)
        .exclude(status__iexact="Cancelado")
    )
    for evento in local_events:
        link = GoogleEventLink.objects.filter(calendar=calendar, evento=evento).first()
        current_hash = _payload_hash(evento)
        if link and link.local_payload_hash == current_hash:
            continue
        payload = event_payload(evento)
        if link:
            try:
                item = _execute(
                    lambda link=link: service.events().update(
                        calendarId=calendar.calendar_id,
                        eventId=link.google_event_id,
                        body=payload,
                    ),
                    "Nao foi possivel atualizar evento local no Google.",
                )
            except GoogleApiError as exc:
                if _google_error_status(exc) not in {404, 410}:
                    raise
                link.delete()
                item = _execute(
                    lambda: service.events().insert(
                        calendarId=calendar.calendar_id, body=payload
                    ),
                    "Nao foi possivel recriar evento local no Google.",
                )
        else:
            item = _execute(
                lambda: service.events().insert(
                    calendarId=calendar.calendar_id, body=payload
                ),
                "Nao foi possivel exportar evento local para o Google.",
            )
        _save_link(
            calendar,
            evento,
            item,
            source_of_truth=GoogleEventLink.SOURCE_LOCAL,
        )
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
        "removidos": 0,
        "vinculados": 0,
        "conflitos": 0,
    }
    for calendar in enabled_calendars(usuario):
        result = sync_calendar(usuario, calendar, service)
        for key in (
            "importados",
            "atualizados",
            "exportados",
            "removidos",
            "vinculados",
            "conflitos",
        ):
            total[key] += result.get(key, 0)
    return total


def sync_single_calendar(calendar: GoogleCalendar) -> dict:
    service = calendar_service(calendar.account.usuario)
    return sync_calendar(calendar.account.usuario, calendar, service)
