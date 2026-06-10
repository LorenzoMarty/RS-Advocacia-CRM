from datetime import timezone as datetime_timezone

from django.conf import settings
from django.utils import timezone
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from integrations.google.exceptions import GoogleAuthorizationRequired
from integrations.google.oauth import CALENDAR_SCOPE, DRIVE_SCOPE
from integrations.models import GoogleAccount


def account_for_usuario(usuario) -> GoogleAccount:
    try:
        account = usuario.google_account
    except (AttributeError, GoogleAccount.DoesNotExist) as exc:
        raise GoogleAuthorizationRequired("Conta Google nao conectada.") from exc
    if not account.connected:
        raise GoogleAuthorizationRequired("Autorize novamente o Google Calendar.")
    return account


def credentials_for_usuario(usuario) -> Credentials:
    account = account_for_usuario(usuario)
    expiry = account.token_expiry
    if expiry is not None and timezone.is_aware(expiry):
        expiry = expiry.astimezone(datetime_timezone.utc).replace(tzinfo=None)
    credentials = Credentials(
        token=account.access_token or None,
        refresh_token=account.refresh_token or None,
        token_uri="https://oauth2.googleapis.com/token",  # nosec B106 - public OAuth endpoint URL
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        expiry=expiry,
        scopes=[CALENDAR_SCOPE, DRIVE_SCOPE],
    )
    try:
        if not credentials.valid:
            credentials.refresh(Request())
            account.store_tokens(
                access_token=credentials.token or "",
                refresh_token=credentials.refresh_token,
                expiry=credentials.expiry,
                scopes=account.scopes,
            )
            account.save()
    except RefreshError as exc:
        account.revoked_at = timezone.now()
        account.save(update_fields=["revoked_at", "updated_at"])
        raise GoogleAuthorizationRequired(
            "A autorizacao Google foi revogada ou expirou. Autorize novamente."
        ) from exc
    return credentials


def calendar_service(usuario):
    return build(
        "calendar",
        "v3",
        credentials=credentials_for_usuario(usuario),
        cache_discovery=False,
    )


def drive_service(usuario):
    return build(
        "drive",
        "v3",
        credentials=credentials_for_usuario(usuario),
        cache_discovery=False,
    )
