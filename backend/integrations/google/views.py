import logging

import requests
from django.http import HttpRequest, HttpResponseRedirect
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from core.permissions import app_permissions_required
from core.utils import (
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from integrations.google.calendar import (
    configure_calendars,
    list_available_calendars,
    sync_agenda,
)
from integrations.google.exceptions import (
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)
from integrations.google.oauth import (
    begin_authorization,
    complete_authorization,
    current_usuario,
    frontend_redirect,
)
from integrations.google.webhooks import ensure_watches, handle_notification

logger = logging.getLogger(__name__)


def login_google(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])
    try:
        return begin_authorization(
            request,
            next_path=request.GET.get("next", "/"),
            link_to_session=request.GET.get("vincular") == "1",
        )
    except GoogleConfigurationError as exc:
        return resposta_erro(str(exc), status=503)


def google_callback(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])
    if request.GET.get("error"):
        return HttpResponseRedirect(
            frontend_redirect("/login", {"google_error": "Login com Google cancelado."})
        )
    try:
        usuario, next_path = complete_authorization(
            request,
            str(request.GET.get("code") or "").strip(),
            str(request.GET.get("state") or "").strip(),
        )
    except GoogleAuthorizationRequired as exc:
        return HttpResponseRedirect(
            frontend_redirect(
                "/login",
                {"google_error": str(exc), "google_consent": "required"},
            )
        )
    except (GoogleConfigurationError, ValueError, requests.RequestException) as exc:
        return HttpResponseRedirect(
            frontend_redirect("/login", {"google_error": str(exc)})
        )
    try:
        sync_agenda(usuario)
        ensure_watches(usuario, request=request)
    except Exception:
        logger.exception("Falha ao sincronizar Google Calendar apos login.")
    params = {"google_calendar": "connected"} if next_path == "/agenda" else None
    return HttpResponseRedirect(frontend_redirect(next_path, params))


@app_permissions_required("agenda.view_evento")
def calendars(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])
    usuario = current_usuario(request)
    try:
        return resposta_sucesso({"calendarios": list_available_calendars(usuario)})
    except GoogleAuthorizationRequired as exc:
        return resposta_erro(str(exc), status=401)
    except Exception:
        logger.exception("Erro ao listar calendarios Google.")
        return resposta_erro(
            "Nao foi possivel listar os calendarios Google.", status=502
        )


@app_permissions_required("agenda.change_evento")
def calendar_selection(request: HttpRequest):
    if request.method != "PUT":
        return metodo_nao_permitido(["PUT"])
    try:
        payload = ler_corpo_json(request)
        configured = configure_calendars(
            current_usuario(request),
            payload.get("calendarios") or [],
        )
        usuario = current_usuario(request)
        sync_agenda(usuario)
        ensure_watches(usuario, request=request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)
    except GoogleAuthorizationRequired as exc:
        return resposta_erro(str(exc), status=401)
    except Exception:
        logger.exception("Erro ao configurar calendarios Google.")
        return resposta_erro(
            "Nao foi possivel configurar os calendarios Google.", status=502
        )
    return resposta_sucesso({"calendarios": configured})


@csrf_exempt
def google_calendar_webhook(request: HttpRequest):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])
    try:
        result = handle_notification(request.headers)
    except Exception:
        logger.exception("Erro ao processar webhook Google Calendar.")
        return resposta_erro(
            "Nao foi possivel processar notificacao Google.", status=202
        )
    return resposta_sucesso(result)


@app_permissions_required("agenda.view_evento")
def disconnect(request: HttpRequest):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])
    usuario = current_usuario(request)
    account = getattr(usuario, "google_account", None)
    if account is None:
        return resposta_sucesso(mensagem="Conta Google já desconectada.")
    token = account.refresh_token or account.access_token
    if token:
        try:
            response = requests.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": token},
                timeout=10,
            )
            if response.status_code not in {200, 400}:
                return resposta_erro(
                    "Nao foi possivel revogar o acesso Google agora. Tente novamente.",
                    status=502,
                )
        except requests.RequestException:
            logger.exception("Erro ao revogar acesso Google.")
            return resposta_erro(
                "Nao foi possivel revogar o acesso Google agora. Tente novamente.",
                status=502,
            )
    account.access_token_ciphertext = ""  # nosec B105 - clearing stored token on revoke
    account.refresh_token_ciphertext = (
        ""  # nosec B105 - clearing stored token on revoke
    )
    account.revoked_at = timezone.now()
    account.save(
        update_fields=[
            "access_token_ciphertext",
            "refresh_token_ciphertext",
            "revoked_at",
        ]
    )
    return resposta_sucesso(mensagem="Conta Google desconectada.")
