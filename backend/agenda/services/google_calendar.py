from django.conf import settings
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


def obter_servico_google(usuario):
    """Recupera o serviço do Google Calendar quando o usuário tem tokens salvos."""
    token = getattr(usuario, "google_token", "") or ""
    refresh_token = getattr(usuario, "google_refresh_token", "") or ""
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "") or ""
    client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "") or ""

    if not token or not client_id or not client_secret:
        return None

    credenciais = Credentials(
        token=token,
        refresh_token=refresh_token or None,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
    )

    return build("calendar", "v3", credentials=credenciais, cache_discovery=False)


def evento_para_google(evento):
    """Converte o evento interno para o formato exigido pelo Google Calendar."""
    return {
        "summary": evento.titulo,
        "description": evento.descricao,
        "start": {
            "dateTime": evento.data_inicio.isoformat(),
            "timeZone": "America/Sao_Paulo",
        },
        "end": {
            "dateTime": evento.data_fim.isoformat(),
            "timeZone": "America/Sao_Paulo",
        },
    }


def criar_evento_google(usuario, evento):
    servico = obter_servico_google(usuario)
    if not servico:
        return None

    corpo = evento_para_google(evento)
    evento_google = servico.events().insert(calendarId="primary", body=corpo).execute()

    return evento_google.get("id")


def atualizar_evento_google(usuario, evento):
    if not evento.google_event_id:
        return criar_evento_google(usuario, evento)

    servico = obter_servico_google(usuario)
    if not servico:
        return None

    corpo = evento_para_google(evento)
    servico.events().update(
        calendarId="primary", eventId=evento.google_event_id, body=corpo
    ).execute()
    return evento.google_event_id


def deletar_evento_google(usuario, evento):
    if not evento.google_event_id:
        return

    servico = obter_servico_google(usuario)
    if not servico:
        return

    servico.events().delete(
        calendarId="primary", eventId=evento.google_event_id
    ).execute()


get_google_service = obter_servico_google
evento_to_google = evento_para_google
