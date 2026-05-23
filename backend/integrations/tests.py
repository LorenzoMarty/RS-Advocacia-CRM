import requests
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlsplit

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from integrations.google.calendar import delete_remote_event, list_available_calendars, sync_agenda
from integrations.google.client import credentials_for_usuario
from integrations.google.exceptions import GoogleAuthorizationRequired
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
        self.assertIn("https://www.googleapis.com/auth/calendar.events", query["scope"][0])
        self.assertEqual(query["access_type"], ["offline"])
        self.assertEqual(query["include_granted_scopes"], ["true"])
        self.assertEqual(query["prompt"], ["consent select_account"])

    @override_settings(
        GOOGLE_CLIENT_ID="client-id",
        GOOGLE_CLIENT_SECRET="secret",
        GOOGLE_REDIRECT_URI=CALLBACK,
    )
    def test_reautorizacao_forca_consentimento_no_mesmo_fluxo(self):
        response = self.client.get(reverse("login_google"), {"force_consent": "1"})
        query = parse_qs(urlsplit(response["Location"]).query)

        self.assertEqual(query["prompt"], ["consent select_account"])

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
        session = self.client.session
        session["google_oauth_state"] = {"value": "state", "usuario_id": None, "next": "/"}
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
            advogado_responsavel=self.usuario.nome,
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
            responsavel=self.usuario.nome,
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

        self.assertFalse(
            GoogleCalendar.objects.get(calendar_id="secondary").enabled
        )

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
    def test_access_token_expirado_e_renovado_com_refresh_token(self, credentials_class):
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
