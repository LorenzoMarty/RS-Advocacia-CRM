from datetime import datetime, time, timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from agenda.models import Evento
from clientes.models import Cliente
from processos.models import Processo


GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
GOOGLE_SYNC_CLIENT_NAME = "Google Agenda"
GOOGLE_SYNC_PROCESS_NUMBER = "GOOGLE-CALENDAR"
GOOGLE_SYNC_CREATED_BY = "Google Calendar"


def google_calendar_id():
    calendar_id = getattr(settings, "GOOGLE_CALENDAR_ID", "primary")
    return calendar_id.strip() or "primary"


def google_calendar_timezone():
    calendar_timezone = getattr(
        settings,
        "GOOGLE_CALENDAR_TIMEZONE",
        getattr(settings, "TIME_ZONE", "America/Sao_Paulo"),
    )
    return calendar_timezone.strip() or getattr(
        settings, "TIME_ZONE", "America/Sao_Paulo"
    )


def google_calendar_label():
    calendar_id = google_calendar_id()
    if calendar_id == "primary":
        return "agenda principal do Google"
    return calendar_id


def _persistir_credenciais_google(usuario, credenciais):
    if usuario is None:
        return

    update_fields = []

    token = credenciais.token or ""
    refresh_token = credenciais.refresh_token or ""

    if getattr(usuario, "google_token", "") != token:
        usuario.google_token = token
        update_fields.append("google_token")

    if refresh_token and getattr(usuario, "google_refresh_token", "") != refresh_token:
        usuario.google_refresh_token = refresh_token
        update_fields.append("google_refresh_token")

    if getattr(usuario, "google_token_expiry", None) != credenciais.expiry:
        usuario.google_token_expiry = credenciais.expiry
        update_fields.append("google_token_expiry")

    if update_fields:
        usuario.save(update_fields=update_fields)


def obter_servico_google(usuario):
    """Recupera o servico do Google Calendar quando o usuario tem tokens salvos."""
    if usuario is None:
        return None

    token = getattr(usuario, "google_token", "") or ""
    refresh_token = getattr(usuario, "google_refresh_token", "") or ""
    token_expiry = getattr(usuario, "google_token_expiry", None)
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "") or ""
    client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "") or ""

    if (not token and not refresh_token) or not client_id or not client_secret:
        return None

    credenciais = Credentials(
        token=token or None,
        refresh_token=refresh_token or None,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        expiry=token_expiry,
        scopes=[GOOGLE_CALENDAR_SCOPE],
    )

    if refresh_token and (not credenciais.token or credenciais.expired):
        credenciais.refresh(Request())
        _persistir_credenciais_google(usuario, credenciais)

    return build("calendar", "v3", credentials=credenciais, cache_discovery=False)


def evento_para_google(evento):
    """Converte o evento interno para o formato exigido pelo Google Calendar."""
    calendar_timezone = google_calendar_timezone()
    return {
        "summary": (evento.titulo or "").strip() or "Compromisso",
        "description": (evento.descricao or "").strip(),
        "location": (evento.local or "").strip(),
        "start": {
            "dateTime": evento.data_inicio.isoformat(),
            "timeZone": calendar_timezone,
        },
        "end": {
            "dateTime": evento.data_fim.isoformat(),
            "timeZone": calendar_timezone,
        },
    }


def _persistir_vinculo_google(evento, google_id):
    if not isinstance(evento, Evento):
        return

    google_id = (google_id or "").strip()
    if not google_id or evento.google_event_id == google_id:
        return

    evento.google_event_id = google_id
    evento.save(update_fields=["google_event_id"])


def criar_evento_google(usuario, evento):
    servico = obter_servico_google(usuario)
    if not servico:
        return None

    corpo = evento_para_google(evento)
    evento_google = servico.events().insert(
        calendarId=google_calendar_id(),
        body=corpo,
    ).execute()
    raw_google_id = evento_google.get("id")
    google_id = raw_google_id.strip() if isinstance(raw_google_id, str) else None
    _persistir_vinculo_google(evento, google_id)
    return google_id


def atualizar_evento_google(usuario, evento):
    if not evento.google_event_id:
        return criar_evento_google(usuario, evento)

    servico = obter_servico_google(usuario)
    if not servico:
        return None

    corpo = evento_para_google(evento)
    evento_google = servico.events().update(
        calendarId=google_calendar_id(),
        eventId=evento.google_event_id,
        body=corpo,
    ).execute()
    raw_google_id = evento_google.get("id")
    if isinstance(raw_google_id, str) and raw_google_id.strip():
        google_id = raw_google_id.strip()
    else:
        google_id = (evento.google_event_id or "").strip() or None
    _persistir_vinculo_google(evento, google_id)
    return google_id


def deletar_evento_google(usuario, evento):
    if not evento.google_event_id:
        return

    servico = obter_servico_google(usuario)
    if not servico:
        return

    servico.events().delete(
        calendarId=google_calendar_id(),
        eventId=evento.google_event_id,
    ).execute()


def _normalize_sync_text(value):
    return " ".join((value or "").split()).strip().casefold()


def _normalize_sync_datetime(value):
    if value is None:
        return ""
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_current_timezone())
    return timezone.localtime(value, timezone.get_current_timezone()).isoformat()


def _evento_sync_signature(evento):
    return (
        _normalize_sync_text(evento.titulo),
        _normalize_sync_text(evento.descricao),
        _normalize_sync_text(evento.local),
        _normalize_sync_datetime(evento.data_inicio),
        _normalize_sync_datetime(evento.data_fim),
    )


def _google_datetime(campo_data):
    if not isinstance(campo_data, dict):
        return None

    valor_datahora = str(campo_data.get("dateTime") or "").strip()
    if valor_datahora:
        parsed = parse_datetime(valor_datahora)
        if parsed is None:
            return None
        if timezone.is_naive(parsed):
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    valor_data = str(campo_data.get("date") or "").strip()
    if not valor_data:
        return None

    parsed_date = parse_date(valor_data)
    if parsed_date is None:
        return None

    return timezone.make_aware(
        datetime.combine(parsed_date, time.min),
        timezone.get_current_timezone(),
    )


def _google_event_range(evento_google):
    inicio = _google_datetime(evento_google.get("start") or {})
    fim = _google_datetime(evento_google.get("end") or {})

    if inicio is None:
        return None, None

    if fim is None or fim <= inicio:
        fim = inicio + timedelta(hours=1)

    return inicio, fim


def _google_sync_signature(evento_google):
    inicio, fim = _google_event_range(evento_google)
    if inicio is None or fim is None:
        return None

    return (
        _normalize_sync_text(evento_google.get("summary")),
        _normalize_sync_text(evento_google.get("description")),
        _normalize_sync_text(evento_google.get("location")),
        _normalize_sync_datetime(inicio),
        _normalize_sync_datetime(fim),
    )


def _google_event_id(evento_google):
    return str(evento_google.get("id") or "").strip()


def _google_event_status(evento_google):
    return str(evento_google.get("status") or "").strip().casefold()


def _ensure_google_sync_cliente():
    cliente = Cliente.objects.filter(nome=GOOGLE_SYNC_CLIENT_NAME).first()
    if cliente is not None:
        return cliente

    return Cliente.objects.create(
        nome=GOOGLE_SYNC_CLIENT_NAME,
        email="google-calendar@example.com",
        telefone="00000000000",
        cpf="000.000.000-00",
        tipo_cliente="esporadico",
        obs="Cliente tecnico criado para sincronizacao com Google Calendar.",
    )


def _ensure_google_sync_processo(responsavel_padrao):
    cliente = _ensure_google_sync_cliente()
    processo = Processo.objects.filter(
        numero_processo=GOOGLE_SYNC_PROCESS_NUMBER
    ).first()
    if processo is not None:
        return processo

    return Processo.objects.create(
        numero_processo=GOOGLE_SYNC_PROCESS_NUMBER,
        cliente=cliente,
        descricao="Processo tecnico para eventos sincronizados do Google Calendar.",
        vara="Google Calendar",
        area_juridica="Administrativo",
        status="Ativo",
        advogado_responsavel=(responsavel_padrao or GOOGLE_SYNC_CREATED_BY)[:100],
    )


def _responsavel_padrao(usuario):
    return (getattr(usuario, "nome", "") or GOOGLE_SYNC_CREATED_BY).strip()[:100]


def _campos_sync_google(evento_google):
    inicio, fim = _google_event_range(evento_google)
    return {
        "titulo": ((evento_google.get("summary") or "").strip() or "Compromisso Google")[:200],
        "descricao": (evento_google.get("description") or "").strip(),
        "data_inicio": inicio,
        "data_fim": fim,
        "local": (evento_google.get("location") or "").strip()[:200],
    }


def _aplicar_evento_google(evento, evento_google):
    campos = _campos_sync_google(evento_google)
    campos["google_event_id"] = _google_event_id(evento_google)

    update_fields = []
    for campo, valor in campos.items():
        if getattr(evento, campo) != valor:
            setattr(evento, campo, valor)
            update_fields.append(campo)

    if update_fields:
        evento.save(update_fields=update_fields)


def _criar_evento_local_partir_google(usuario, evento_google):
    processo = _ensure_google_sync_processo(_responsavel_padrao(usuario))
    evento = Evento(
        cliente=processo.cliente,
        processo=processo,
        tipo_evento="Reuniao",
        status="Agendado",
        prioridade="Media",
        responsavel=_responsavel_padrao(usuario),
        criado_por=GOOGLE_SYNC_CREATED_BY,
        observacoes="Sincronizado automaticamente do Google Calendar.",
        concluido=False,
        google_event_id=_google_event_id(evento_google),
        **_campos_sync_google(evento_google),
    )
    evento.save()
    return evento


def listar_eventos_google(usuario):
    servico = obter_servico_google(usuario)
    if not servico:
        return None

    eventos = []
    page_token = None

    while True:
        resposta = (
            servico.events()
            .list(
                calendarId=google_calendar_id(),
                pageToken=page_token,
                singleEvents=True,
                showDeleted=True,
                maxResults=2500,
            )
            .execute()
        )
        eventos.extend(resposta.get("items", []))
        page_token = resposta.get("nextPageToken")
        if not page_token:
            break

    return eventos


def sincronizar_agenda_google(usuario):
    resumo = {
        "conectado": False,
        "importados": 0,
        "atualizados": 0,
        "exportados": 0,
        "vinculados": 0,
        "removidos": 0,
    }

    eventos_google = listar_eventos_google(usuario)
    if eventos_google is None:
        return resumo

    resumo["conectado"] = True

    eventos_locais = list(
        Evento.objects.select_related("cliente", "processo").all()
    )
    locais_por_google_id = {
        evento.google_event_id: evento
        for evento in eventos_locais
        if (evento.google_event_id or "").strip()
    }
    locais_sem_vinculo_por_assinatura = {}
    for evento in eventos_locais:
        if (evento.google_event_id or "").strip():
            continue
        assinatura = _evento_sync_signature(evento)
        locais_sem_vinculo_por_assinatura.setdefault(assinatura, []).append(evento)

    for evento_google in eventos_google:
        google_id = _google_event_id(evento_google)
        if not google_id:
            continue

        evento_local = locais_por_google_id.get(google_id)
        if _google_event_status(evento_google) == "cancelled":
            if evento_local is not None:
                evento_local.delete()
                resumo["removidos"] += 1
            continue

        assinatura_google = _google_sync_signature(evento_google)
        if assinatura_google is None:
            continue

        if evento_local is not None:
            if _evento_sync_signature(evento_local) != assinatura_google:
                _aplicar_evento_google(evento_local, evento_google)
                resumo["atualizados"] += 1
            continue

        candidatos = locais_sem_vinculo_por_assinatura.get(assinatura_google) or []
        if candidatos:
            evento_local = candidatos.pop(0)
            _aplicar_evento_google(evento_local, evento_google)
            resumo["vinculados"] += 1
            continue

        _criar_evento_local_partir_google(usuario, evento_google)
        resumo["importados"] += 1

    for eventos_pendentes in locais_sem_vinculo_por_assinatura.values():
        for evento in eventos_pendentes:
            if criar_evento_google(usuario, evento):
                resumo["exportados"] += 1

    return resumo


get_google_service = obter_servico_google
evento_to_google = evento_para_google
