import json
from datetime import timedelta
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlsplit

import requests
from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from integrations.google.calendar import (
    delete_remote_event,
    list_available_calendars,
    sync_agenda,
)
from integrations.google.client import credentials_for_usuario
from integrations.google.exceptions import (
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)
from integrations.google.oauth import verify_identity_token
from integrations.google.webhooks import ensure_watch
from integrations.models import GoogleAccount, GoogleCalendar, GoogleEventLink
from processos.models import Processo
from usuarios.models import Usuario

CALLBACK = "http://testserver/api/auth/google/callback"


class GoogleOAuthTests(TestCase):
    @override_settings(GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="")
    def test_login_exige_configuracao(self):
        response = self.client.get(reverse("login_google"))

        self.assertEqual(response.status_code, 503)

    @override_settings(
        GOOGLE_CLIENT_ID="client-id",
        GOOGLE_CLIENT_SECRET="secret",
        GOOGLE_REDIRECT_URI=CALLBACK,
    )
    def test_login_unico_solicita_calendar_events_e_offline_com_consentimento(self):
        response = self.client.get(reverse("login_google"))
        query = parse_qs(urlsplit(response["Location"]).query)

        self.assertEqual(response.status_code, 302)
        self.assertIn(
            "https://www.googleapis.com/auth/calendar.events", query["scope"][0]
        )
        self.assertEqual(query["access_type"], ["offline"])
        self.assertEqual(query["include_granted_scopes"], ["true"])
        self.assertEqual(query["prompt"], ["consent select_account"])

    @override_settings(
        GOOGLE_CLIENT_ID="client-id",
        GOOGLE_CLIENT_SECRET="secret",
        GOOGLE_REDIRECT_URI=CALLBACK,
    )
    def test_login_ignora_sessao_ambiente_e_nao_vincula(self):
        # Sessão ambiente (ex.: auto-login demo) não pode transformar o login
        # em vínculo de conta — isso rejeitava e-mails diferentes no callback.
        usuario = Usuario.objects.create(
            nome="Sessao Demo", email="demo@example.com", cargo="Administrador"
        )
        session = self.client.session
        session["usuario_id"] = usuario.pk
        session.save()

        self.client.get(reverse("login_google"))

        state = self.client.session["google_oauth_state"]
        self.assertIsNone(state["usuario_id"])

    @override_settings(
        GOOGLE_CLIENT_ID="client-id",
        GOOGLE_CLIENT_SECRET="secret",
        GOOGLE_REDIRECT_URI=CALLBACK,
    )
    def test_vincular_explicito_usa_usuario_da_sessao(self):
        usuario = Usuario.objects.create(
            nome="Logado", email="logado@example.com", cargo="Administrador"
        )
        session = self.client.session
        session["usuario_id"] = usuario.pk
        session.save()

        self.client.get(reverse("login_google"), {"vincular": "1"})

        state = self.client.session["google_oauth_state"]
        self.assertEqual(state["usuario_id"], usuario.pk)

    @override_settings(
        GOOGLE_CLIENT_ID="client-id",
        GOOGLE_CLIENT_SECRET="secret",
        GOOGLE_REDIRECT_URI=CALLBACK,
        FRONTEND_URL="http://localhost:5173",
    )
    @patch("integrations.google.oauth.verify_identity_token")
    @patch("integrations.google.oauth.requests.post")
    @patch("integrations.google.views.ensure_watches", return_value=0)
    @patch("integrations.google.views.sync_agenda", return_value={"conectado": True})
    def test_callback_persiste_refresh_token_criptografado_e_cria_sessao(
        self,
        sync_agenda,
        ensure_watches,
        post,
        verify_token,
    ):
        Usuario.objects.create(
            nome="User", email="user@example.com", cargo="Administrador"
        )
        session = self.client.session
        session["google_oauth_state"] = {
            "value": "state",
            "usuario_id": None,
            "next": "/",
        }
        session.save()
        post.return_value.status_code = 200
        post.return_value.json.return_value = {
            "id_token": "id-token",
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
        }
        verify_token.return_value = {
            "sub": "google-sub",
            "email": "user@example.com",
            "email_verified": True,
            "name": "User",
        }

        response = self.client.get(
            reverse("google_callback"),
            {"code": "code", "state": "state"},
        )

        account = GoogleAccount.objects.get(google_user_id="google-sub")
        self.assertEqual(response.status_code, 302)
        self.assertNotEqual(account.refresh_token_ciphertext, "refresh-token")
        self.assertEqual(account.refresh_token, "refresh-token")
        self.assertTrue(account.calendars.filter(calendar_id="primary").exists())
        self.assertEqual(self.client.session["usuario_id"], account.usuario_id)

    @override_settings(
        GOOGLE_CLIENT_ID="client-id",
        GOOGLE_CLIENT_SECRET="secret",
        GOOGLE_REDIRECT_URI=CALLBACK,
        FRONTEND_URL="http://localhost:5173",
    )
    @patch("integrations.google.oauth.verify_identity_token")
    @patch("integrations.google.oauth.requests.post")
    def test_callback_recusa_email_nao_cadastrado_e_nao_cria_usuario(
        self, post, verify_token
    ):
        session = self.client.session
        session["google_oauth_state"] = {
            "value": "state",
            "usuario_id": None,
            "next": "/",
        }
        session.save()
        post.return_value.status_code = 200
        post.return_value.json.return_value = {
            "id_token": "id-token",
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
        }
        verify_token.return_value = {
            "sub": "google-sub-novo",
            "email": "desconhecido@example.com",
            "email_verified": True,
            "name": "Desconhecido",
        }

        response = self.client.get(
            reverse("google_callback"),
            {"code": "code", "state": "state"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn("google_error", response["Location"])
        self.assertFalse(
            Usuario.objects.filter(email="desconhecido@example.com").exists()
        )
        self.assertNotIn("usuario_id", self.client.session)

    @override_settings(
        GOOGLE_CLIENT_ID="client-id",
        GOOGLE_ALLOWED_HOSTED_DOMAIN="example.com",
    )
    @patch("integrations.google.oauth.google_id_token.verify_oauth2_token")
    def test_dominio_workspace_exige_claim_hd(self, verify_token):
        verify_token.return_value = {
            "sub": "sub",
            "email": "pessoa@example.com",
            "email_verified": True,
        }

        with self.assertRaises(ValueError):
            verify_identity_token("id-token")


class GoogleCalendarSyncTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada",
            email="advogada@example.com",
            cargo="Administrador",
        )
        self.account = GoogleAccount.objects.create(
            usuario=self.usuario,
            google_user_id="sub",
            email=self.usuario.email,
        )
        self.account.store_tokens(access_token="access", refresh_token="refresh")
        self.account.save()
        self.calendar = GoogleCalendar.objects.create(
            account=self.account,
            calendar_id="primary",
            summary="Principal",
        )
        cliente = Cliente.objects.create(
            nome="Cliente",
            email="c@example.com",
            telefone="11999999999",
            cpf="123.456.789-00",
            tipo_cliente="esporadico",
        )
        processo = Processo.objects.create(
            numero_processo="123",
            cliente=cliente,
            descricao="",
            vara="Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )
        self.evento = Evento.objects.create(
            titulo="Evento",
            descricao="",
            data_inicio="2026-06-23T09:00:00-03:00",
            data_fim="2026-06-23T10:00:00-03:00",
            tipo_evento="Reuniao",
            status="Agendado",
            prioridade="Media",
            cliente=cliente,
            processo=processo,
            responsavel=self.usuario,
            criado_por=self.usuario.nome,
            local="Online",
            observacoes="",
        )

    @patch("integrations.google.calendar.calendar_service")
    def test_sync_armazena_e_reutiliza_sync_token(self, calendar_service):
        service = MagicMock()
        calendar_service.return_value = service
        service.events.return_value.list.return_value.execute.return_value = {
            "items": [],
            "nextSyncToken": "token-1",
        }
        service.events.return_value.insert.return_value.execute.return_value = {
            "id": "google-event",
        }

        first = sync_agenda(self.usuario)
        self.calendar.refresh_from_db()
        service.events.return_value.list.reset_mock()
        service.events.return_value.list.return_value.execute.return_value = {
            "items": [],
            "nextSyncToken": "token-2",
        }
        second = sync_agenda(self.usuario)

        self.assertEqual(first["exportados"], 1)
        self.assertTrue(GoogleEventLink.objects.filter(evento=self.evento).exists())
        self.assertEqual(second["exportados"], 0)
        self.assertEqual(
            service.events.return_value.list.call_args.kwargs["syncToken"],
            "token-1",
        )

    @patch("integrations.google.calendar.calendar_service")
    def test_listar_calendarios_nao_habilita_agendas_novas(self, calendar_service):
        service = MagicMock()
        calendar_service.return_value = service
        service.calendarList.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "secondary", "summary": "Secundaria"}]
        }

        list_available_calendars(self.usuario)

        self.assertFalse(GoogleCalendar.objects.get(calendar_id="secondary").enabled)

    @patch("integrations.google.calendar.calendar_service")
    def test_primeiro_sync_vincula_evento_identico_sem_duplicar(self, calendar_service):
        service = MagicMock()
        calendar_service.return_value = service
        service.events.return_value.list.return_value.execute.return_value = {
            "items": [
                {
                    "id": "remote-existing",
                    "status": "confirmed",
                    "summary": "Evento",
                    "description": "",
                    "location": "Online",
                    "start": {"dateTime": "2026-06-23T09:00:00-03:00"},
                    "end": {"dateTime": "2026-06-23T10:00:00-03:00"},
                }
            ],
            "nextSyncToken": "token",
        }

        result = sync_agenda(self.usuario)

        self.assertEqual(result["vinculados"], 1)
        self.assertEqual(Evento.objects.count(), 1)
        service.events.return_value.insert.assert_not_called()

    @patch("integrations.google.calendar.calendar_service")
    def test_evento_importado_sem_correspondencia_fica_sem_cliente_e_processo(
        self, calendar_service
    ):
        """Compromisso pessoal do Google Calendar não vira um cliente/processo fake.

        Antes de 2026-07, todo item importado sem par local era preso a um
        cliente e processo técnicos sintéticos ("Google Agenda" /
        "GOOGLE-CALENDAR"), o que fazia esse cliente acumular dezenas de
        compromissos sem nenhuma relação real com ele.
        """
        # Remove o evento local do setUp: aqui o interesse é isolado no
        # comportamento de importação, não na exportação de eventos locais
        # (já coberta por outros testes desta classe).
        self.evento.delete()

        service = MagicMock()
        calendar_service.return_value = service
        clientes_antes = Cliente.objects.count()
        service.events.return_value.list.return_value.execute.return_value = {
            "items": [
                {
                    "id": "remote-personal",
                    "status": "confirmed",
                    "summary": "Dentista",
                    "description": "",
                    "location": "",
                    "updated": "2026-06-24T12:00:00Z",
                    "start": {"dateTime": "2026-06-24T14:00:00-03:00"},
                    "end": {"dateTime": "2026-06-24T15:00:00-03:00"},
                }
            ],
            "nextSyncToken": "token",
        }
        # O evento recém-importado pode não bater o hash local exatamente após
        # o round-trip de timezone, então o sync tenta sincronizá-lo de volta
        # ao Google na mesma rodada (comportamento pré-existente do export).
        remote_response = {
            "id": "remote-personal",
            "etag": "etag-1",
            "updated": "2026-06-24T12:00:00Z",
        }
        service.events.return_value.insert.return_value.execute.return_value = (
            remote_response
        )
        service.events.return_value.update.return_value.execute.return_value = (
            remote_response
        )

        result = sync_agenda(self.usuario)

        self.assertEqual(result["importados"], 1)
        importado = Evento.objects.get(titulo="Dentista")
        self.assertIsNone(importado.cliente_id)
        self.assertIsNone(importado.processo_id)
        # Não deve mais criar um cliente/processo técnico para abrigar o evento.
        self.assertEqual(Cliente.objects.count(), clientes_antes)

    @patch("integrations.google.calendar.calendar_service")
    def test_delete_no_google_remove_evento_interno(self, calendar_service):
        GoogleEventLink.objects.create(
            calendar=self.calendar,
            evento=self.evento,
            google_event_id="remote-existing",
        )
        service = MagicMock()
        calendar_service.return_value = service
        service.events.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "remote-existing", "status": "cancelled"}],
            "nextSyncToken": "token",
        }

        result = sync_agenda(self.usuario)

        self.assertEqual(result["removidos"], 1)
        self.assertFalse(Evento.objects.filter(pk=self.evento.pk).exists())

    @patch("integrations.google.client.Credentials")
    def test_access_token_expirado_e_renovado_com_refresh_token(
        self, credentials_class
    ):
        self.account.token_expiry = timezone.now()
        self.account.save(update_fields=["token_expiry"])

        credentials = MagicMock(
            valid=False,
            token="old-access",
            refresh_token="refresh",
            expiry=None,
        )

        def update_token(request):
            credentials.token = "new-access"

        credentials.refresh.side_effect = update_token
        credentials_class.return_value = credentials
        credentials_for_usuario(self.usuario)
        self.account.refresh_from_db()

        self.assertEqual(self.account.access_token, "new-access")
        credentials.refresh.assert_called_once()

    @patch("integrations.google.client.Credentials")
    def test_expiry_aware_e_convertido_para_naive_utc(self, credentials_class):
        self.account.token_expiry = timezone.now() + timedelta(hours=1)
        self.account.save(update_fields=["token_expiry"])
        credentials = MagicMock(valid=True)
        credentials_class.return_value = credentials

        credentials_for_usuario(self.usuario)

        expiry = credentials_class.call_args.kwargs["expiry"]
        self.assertIsNotNone(expiry)
        self.assertIsNone(expiry.tzinfo)

    def test_exclusao_de_evento_vinculado_exige_reautorizacao_se_conta_revogada(self):
        GoogleEventLink.objects.create(
            calendar=self.calendar,
            evento=self.evento,
            google_event_id="remote-remove",
        )
        self.account.revoked_at = timezone.now()
        self.account.save(update_fields=["revoked_at"])

        with self.assertRaises(GoogleAuthorizationRequired):
            delete_remote_event(self.usuario, self.evento)


class GoogleDisconnectTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada",
            email="advogada@example.com",
            cargo="Administrador",
        )
        self.account = GoogleAccount.objects.create(
            usuario=self.usuario,
            google_user_id="disconnect-sub",
            email=self.usuario.email,
        )
        self.account.store_tokens(access_token="access", refresh_token="refresh")
        self.account.save()
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email,
            email=self.usuario.email,
        )
        self.client.force_login(auth_user)

    @patch(
        "integrations.google.views.requests.post",
        side_effect=requests.RequestException("network error"),
    )
    def test_desconexao_mantem_token_quando_revogacao_falha(self, revoke):
        response = self.client.post(reverse("google_disconnect"))
        self.account.refresh_from_db()

        self.assertEqual(response.status_code, 502)
        self.assertEqual(self.account.refresh_token, "refresh")

    @patch("integrations.google.views.requests.post")
    def test_desconexao_limpa_tokens_apos_revogacao(self, revoke):
        revoke.return_value.status_code = 200

        response = self.client.post(reverse("google_disconnect"))
        self.account.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.account.refresh_token, "")
        self.assertIsNotNone(self.account.revoked_at)


class GoogleWebhookTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada",
            email="advogada@example.com",
            cargo="Administrador",
        )
        self.account = GoogleAccount.objects.create(
            usuario=self.usuario,
            google_user_id="webhook-sub",
            email=self.usuario.email,
        )
        self.account.store_tokens(access_token="access", refresh_token="refresh")
        self.account.save()
        self.calendar = GoogleCalendar.objects.create(
            account=self.account,
            calendar_id="primary",
            summary="Principal",
            watch_channel_id="channel",
            watch_resource_id="resource",
            watch_token="token",
        )

    @patch(
        "integrations.google.webhooks.sync_single_calendar",
        return_value={"importados": 1},
    )
    def test_webhook_sincroniza_calendario_pelo_canal(self, sync_single_calendar):
        response = self.client.post(
            reverse("google_calendar_webhook"),
            HTTP_X_GOOG_CHANNEL_ID="channel",
            HTTP_X_GOOG_CHANNEL_TOKEN="token",
            HTTP_X_GOOG_RESOURCE_ID="resource",
            HTTP_X_GOOG_RESOURCE_STATE="exists",
        )

        self.assertEqual(response.status_code, 200, response.json())
        sync_single_calendar.assert_called_once_with(self.calendar)

    @patch("integrations.google.webhooks.sync_single_calendar")
    def test_webhook_sync_inicial_apenas_confirma_canal(self, sync_single_calendar):
        response = self.client.post(
            reverse("google_calendar_webhook"),
            HTTP_X_GOOG_CHANNEL_ID="channel",
            HTTP_X_GOOG_CHANNEL_TOKEN="token",
            HTTP_X_GOOG_RESOURCE_ID="resource",
            HTTP_X_GOOG_RESOURCE_STATE="sync",
        )

        self.assertEqual(response.status_code, 200, response.json())
        sync_single_calendar.assert_not_called()

    @override_settings(
        GOOGLE_CALENDAR_WEBHOOK_URL="https://backend.example.com/api/integracoes/google/calendar/webhook"
    )
    @patch("integrations.google.webhooks.calendar_service")
    def test_ensure_watch_registra_canal_google(self, calendar_service):
        service = MagicMock()
        calendar_service.return_value = service
        service.events.return_value.watch.return_value.execute.return_value = {
            "resourceId": "resource-new",
            "expiration": str(int((timezone.now().timestamp() + 3600) * 1000)),
        }

        created = ensure_watch(self.usuario, self.calendar)
        self.calendar.refresh_from_db()

        self.assertTrue(created)
        self.assertEqual(self.calendar.watch_resource_id, "resource-new")
        service.events.return_value.watch.assert_called_once()


class GoogleLoginAndCallbackViewTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="adv@example.com", cargo="Administrador"
        )

    def test_login_rejeita_post(self):
        self.assertEqual(self.client.post(reverse("login_google")).status_code, 405)

    def test_callback_rejeita_post(self):
        self.assertEqual(self.client.post(reverse("google_callback")).status_code, 405)

    def test_callback_cancelado_redireciona_para_login_com_erro(self):
        response = self.client.get(reverse("google_callback"), {"error": "access_denied"})
        self.assertEqual(response.status_code, 302)
        query = parse_qs(urlsplit(response["Location"]).query)
        self.assertEqual(query["google_error"], ["Login com Google cancelado."])
        self.assertIn("/login", urlsplit(response["Location"]).path)

    @patch("integrations.google.views.complete_authorization")
    def test_callback_erros_conhecidos_redirecionam_para_login(self, complete):
        casos = [
            (GoogleAuthorizationRequired("sem consentimento"), True),
            (GoogleConfigurationError("sem config"), False),
            (ValueError("state invalido"), False),
            (requests.RequestException("rede"), False),
        ]
        for exc, pede_consentimento in casos:
            with self.subTest(exc=type(exc).__name__):
                complete.side_effect = exc
                response = self.client.get(
                    reverse("google_callback"), {"code": "c", "state": "s"}
                )
                self.assertEqual(response.status_code, 302)
                query = parse_qs(urlsplit(response["Location"]).query)
                self.assertEqual(query["google_error"], [str(exc)])
                self.assertEqual(
                    query.get("google_consent") == ["required"], pede_consentimento
                )

    @patch("integrations.google.views.ensure_watches")
    @patch("integrations.google.views.sync_agenda")
    @patch("integrations.google.views.complete_authorization")
    def test_callback_sucesso_sincroniza_e_marca_agenda_conectada(
        self, complete, sync, watches
    ):
        complete.return_value = (self.usuario, "/agenda")
        response = self.client.get(reverse("google_callback"), {"code": "c", "state": "s"})
        self.assertEqual(response.status_code, 302)
        destino = urlsplit(response["Location"])
        self.assertEqual(destino.path, "/agenda")
        self.assertEqual(parse_qs(destino.query), {"google_calendar": ["connected"]})
        sync.assert_called_once_with(self.usuario)
        watches.assert_called_once()

    @patch("integrations.google.views.sync_agenda", side_effect=RuntimeError("boom"))
    @patch("integrations.google.views.complete_authorization")
    def test_callback_segue_para_destino_mesmo_se_sync_falhar(self, complete, _sync):
        complete.return_value = (self.usuario, "/processos")
        with self.assertLogs("integrations.google.views", level="ERROR"):
            response = self.client.get(
                reverse("google_callback"), {"code": "c", "state": "s"}
            )
        self.assertEqual(response.status_code, 302)
        destino = urlsplit(response["Location"])
        self.assertEqual(destino.path, "/processos")
        self.assertEqual(destino.query, "")


class GoogleCalendarViewsTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="cal@example.com", cargo="Administrador"
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email, email=self.usuario.email
        )
        self.client.force_login(auth_user)

    def _put(self, body):
        return self.client.put(
            reverse("google_calendar_selection"),
            data=json.dumps(body),
            content_type="application/json",
        )

    @patch("integrations.google.views.list_available_calendars")
    def test_listar_calendarios(self, listar):
        url = reverse("google_calendars")
        listar.return_value = [{"id": "c1", "summary": "Agenda"}]
        ok = self.client.get(url)
        self.assertEqual(ok.json()["dados"]["calendarios"][0]["id"], "c1")
        self.assertEqual(self.client.post(url).status_code, 405)

        listar.side_effect = GoogleAuthorizationRequired("reautorize")
        self.assertEqual(self.client.get(url).status_code, 401)
        listar.side_effect = RuntimeError("api fora")
        with self.assertLogs("integrations.google.views", level="ERROR"):
            self.assertEqual(self.client.get(url).status_code, 502)

    @patch("integrations.google.views.ensure_watches")
    @patch("integrations.google.views.sync_agenda")
    @patch("integrations.google.views.configure_calendars")
    def test_selecionar_calendarios_configura_sincroniza_e_observa(
        self, configure, sync, watches
    ):
        configure.return_value = [{"id": "c1", "enabled": True}]
        response = self._put({"calendarios": [{"id": "c1"}]})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["dados"]["calendarios"][0]["id"], "c1")
        self.assertEqual(configure.call_args.args[1], [{"id": "c1"}])
        sync.assert_called_once()
        watches.assert_called_once()

    @patch("integrations.google.views.configure_calendars")
    def test_selecionar_calendarios_erros(self, configure):
        self.assertEqual(self.client.get(reverse("google_calendar_selection")).status_code, 405)
        invalido = self.client.put(
            reverse("google_calendar_selection"),
            data="nao-json",
            content_type="application/json",
        )
        self.assertEqual(invalido.status_code, 400)

        configure.side_effect = ValueError("calendario desconhecido")
        self.assertEqual(self._put({"calendarios": ["x"]}).status_code, 400)
        configure.side_effect = GoogleAuthorizationRequired("reautorize")
        self.assertEqual(self._put({"calendarios": []}).status_code, 401)
        configure.side_effect = RuntimeError("api fora")
        with self.assertLogs("integrations.google.views", level="ERROR"):
            self.assertEqual(self._put({"calendarios": []}).status_code, 502)


class GoogleWebhookViewTests(TestCase):
    def test_rejeita_get(self):
        self.assertEqual(self.client.get(reverse("google_calendar_webhook")).status_code, 405)

    @patch("integrations.google.views.handle_notification")
    def test_aceita_post_sem_csrf_e_repassa_headers(self, handle):
        handle.return_value = {"status": "ok"}
        client = Client(enforce_csrf_checks=True)
        response = client.post(
            reverse("google_calendar_webhook"), HTTP_X_GOOG_CHANNEL_ID="canal-1"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["dados"], {"status": "ok"})
        self.assertEqual(handle.call_args.args[0]["X-Goog-Channel-Id"], "canal-1")

    @patch("integrations.google.views.handle_notification", side_effect=RuntimeError("x"))
    def test_falha_interna_responde_202_para_google_nao_reenviar(self, _handle):
        with self.assertLogs("integrations.google.views", level="ERROR"):
            response = self.client.post(reverse("google_calendar_webhook"))
        self.assertEqual(response.status_code, 202)


class GoogleDisconnectEdgeCaseTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Adv", email="disc@example.com", cargo="Administrador"
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email, email=self.usuario.email
        )
        self.client.force_login(auth_user)

    def test_sem_conta_google_responde_sucesso(self):
        response = self.client.post(reverse("google_disconnect"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("já desconectada", response.json()["mensagem"])

    def test_rejeita_get(self):
        self.assertEqual(self.client.get(reverse("google_disconnect")).status_code, 405)

    def _conta(self, **tokens):
        account = GoogleAccount.objects.create(
            usuario=self.usuario, google_user_id="sub-edge", email=self.usuario.email
        )
        if tokens:
            account.store_tokens(**tokens)
            account.save()
        return account

    @patch("integrations.google.views.requests.post")
    def test_status_inesperado_da_revogacao_preserva_tokens(self, revoke):
        revoke.return_value.status_code = 500
        account = self._conta(access_token="a", refresh_token="r")
        response = self.client.post(reverse("google_disconnect"))
        account.refresh_from_db()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(account.refresh_token, "r")
        self.assertIsNone(account.revoked_at)

    @patch("integrations.google.views.requests.post")
    def test_token_ja_invalido_400_tambem_limpa_tokens(self, revoke):
        revoke.return_value.status_code = 400
        account = self._conta(access_token="a", refresh_token="r")
        response = self.client.post(reverse("google_disconnect"))
        account.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(account.refresh_token, "")
        self.assertIsNotNone(account.revoked_at)

    @patch("integrations.google.views.requests.post")
    def test_conta_sem_token_nao_chama_google(self, revoke):
        account = self._conta()
        response = self.client.post(reverse("google_disconnect"))
        account.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        revoke.assert_not_called()
        self.assertIsNotNone(account.revoked_at)
