from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from agenda.models import Evento
from integrations.google import calendar as gcal
from integrations.google.exceptions import GoogleApiError, GoogleAuthorizationRequired
from integrations.models import GoogleAccount, GoogleCalendar, GoogleEventLink
from integrations.tests_drive import FakeRequest, _http_error
from usuarios.models import Usuario


class CalendarHelpersTests(SimpleTestCase):
    def test_item_sequence_parses_or_returns_none(self):
        self.assertEqual(gcal._item_sequence({"sequence": "3"}), 3)
        self.assertIsNone(gcal._item_sequence({}))
        self.assertIsNone(gcal._item_sequence({"sequence": "x"}))

    @override_settings(GOOGLE_CALENDAR_TIMEZONE="America/Sao_Paulo")
    def test_item_timezone_prefers_start_then_end_then_setting(self):
        self.assertEqual(
            gcal._item_timezone({"start": {"timeZone": "UTC"}, "end": {"timeZone": "X"}}),
            "UTC",
        )
        self.assertEqual(gcal._item_timezone({"end": {"timeZone": "Europe/Lisbon"}}), "Europe/Lisbon")
        self.assertEqual(gcal._item_timezone({}), "America/Sao_Paulo")

    @override_settings(GOOGLE_CALENDAR_TIMEZONE="America/Sao_Paulo")
    def test_google_datetime_handles_date_only_datetime_and_garbage(self):
        all_day = gcal._google_datetime({"date": "2030-01-02"})
        self.assertEqual((all_day.hour, all_day.utcoffset()), (0, timedelta(hours=-3)))
        timed = gcal._google_datetime({"dateTime": "2030-01-02T10:00:00-03:00"})
        self.assertEqual(timed.hour, 10)
        self.assertTrue(timezone.is_aware(gcal._google_datetime({"dateTime": "2030-01-02T10:00:00"})))
        self.assertIsNone(gcal._google_datetime(None))
        self.assertIsNone(gcal._google_datetime({"date": "nope"}))
        self.assertIsNone(gcal._google_datetime({"dateTime": "nope"}))

    def test_remote_fields_defaults_and_end_fix(self):
        fields = gcal._remote_fields(
            {
                "start": {"dateTime": "2030-01-02T10:00:00+00:00"},
                "end": {"dateTime": "2030-01-02T09:00:00+00:00"},
            }
        )
        self.assertEqual(fields["titulo"], "Evento Google")
        self.assertEqual(fields["data_fim"] - fields["data_inicio"], timedelta(hours=1))
        self.assertIsNone(gcal._remote_fields({"summary": "sem inicio"}))

    def test_item_updated_at_is_aware_or_none(self):
        self.assertTrue(timezone.is_aware(gcal._item_updated_at({"updated": "2030-01-01T00:00:00Z"})))
        self.assertIsNone(gcal._item_updated_at({}))

    def test_execute_retries_transient_errors_then_gives_up(self):
        calls = [FakeRequest(error=_http_error(503)), FakeRequest({"ok": 1})]
        with patch("integrations.google.calendar.time_module.sleep"):
            self.assertEqual(gcal._execute(lambda: calls.pop(0), "msg"), {"ok": 1})
        with self.assertRaises(GoogleApiError):
            gcal._execute(lambda: FakeRequest(error=_http_error(403)), "msg")


class CalendarTestBase(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="cal@example.com", cargo="Administrador"
        )
        self.account = GoogleAccount.objects.create(
            usuario=self.usuario, google_user_id="sub-cal", email=self.usuario.email
        )
        self.account.store_tokens(access_token="a", refresh_token="r")
        self.account.save()
        self.calendar = GoogleCalendar.objects.create(
            account=self.account, calendar_id="primary", summary="Principal", enabled=True
        )
        self.service = MagicMock()
        # Default echo behaviour so incidental exports (e.g. re-pushing an
        # imported event) don't hand MagicMocks to the code under test.
        self.service.events().update.side_effect = lambda **kw: FakeRequest(
            {"id": kw["eventId"], "etag": "e", "updated": "2030-01-01T00:00:00Z"}
        )
        self.service.events().insert.side_effect = lambda **kw: FakeRequest(
            {"id": f"ins-{kw['body']['summary']}", "etag": "e", "updated": "2030-01-01T00:00:00Z"}
        )

    def _stub(self, name, value):
        method = getattr(self.service.events(), name)
        method.side_effect = None
        method.return_value = value

    def _evento(self, titulo="Local", offset_days=1, **extra):
        inicio = timezone.now() + timedelta(days=offset_days)
        data = {
            "titulo": titulo,
            "descricao": "",
            "data_inicio": inicio,
            "data_fim": inicio + timedelta(hours=1),
            "tipo_evento": "Reuniao",
            "status": "Agendado",
            "prioridade": "Media",
            "responsavel": self.usuario,
            "criado_por": "teste",
            "local": "",
            "observacoes": "",
        }
        data.update(extra)
        return Evento.objects.create(**data)

    def _remote(self, google_id="g1", **extra):
        item = {
            "id": google_id,
            "etag": "e1",
            "summary": "Remoto",
            "start": {"dateTime": "2030-01-02T10:00:00-03:00"},
            "end": {"dateTime": "2030-01-02T11:00:00-03:00"},
            "updated": "2030-01-01T00:00:00Z",
        }
        item.update(extra)
        return item

    def _list_returns(self, *pages):
        self.service.events().list.side_effect = [FakeRequest(p) for p in pages]


class CalendarSetupTests(CalendarTestBase):
    def test_calendar_label_uses_enabled_calendar_or_default(self):
        self.usuario.refresh_from_db()
        self.assertEqual(gcal.calendar_label(self.usuario), "Principal")
        self.assertEqual(gcal.calendar_label(None), "primary")
        self.calendar.enabled = False
        self.calendar.save()
        self.assertEqual(gcal.calendar_label(Usuario.objects.get(pk=self.usuario.pk)), "primary")

    def test_enabled_calendars_falls_back_to_default_calendar(self):
        self.calendar.delete()
        calendars = gcal.enabled_calendars(self.usuario)
        self.assertEqual([c.calendar_id for c in calendars], ["primary"])
        self.assertEqual(gcal.enabled_calendars(self.usuario)[0].pk, calendars[0].pk)

    @patch("integrations.google.calendar.calendar_service")
    def test_list_available_calendars_paginates_and_updates_existing(self, service_factory):
        service_factory.return_value = self.service
        self.service.calendarList().list.side_effect = [
            FakeRequest(
                {
                    "items": [{"id": "primary", "summary": "Renomeada", "primary": True}],
                    "nextPageToken": "p2",
                }
            ),
            FakeRequest({"items": [{"id": "outra", "summary": "Outra", "timeZone": "UTC"}]}),
        ]
        result = gcal.list_available_calendars(self.usuario)
        self.assertEqual([c["id"] for c in result], ["primary", "outra"])
        self.calendar.refresh_from_db()
        self.assertEqual(self.calendar.summary, "Renomeada")
        self.assertTrue(self.calendar.enabled)
        self.assertFalse(result[1]["enabled"])

    @patch("integrations.google.webhooks.stop_watch")
    @patch("integrations.google.calendar.calendar_service")
    def test_configure_calendars_validates_and_switches_selection(self, service_factory, stop_watch):
        service_factory.return_value = self.service
        self.service.calendarList().list.return_value = FakeRequest(
            {"items": [{"id": "primary"}, {"id": "outra"}]}
        )
        with self.assertRaises(ValueError):
            gcal.configure_calendars(self.usuario, [])
        with self.assertRaises(ValueError):
            gcal.configure_calendars(self.usuario, ["desconhecida"])

        self.calendar.watch_channel_id = "canal"
        self.calendar.set_sync_token("tok")
        self.calendar.save()
        result = gcal.configure_calendars(self.usuario, ["outra"])

        stop_watch.assert_called_once()
        enabled = {c["id"]: c["enabled"] for c in result}
        self.assertEqual(enabled, {"primary": False, "outra": True})
        self.calendar.refresh_from_db()
        self.assertEqual((self.calendar.watch_channel_id, self.calendar.sync_token), ("", ""))


class SyncLocalAndDeleteTests(CalendarTestBase):
    @patch("integrations.google.calendar.calendar_service")
    def test_sync_local_event_inserts_then_updates(self, service_factory):
        service_factory.return_value = self.service
        evento = self._evento()
        self._stub("insert", FakeRequest({"id": "g-1", "etag": "e"}))
        self.assertEqual(gcal.sync_local_event(self.usuario, evento), 1)
        link = GoogleEventLink.objects.get(evento=evento)
        self.assertEqual(link.google_event_id, "g-1")
        self.assertEqual(link.source_of_truth, GoogleEventLink.SOURCE_LOCAL)

        self._stub("update", FakeRequest({"id": "g-1", "etag": "e2"}))
        gcal.sync_local_event(self.usuario, evento)
        self.assertEqual(self.service.events().update.call_args.kwargs["eventId"], "g-1")
        link.refresh_from_db()
        self.assertEqual((link.etag, link.sync_version), ("e2", 2))

    @patch("integrations.google.calendar.calendar_service")
    def test_sync_local_event_recreates_when_remote_copy_is_gone(self, service_factory):
        service_factory.return_value = self.service
        evento = self._evento()
        GoogleEventLink.objects.create(
            calendar=self.calendar, evento=evento, google_event_id="velho"
        )
        self._stub("update", FakeRequest(error=_http_error(404)))
        self._stub("insert", FakeRequest({"id": "novo"}))
        gcal.sync_local_event(self.usuario, evento)
        ids = list(GoogleEventLink.objects.filter(evento=evento).values_list("google_event_id", flat=True))
        self.assertEqual(ids, ["novo"])

    @patch("integrations.google.calendar.calendar_service")
    def test_sync_local_event_propagates_other_errors(self, service_factory):
        service_factory.return_value = self.service
        evento = self._evento()
        GoogleEventLink.objects.create(calendar=self.calendar, evento=evento, google_event_id="g")
        self._stub("update", FakeRequest(error=_http_error(403)))
        with self.assertRaises(GoogleApiError):
            gcal.sync_local_event(self.usuario, evento)
        self.service.events().insert.assert_not_called()

    @patch("integrations.google.calendar.calendar_service")
    def test_delete_remote_event_paths(self, service_factory):
        service_factory.return_value = self.service
        evento = self._evento()
        self.assertEqual(gcal.delete_remote_event(Usuario(nome="x", email="x@x"), evento), 0)
        self.assertEqual(gcal.delete_remote_event(self.usuario, evento), 0)

        GoogleEventLink.objects.create(calendar=self.calendar, evento=evento, google_event_id="g1")
        self._stub("delete", FakeRequest({}))
        self.assertEqual(gcal.delete_remote_event(self.usuario, evento), 1)

        self._stub("delete", FakeRequest(error=_http_error(404)))
        self.assertEqual(gcal.delete_remote_event(self.usuario, evento), 1)

        self._stub("delete", FakeRequest(error=_http_error(403)))
        with self.assertRaises(GoogleApiError):
            gcal.delete_remote_event(self.usuario, evento)

    def test_delete_remote_event_requires_connected_account_for_service(self):
        evento = self._evento()
        GoogleEventLink.objects.create(calendar=self.calendar, evento=evento, google_event_id="g1")
        self.account.revoked_at = timezone.now()
        self.account.save()
        self.usuario = Usuario.objects.get(pk=self.usuario.pk)
        with self.assertRaises(GoogleAuthorizationRequired):
            gcal.delete_remote_event(self.usuario, evento)


class SyncCalendarTests(CalendarTestBase):
    def _sync(self):
        return gcal.sync_calendar(self.usuario, self.calendar, self.service)

    def test_imports_unmatched_remote_without_cliente_and_skips_invalid_items(self):
        self._list_returns(
            {
                "items": [
                    self._remote("g1", summary="Reuniao externa"),
                    {"summary": "sem id", "start": {"dateTime": "2030-01-02T10:00:00Z"}},
                    {"id": "g-sem-inicio", "summary": "sem inicio"},
                ],
                "nextSyncToken": "tok-1",
            }
        )
        summary = self._sync()
        self.assertEqual(summary["importados"], 1)
        evento = Evento.objects.get(titulo="Reuniao externa")
        self.assertIsNone(evento.cliente_id)
        self.assertEqual(evento.criado_por, "Google Calendar")
        self.assertEqual(GoogleEventLink.objects.get(evento=evento).google_event_id, "g1")
        self.calendar.refresh_from_db()
        self.assertEqual(self.calendar.sync_token, "tok-1")
        self.assertIsNotNone(self.calendar.last_synced_at)

    def test_imported_event_is_not_pushed_back_to_google(self):
        self._list_returns({"items": [self._remote("g1")], "nextSyncToken": "t"})
        summary = self._sync()
        self.assertEqual((summary["importados"], summary["exportados"]), (1, 0))
        self.service.events().update.assert_not_called()
        self.service.events().insert.assert_not_called()

    def test_links_identical_local_event_instead_of_duplicating(self):
        item = self._remote("g1", summary="Igual")
        fields = gcal._remote_fields(item)
        local = self._evento(
            titulo="Igual", data_inicio=fields["data_inicio"], data_fim=fields["data_fim"]
        )
        self._list_returns({"items": [item], "nextSyncToken": "t"})
        summary = self._sync()
        self.assertEqual((summary["vinculados"], summary["importados"]), (1, 0))
        self.assertEqual(Evento.objects.filter(titulo="Igual").count(), 1)
        self.assertEqual(GoogleEventLink.objects.get(evento=local).google_event_id, "g1")

    def test_remote_update_wins_when_local_unchanged_since_last_sync(self):
        item = self._remote("g1", summary="Titulo antigo")
        self._list_returns({"items": [item], "nextSyncToken": "t"})
        self._sync()

        novo = self._remote("g1", summary="Titulo novo", updated="2031-01-01T00:00:00Z")
        self._list_returns({"items": [novo], "nextSyncToken": "t2"})
        summary = self._sync()
        self.assertEqual(summary["atualizados"], 1)
        self.assertEqual(Evento.objects.get().titulo, "Titulo novo")

    def test_local_edit_newer_than_remote_counts_as_conflict_and_is_kept(self):
        self._list_returns({"items": [self._remote("g1", summary="Original")], "nextSyncToken": "t"})
        self._sync()
        evento = Evento.objects.get()
        Evento.objects.filter(pk=evento.pk).update(titulo="Editado local")
        evento.refresh_from_db()
        stale = self._remote("g1", summary="Remoto velho", updated="2000-01-01T00:00:00Z")
        self._list_returns({"items": [stale], "nextSyncToken": "t2"})
        self._stub("update", FakeRequest({"id": "g1", "etag": "e9"}))
        summary = self._sync()
        self.assertEqual(summary["conflitos"], 1)
        evento.refresh_from_db()
        self.assertEqual(evento.titulo, "Editado local")
        self.assertEqual(summary["exportados"], 1)

    def test_remote_cancellation_deletes_local_event_and_other_remote_copies(self):
        outro = GoogleCalendar.objects.create(account=self.account, calendar_id="outra", enabled=True)
        evento = self._evento()
        GoogleEventLink.objects.create(calendar=self.calendar, evento=evento, google_event_id="g1")
        GoogleEventLink.objects.create(calendar=outro, evento=evento, google_event_id="copia")
        self._list_returns(
            {"items": [{"id": "g1", "status": "cancelled"}, {"id": "ignorado", "status": "cancelled"}]}
        )
        self._stub("delete", FakeRequest({}))
        summary = self._sync()
        self.assertEqual(summary["removidos"], 1)
        self.assertFalse(Evento.objects.filter(pk=evento.pk).exists())
        self.assertEqual(self.service.events().delete.call_args.kwargs["eventId"], "copia")

    def test_failure_removing_other_copy_is_logged_not_raised(self):
        outro = GoogleCalendar.objects.create(account=self.account, calendar_id="outra", enabled=True)
        evento = self._evento()
        GoogleEventLink.objects.create(calendar=self.calendar, evento=evento, google_event_id="g1")
        GoogleEventLink.objects.create(calendar=outro, evento=evento, google_event_id="copia")
        self._list_returns({"items": [{"id": "g1", "status": "cancelled"}]})
        self._stub("delete", FakeRequest(error=_http_error(403)))
        with self.assertLogs("integrations.google.calendar", level="ERROR"):
            summary = self._sync()
        self.assertEqual(summary["removidos"], 1)

    def test_exports_new_local_events_and_skips_prazos_cancelled_and_unchanged(self):
        novo = self._evento("Novo")
        self._evento("Cancelado", status="Cancelado")
        self._evento("Prazo X", tipo_evento="Prazo")
        sincronizado = self._evento("Ja sincronizado")
        GoogleEventLink.objects.create(
            calendar=self.calendar,
            evento=sincronizado,
            google_event_id="ja",
            local_payload_hash=gcal._payload_hash(sincronizado),
        )
        self._list_returns({"items": [], "nextSyncToken": "t"})
        self._stub("insert", FakeRequest({"id": "g-novo", "etag": "e"}))
        summary = self._sync()
        self.assertEqual(summary["exportados"], 1)
        self.assertEqual(GoogleEventLink.objects.get(evento=novo).google_event_id, "g-novo")
        self.service.events().update.assert_not_called()

    def test_changed_local_event_updates_remote_and_recreates_on_404(self):
        evento = self._evento("Mudou")
        link = GoogleEventLink.objects.create(
            calendar=self.calendar, evento=evento, google_event_id="g-old", local_payload_hash="stale"
        )
        self._list_returns({"items": [], "nextSyncToken": "t"})
        self._stub("update", FakeRequest(error=_http_error(410)))
        self._stub("insert", FakeRequest({"id": "g-new"}))
        summary = self._sync()
        self.assertEqual(summary["exportados"], 1)
        self.assertFalse(GoogleEventLink.objects.filter(pk=link.pk).exists())
        self.assertEqual(GoogleEventLink.objects.get(evento=evento).google_event_id, "g-new")

    def test_changed_local_event_other_error_propagates(self):
        evento = self._evento("Mudou")
        GoogleEventLink.objects.create(
            calendar=self.calendar, evento=evento, google_event_id="g", local_payload_hash="stale"
        )
        self._list_returns({"items": [], "nextSyncToken": "t"})
        self._stub("update", FakeRequest(error=_http_error(403)))
        with self.assertRaises(GoogleApiError):
            self._sync()

    def test_expired_sync_token_resets_and_retries_full_sync(self):
        self.calendar.set_sync_token("velho")
        self.calendar.save()
        self.service.events().list.side_effect = [
            FakeRequest(error=_http_error(410)),
            FakeRequest({"items": [], "nextSyncToken": "novo"}),
        ]
        self._sync()
        self.calendar.refresh_from_db()
        self.assertEqual(self.calendar.sync_token, "novo")
        first, second = [c.kwargs for c in self.service.events().list.call_args_list]
        self.assertEqual(first["syncToken"], "velho")
        self.assertNotIn("syncToken", second)
        self.assertIn("timeMin", second)

    def test_410_without_sync_token_is_not_retried(self):
        self.service.events().list.return_value = FakeRequest(error=_http_error(410))
        with self.assertRaises(GoogleApiError):
            self._sync()

    def test_pull_follows_pagination(self):
        self._list_returns(
            {"items": [self._remote("a")], "nextPageToken": "p2"},
            {"items": [self._remote("b", summary="Outro")], "nextSyncToken": "fim"},
        )
        summary = self._sync()
        self.assertEqual(summary["importados"], 2)
        self.assertEqual(self.service.events().list.call_args_list[1].kwargs["pageToken"], "p2")


class SyncAgendaTests(CalendarTestBase):
    @patch("integrations.google.calendar.calendar_service")
    def test_sync_agenda_sums_all_enabled_calendars(self, service_factory):
        service_factory.return_value = self.service
        GoogleCalendar.objects.create(account=self.account, calendar_id="outra", enabled=True)
        self.service.events().list.side_effect = [
            FakeRequest({"items": [self._remote("a")], "nextSyncToken": "t1"}),
            FakeRequest({"items": [self._remote("b", summary="B")], "nextSyncToken": "t2"}),
        ]
        total = gcal.sync_agenda(self.usuario)
        self.assertTrue(total["conectado"])
        self.assertEqual(total["importados"], 2)

    @patch("integrations.google.calendar.calendar_service")
    def test_sync_single_calendar_uses_account_owner(self, service_factory):
        service_factory.return_value = self.service
        self.service.events().list.return_value = FakeRequest({"items": [], "nextSyncToken": "t"})
        result = gcal.sync_single_calendar(self.calendar)
        self.assertEqual(result["importados"], 0)
        service_factory.assert_called_once()


class ConflictRuleTests(CalendarTestBase):
    def _link(self, evento, **extra):
        return GoogleEventLink.objects.create(
            calendar=self.calendar, evento=evento, google_event_id="g", **extra
        )

    def test_aware_none_passthrough(self):
        self.assertIsNone(gcal._aware(None))

    def test_calendar_label_falls_back_when_lookup_fails(self):
        class Broken:
            @property
            def google_account(self):
                raise RuntimeError("sem conta")

        self.assertEqual(gcal.calendar_label(Broken()), "primary")

    def test_update_from_remote_reports_no_change_or_invalid_item(self):
        evento = self._evento("Mesmo")
        fields = gcal._remote_fields(self._remote("g", summary="Mesmo"))
        Evento.objects.filter(pk=evento.pk).update(**fields)
        evento.refresh_from_db()
        self.assertFalse(gcal._update_from_remote(evento, self._remote("g", summary="Mesmo")))
        self.assertFalse(gcal._update_from_remote(evento, {"id": "g"}))

    def test_remote_should_win_rules(self):
        evento = self._evento("Regra")
        nunca_sincronizado = self._link(evento)
        self.assertTrue(gcal._remote_should_win(evento, nunca_sincronizado, self._remote()))

        nunca_sincronizado.last_synced_at = timezone.now()
        nunca_sincronizado.local_payload_hash = gcal._payload_hash(evento)
        self.assertTrue(gcal._remote_should_win(evento, nunca_sincronizado, self._remote(updated="2000-01-01T00:00:00Z")))

        nunca_sincronizado.local_payload_hash = "mudou-localmente"
        self.assertTrue(gcal._remote_should_win(evento, nunca_sincronizado, self._remote(updated="2999-01-01T00:00:00Z")))
        self.assertFalse(gcal._remote_should_win(evento, nunca_sincronizado, self._remote(updated="2000-01-01T00:00:00Z")))
        sem_data = self._remote()
        sem_data.pop("updated")
        self.assertFalse(gcal._remote_should_win(evento, nunca_sincronizado, sem_data))
