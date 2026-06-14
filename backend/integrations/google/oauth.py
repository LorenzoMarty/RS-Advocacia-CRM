from datetime import timedelta
from secrets import token_urlsafe
from urllib.parse import urlencode, urlsplit

import requests
from django.conf import settings
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.http import HttpRequest, HttpResponseRedirect
from django.urls import Resolver404, resolve, reverse
from django.utils import timezone
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token

from integrations.google.exceptions import (
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)
from integrations.models import GoogleAccount, GoogleCalendar
from usuarios.models import Usuario

AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = (
    "https://oauth2.googleapis.com/token"  # nosec B105 - public OAuth endpoint URL
)
STATE_SESSION_KEY = "google_oauth_state"
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
SCOPES = ("openid", "email", "profile", CALENDAR_SCOPE, DRIVE_SCOPE)


def client_id() -> str:
    value = getattr(settings, "GOOGLE_CLIENT_ID", "").strip()
    if not value:
        raise GoogleConfigurationError("Login com Google não configurado.")
    return value


def client_secret() -> str:
    value = getattr(settings, "GOOGLE_CLIENT_SECRET", "").strip()
    if not value:
        raise GoogleConfigurationError("Login com Google não configurado.")
    return value


def redirect_uri(request: HttpRequest) -> str:
    default_uri = request.build_absolute_uri(reverse("google_callback"))
    configured_uri = getattr(settings, "GOOGLE_REDIRECT_URI", "").strip()
    if not configured_uri:
        return default_uri

    candidate_path = (
        configured_uri
        if configured_uri.startswith("/")
        else urlsplit(configured_uri).path
    )
    try:
        resolve(candidate_path)
    except Resolver404:
        return default_uri
    return (
        request.build_absolute_uri(configured_uri)
        if configured_uri.startswith("/")
        else configured_uri
    )


def frontend_redirect(path: str = "/", params: dict[str, str] | None = None) -> str:
    frontend_url = getattr(settings, "FRONTEND_URL", "").strip().rstrip("/")
    if not frontend_url:
        frontend_url = settings.DEFAULT_REACT_ORIGINS[0]
    query = f"?{urlencode(params)}" if params else ""
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{frontend_url}/#{normalized_path}{query}"


def current_usuario(request: HttpRequest) -> Usuario | None:
    usuario_id = request.session.get("usuario_id")
    if usuario_id:
        usuario = Usuario.objects.filter(pk=usuario_id).first()
        if usuario is not None:
            return usuario

    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        identifier = getattr(user, "email", "") or getattr(user, "username", "")
        if identifier:
            return Usuario.objects.filter(email__iexact=identifier).first()
    return None


def begin_authorization(
    request: HttpRequest,
    *,
    force_consent: bool = False,
    next_path: str = "/",
) -> HttpResponseRedirect:
    configured_client_id = client_id()
    client_secret()
    state = token_urlsafe(32)
    initiating_user = current_usuario(request)
    request.session[STATE_SESSION_KEY] = {
        "value": state,
        "usuario_id": initiating_user.pk if initiating_user else None,
        "next": next_path if next_path.startswith("/") else "/",
    }

    query = {
        "client_id": configured_client_id,
        "redirect_uri": redirect_uri(request),
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        "access_type": "offline",
        "include_granted_scopes": "true",
    }
    query["prompt"] = "consent select_account"
    return HttpResponseRedirect(f"{AUTHORIZATION_URL}?{urlencode(query)}")


def consume_state(request: HttpRequest, received_state: str) -> dict:
    state_data = request.session.pop(STATE_SESSION_KEY, None)
    if (
        not isinstance(state_data, dict)
        or not received_state
        or received_state != state_data.get("value")
    ):
        raise ValueError("Sessao de login expirada. Tente novamente.")
    return state_data


def exchange_code(code: str, callback_uri: str) -> dict:
    response = requests.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": client_id(),
            "client_secret": client_secret(),
            "redirect_uri": callback_uri,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    if response.status_code != 200:
        raise ValueError("Nao foi possivel concluir o login com Google.")
    token_payload = response.json()
    if not token_payload.get("id_token") or not token_payload.get("access_token"):
        raise ValueError("Google não retornou as credenciais esperadas.")
    return token_payload


def _allowed_emails() -> set[str]:
    raw_value = getattr(settings, "GOOGLE_ALLOWED_EMAILS", "")
    return {
        email.strip().lower()
        for email in str(raw_value or "").replace(";", ",").split(",")
        if "@" in email.strip()
    }


def _hosted_domain() -> str:
    domain = getattr(settings, "GOOGLE_ALLOWED_HOSTED_DOMAIN", "").strip().lower()
    if not domain:
        return ""
    parsed = urlsplit(domain)
    if parsed.scheme or parsed.netloc or "/" in domain:
        raise ValueError(
            "GOOGLE_ALLOWED_HOSTED_DOMAIN deve ser um dominio Google Workspace."
        )
    return domain.removeprefix("@")


def verify_identity_token(credential: str) -> dict:
    try:
        claims = google_id_token.verify_oauth2_token(
            credential,
            GoogleRequest(),
            client_id(),
        )
    except ValueError as exc:
        raise ValueError("Token Google inválido.") from exc

    email = str(claims.get("email") or "").strip().lower()
    if not email or claims.get("email_verified") not in {True, "true", "True"}:
        raise ValueError("Conta Google sem e-mail verificado.")

    allowed_emails = _allowed_emails()
    if allowed_emails and email not in allowed_emails:
        raise ValueError("Conta Google fora dos e-mails permitidos.")

    hosted_domain = _hosted_domain()
    if hosted_domain and str(claims.get("hd") or "").lower() != hosted_domain:
        raise ValueError(f"Conta Google fora do dominio permitido ({hosted_domain}).")
    return claims


def _token_expiry(payload: dict):
    expires_in = payload.get("expires_in")
    if expires_in is None:
        return None
    try:
        return timezone.now() + timedelta(seconds=max(int(expires_in), 0))
    except (TypeError, ValueError):
        return None


def _resolve_usuario(claims: dict, initiating_user_id: int | None) -> Usuario:
    from usuarios.views import ESTAGIARIO_CARGO_NAME, _ensure_default_cargos

    sub = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    name = str(claims.get("name") or "").strip() or email.split("@")[0]
    picture = str(claims.get("picture") or "").strip()
    if not sub or not email:
        raise ValueError("Resposta inválida do Google.")

    existing_account = (
        GoogleAccount.objects.select_related("usuario")
        .filter(google_user_id=sub)
        .first()
    )
    if initiating_user_id:
        initiating_user = Usuario.objects.filter(pk=initiating_user_id).first()
        if initiating_user is None:
            raise ValueError("Usuário da sessão não encontrado.")
        if existing_account and existing_account.usuario_id != initiating_user.pk:
            raise ValueError("Esta conta Google ja esta vinculada a outro usuario.")
        if initiating_user.email.lower() != email and not existing_account:
            raise ValueError("Autorize a mesma conta Google usada no login.")
        usuario = initiating_user
    elif existing_account:
        usuario = existing_account.usuario
    else:
        found = Usuario.objects.filter(email__iexact=email).first()
        if found is None:
            _ensure_default_cargos()
            cargo = (
                getattr(settings, "GOOGLE_DEFAULT_CARGO", "").strip()
                or ESTAGIARIO_CARGO_NAME
            )
            usuario = Usuario.objects.create(nome=name, email=email, cargo=cargo)
        else:
            usuario = found

    update_fields = []
    if usuario.nome != name:
        usuario.nome = name
        update_fields.append("nome")
    if picture and usuario.picture != picture:
        usuario.picture = picture
        update_fields.append("picture")
    if update_fields:
        usuario.save(update_fields=update_fields)
    return usuario


def complete_authorization(
    request: HttpRequest, code: str, received_state: str
) -> tuple[Usuario, str]:
    from usuarios.views import _remember_usuario_session, _sync_usuario_auth

    state_data = consume_state(request, received_state)
    if not code:
        raise ValueError("Google não retornou o código de autorização.")
    token_payload = exchange_code(code, redirect_uri(request))
    claims = verify_identity_token(str(token_payload["id_token"]))
    usuario = _resolve_usuario(claims, state_data.get("usuario_id"))

    account, _ = GoogleAccount.objects.get_or_create(
        usuario=usuario,
        defaults={
            "google_user_id": str(claims["sub"]),
            "email": str(claims["email"]).lower(),
        },
    )
    if account.google_user_id != str(claims["sub"]):
        raise ValueError("Usuario vinculado a outra conta Google.")
    refresh_token = str(token_payload.get("refresh_token") or "").strip()
    if not refresh_token and not account.refresh_token:
        raise GoogleAuthorizationRequired(
            "Autorize novamente o Google para liberar acesso continuo ao Calendar."
        )
    account.email = str(claims["email"]).lower()
    account.store_tokens(
        access_token=str(token_payload["access_token"]),
        refresh_token=refresh_token or None,
        expiry=_token_expiry(token_payload),
        scopes=str(token_payload.get("scope") or " ".join(SCOPES)),
    )
    account.save()
    GoogleCalendar.objects.get_or_create(
        account=account,
        calendar_id=getattr(settings, "GOOGLE_CALENDAR_ID", "primary") or "primary",
        defaults={
            "summary": "Agenda principal do Google",
            "timezone": getattr(
                settings, "GOOGLE_CALENDAR_TIMEZONE", settings.TIME_ZONE
            ),
            "primary": getattr(settings, "GOOGLE_CALENDAR_ID", "primary") == "primary",
        },
    )

    if getattr(request.user, "is_authenticated", False):
        django_logout(request)
    auth_user = _sync_usuario_auth(usuario)
    django_login(
        request, auth_user, backend="django.contrib.auth.backends.ModelBackend"
    )
    _remember_usuario_session(request, usuario)
    return usuario, str(state_data.get("next") or "/")
