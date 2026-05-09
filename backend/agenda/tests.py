import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.db import models
from django.test import TestCase, override_settings
from django.urls import reverse

from agenda.models import Evento
from agenda.services.google_calendar import (
    atualizar_evento_google,
    criar_evento_google,
    deletar_evento_google,
    evento_para_google,
    sincronizar_agenda_google,
)
from clientes.models import Cliente
from processos.models import Processo
from usuarios.models import Usuario


class AgendaGoogleTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada Google",
            email="advogada@example.com",
            cargo="Administrador",
            google_token="access-token",
            google_refresh_token="refresh-token",
        )
        self.auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email,
            email=self.usuario.email,
        )
        self.client.force_login(self.auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session["usuario_nome"] = self.usuario.nome
        session.save()

        self.cliente = Cliente.objects.create(
            nome="Cliente Teste",
            email="cliente@example.com",
            telefone="11999999999",
            cpf="123.456.789-00",
            tipo_cliente="esporadico",
        )
        self.processo = Processo.objects.create(
            numero_processo="0001234-56.2026.8.26.0001",
            cliente=self.cliente,
            descricao="Processo de teste",
            vara="1a Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario.nome,
        )

    def _payload_evento(self):
        return {
            "titulo": "Audiencia",
            "tipo_evento": "Audiencia",
            "prioridade": "Alta",
            "descricao": "Descricao do evento",
            "data_inicio": "2026-04-23T09:00:00-03:00",
            "data_fim": "2026-04-23T10:00:00-03:00",
            "lembrete_em": "2026-04-23T08:00:00-03:00",
            "cliente": self.cliente.pk,
            "processo": self.processo.pk,
            "responsavel": self.usuario.nome,
            "status": "Agendado",
            "local": "Forum",
            "observacoes": "Observacoes",
            "concluido": False,
        }

    @patch("agenda.views.criar_evento_google")
    def test_criar_evento_sincroniza_com_google_usando_usuario_do_dominio(
        self,
        criar_evento_google,
    ):
        criar_evento_google.return_value = "google-event-123"

        response = self.client.post(
            reverse("criar_evento"),
            data=json.dumps(self._payload_evento()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        evento = Evento.objects.get()
        self.assertEqual(evento.google_event_id, "google-event-123")
        criar_evento_google.assert_called_once()
        usuario_argumento, evento_argumento = criar_evento_google.call_args[0]
        self.assertEqual(usuario_argumento.pk, self.usuario.pk)
        self.assertEqual(evento_argumento.pk, evento.pk)

    @patch("agenda.views.atualizar_evento_google")
    def test_editar_evento_sincroniza_com_google_usando_usuario_do_dominio(
        self,
        atualizar_evento_google,
    ):
        evento = Evento.objects.create(
            titulo="Evento Original",
            descricao="Descricao",
            data_inicio="2026-04-23T09:00:00-03:00",
            data_fim="2026-04-23T10:00:00-03:00",
            tipo_evento="Audiencia",
            status="Agendado",
            prioridade="Alta",
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario.nome,
            criado_por=self.usuario.nome,
            local="Forum",
            observacoes="",
        )
        payload = self._payload_evento()
        payload["titulo"] = "Evento Atualizado"

        response = self.client.put(
            reverse("editar_evento", args=[evento.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        atualizar_evento_google.assert_called_once()
        usuario_argumento, evento_argumento = atualizar_evento_google.call_args[0]
        self.assertEqual(usuario_argumento.pk, self.usuario.pk)
        self.assertEqual(evento_argumento.pk, evento.pk)

    @patch("agenda.views.deletar_evento_google")
    def test_excluir_evento_sincroniza_com_google_usando_usuario_do_dominio(
        self,
        deletar_evento_google,
    ):
        chamada = {}

        def registrar_chamada(usuario_argumento, evento_argumento):
            chamada["usuario_pk"] = usuario_argumento.pk
            chamada["evento_pk"] = evento_argumento.pk
            chamada["google_event_id"] = evento_argumento.google_event_id

        deletar_evento_google.side_effect = registrar_chamada

        evento = Evento.objects.create(
            titulo="Evento Original",
            descricao="Descricao",
            data_inicio="2026-04-23T09:00:00-03:00",
            data_fim="2026-04-23T10:00:00-03:00",
            tipo_evento="Audiencia",
            status="Agendado",
            prioridade="Alta",
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario.nome,
            criado_por=self.usuario.nome,
            local="Forum",
            observacoes="",
            google_event_id="google-event-999",
        )

        response = self.client.delete(reverse("excluir_evento", args=[evento.pk]))

        self.assertEqual(response.status_code, 200, response.json())
        deletar_evento_google.assert_called_once()
        self.assertEqual(chamada["usuario_pk"], self.usuario.pk)
        self.assertEqual(chamada["evento_pk"], evento.pk)
        self.assertEqual(chamada["google_event_id"], "google-event-999")

    @patch("agenda.views.sincronizar_agenda_google")
    def test_listar_eventos_sincroniza_google_automaticamente(
        self,
        sincronizar_agenda_google_mock,
    ):
        sincronizar_agenda_google_mock.return_value = {
            "conectado": True,
            "importados": 0,
            "atualizados": 0,
            "exportados": 0,
            "vinculados": 0,
            "removidos": 0,
        }

        response = self.client.get(reverse("listar_eventos"))

        self.assertEqual(response.status_code, 200, response.json())
        sincronizar_agenda_google_mock.assert_called_once()
        self.assertIn("sincronizacao_google", response.json()["dados"])

    @patch("agenda.views.sincronizar_agenda_google")
    def test_sincronizar_google_calendar_retorna_erro_controlado_quando_google_falha(
        self,
        sincronizar_agenda_google_mock,
    ):
        sincronizar_agenda_google_mock.side_effect = RuntimeError("falha google")

        response = self.client.post(reverse("sincronizar_google_calendar"))
        payload = response.json()

        self.assertEqual(response.status_code, 502, payload)
        self.assertFalse(payload["sucesso"])
        self.assertIn("Google Calendar", payload["erros"]["detalhe"][0])


class GoogleCalendarServiceTests(TestCase):
    def _evento(self, **overrides):
        defaults = {
            "titulo": "Audiencia de instrucao",
            "descricao": "Preparar sustentacao oral",
            "local": "Forum Central",
            "data_inicio": SimpleNamespace(
                isoformat=lambda: "2026-04-23T09:00:00-03:00"
            ),
            "data_fim": SimpleNamespace(
                isoformat=lambda: "2026-04-23T10:00:00-03:00"
            ),
            "google_event_id": "google-event-123",
        }
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    @override_settings(
        GOOGLE_CALENDAR_ID="juridico@group.calendar.google.com",
        GOOGLE_CALENDAR_TIMEZONE="America/Sao_Paulo",
    )
    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_criar_evento_google_usa_agenda_configurada(
        self,
        obter_servico_google,
    ):
        servico = MagicMock()
        obter_servico_google.return_value = servico
        servico.events.return_value.insert.return_value.execute.return_value = {
            "id": "google-event-999"
        }

        google_id = criar_evento_google(object(), self._evento())

        self.assertEqual(google_id, "google-event-999")
        servico.events.return_value.insert.assert_called_once()
        chamada = servico.events.return_value.insert.call_args.kwargs
        self.assertEqual(
            chamada["calendarId"],
            "juridico@group.calendar.google.com",
        )
        self.assertEqual(chamada["body"]["location"], "Forum Central")
        self.assertEqual(
            chamada["body"]["start"]["timeZone"],
            "America/Sao_Paulo",
        )
        self.assertEqual(
            chamada["body"]["end"]["timeZone"],
            "America/Sao_Paulo",
        )

    @override_settings(GOOGLE_CALENDAR_ID="juridico@group.calendar.google.com")
    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_atualizar_evento_google_usa_agenda_configurada(
        self,
        obter_servico_google,
    ):
        servico = MagicMock()
        obter_servico_google.return_value = servico
        evento = self._evento(google_event_id="google-event-321")

        returned_event_id = atualizar_evento_google(object(), evento)

        self.assertEqual(returned_event_id, "google-event-321")
        servico.events.return_value.update.assert_called_once_with(
            calendarId="juridico@group.calendar.google.com",
            eventId="google-event-321",
            body=evento_para_google(evento),
        )

    @override_settings(GOOGLE_CALENDAR_ID="juridico@group.calendar.google.com")
    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_deletar_evento_google_usa_agenda_configurada(
        self,
        obter_servico_google,
    ):
        servico = MagicMock()
        obter_servico_google.return_value = servico

        deletar_evento_google(object(), self._evento())

        servico.events.return_value.delete.assert_called_once_with(
            calendarId="juridico@group.calendar.google.com",
            eventId="google-event-123",
        )

    def test_google_event_id_aceita_ids_longos_do_google_calendar(self):
        field = Evento._meta.get_field("google_event_id")

        self.assertIsInstance(field, models.TextField)


class GoogleCalendarSyncTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada Google",
            email="advogada@example.com",
            cargo="Administrador",
            google_token="access-token",
            google_refresh_token="refresh-token",
        )
        self.cliente = Cliente.objects.create(
            nome="Cliente Teste",
            email="cliente@example.com",
            telefone="11999999999",
            cpf="123.456.789-00",
            tipo_cliente="esporadico",
        )
        self.processo = Processo.objects.create(
            numero_processo="0001234-56.2026.8.26.0001",
            cliente=self.cliente,
            descricao="Processo de teste",
            vara="1a Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario.nome,
        )

    def _evento_local(self, **overrides):
        defaults = {
            "titulo": "Reuniao com cliente",
            "descricao": "Discutir estrategia",
            "data_inicio": "2026-04-24T09:00:00-03:00",
            "data_fim": "2026-04-24T10:00:00-03:00",
            "tipo_evento": "Reuniao",
            "status": "Agendado",
            "prioridade": "Media",
            "cliente": self.cliente,
            "processo": self.processo,
            "responsavel": self.usuario.nome,
            "criado_por": self.usuario.nome,
            "local": "Escritorio",
            "observacoes": "",
            "concluido": False,
        }
        defaults.update(overrides)
        return Evento.objects.create(**defaults)

    def _evento_google(self, **overrides):
        defaults = {
            "id": "google-event-123",
            "status": "confirmed",
            "summary": "Reuniao com cliente",
            "description": "Discutir estrategia",
            "location": "Escritorio",
            "start": {"dateTime": "2026-04-24T09:00:00-03:00"},
            "end": {"dateTime": "2026-04-24T10:00:00-03:00"},
        }
        defaults.update(overrides)
        return defaults

    def _mock_google_service(self, items=None, insert_response=None):
        servico = MagicMock()
        items = items if items is not None else []
        insert_response = insert_response or {"id": "google-event-exportado"}
        servico.events.return_value.list.return_value.execute.side_effect = [
            {"items": items}
        ]
        servico.events.return_value.insert.return_value.execute.return_value = (
            insert_response
        )
        return servico

    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_sincronizar_agenda_google_importa_evento_novo_do_google(
        self,
        obter_servico_google,
    ):
        obter_servico_google.return_value = self._mock_google_service(
            items=[self._evento_google()]
        )

        resumo = sincronizar_agenda_google(self.usuario)

        evento = Evento.objects.get(google_event_id="google-event-123")
        self.assertTrue(resumo["conectado"])
        self.assertEqual(resumo["importados"], 1)
        self.assertEqual(evento.cliente.nome, "Google Agenda")
        self.assertEqual(evento.processo.numero_processo, "GOOGLE-CALENDAR")
        self.assertEqual(evento.criado_por, "Google Calendar")

    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_sincronizar_agenda_google_importa_evento_com_id_longo(
        self,
        obter_servico_google,
    ):
        google_id = "google-event-" + ("x" * 300)
        obter_servico_google.return_value = self._mock_google_service(
            items=[self._evento_google(id=google_id)]
        )

        resumo = sincronizar_agenda_google(self.usuario)

        self.assertEqual(resumo["importados"], 1)
        self.assertTrue(Evento.objects.filter(google_event_id=google_id).exists())

    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_sincronizar_agenda_google_trata_erro_inesperado_ao_listar(
        self,
        obter_servico_google,
    ):
        servico = MagicMock()
        servico.events.return_value.list.return_value.execute.side_effect = (
            RuntimeError("falha de transporte")
        )
        obter_servico_google.return_value = servico

        resumo = sincronizar_agenda_google(self.usuario)

        self.assertFalse(resumo["conectado"])

    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_sincronizar_agenda_google_vincula_evento_local_sem_duplicar(
        self,
        obter_servico_google,
    ):
        evento = self._evento_local()
        servico = self._mock_google_service(items=[self._evento_google()])
        obter_servico_google.return_value = servico

        resumo = sincronizar_agenda_google(self.usuario)

        evento.refresh_from_db()
        self.assertEqual(resumo["vinculados"], 1)
        self.assertEqual(evento.google_event_id, "google-event-123")
        servico.events.return_value.insert.assert_not_called()
        self.assertEqual(Evento.objects.count(), 1)

    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_sincronizar_agenda_google_exporta_evento_local_sem_vinculo(
        self,
        obter_servico_google,
    ):
        evento = self._evento_local()
        obter_servico_google.return_value = self._mock_google_service(items=[])

        resumo = sincronizar_agenda_google(self.usuario)

        evento.refresh_from_db()
        self.assertEqual(resumo["exportados"], 1)
        self.assertEqual(evento.google_event_id, "google-event-exportado")

    @patch("agenda.services.google_calendar.obter_servico_google")
    def test_sincronizar_agenda_google_remove_evento_cancelado(
        self,
        obter_servico_google,
    ):
        self._evento_local(google_event_id="google-event-cancelado")
        obter_servico_google.return_value = self._mock_google_service(
            items=[
                self._evento_google(
                    id="google-event-cancelado",
                    status="cancelled",
                )
            ]
        )

        resumo = sincronizar_agenda_google(self.usuario)

        self.assertEqual(resumo["removidos"], 1)
        self.assertFalse(
            Evento.objects.filter(google_event_id="google-event-cancelado").exists()
        )
