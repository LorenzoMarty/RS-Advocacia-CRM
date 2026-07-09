import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from agenda.models import Evento
from clientes.models import Cliente
from integrations.google.exceptions import GoogleAuthorizationRequired
from processos.models import Processo
from usuarios.models import Usuario


class AgendaIntegrationViewsTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada",
            email="advogada@example.com",
            cargo="Administrador",
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email,
            email=self.usuario.email,
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session["usuario_nome"] = self.usuario.nome
        session.save()
        self.cliente = Cliente.objects.create(
            nome="Cliente",
            email="cliente@example.com",
            telefone="11999999999",
            cpf="123.456.789-00",
            tipo_cliente="esporadico",
        )
        self.processo = Processo.objects.create(
            numero_processo="0001234-56.2026.8.26.0001",
            cliente=self.cliente,
            descricao="Processo",
            vara="1a Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )

    def payload(self):
        return {
            "titulo": "Audiencia",
            "tipo_evento": "Audiencia",
            "prioridade": "Alta",
            "descricao": "Descricao",
            "data_inicio": "2026-06-23T09:00:00-03:00",
            "data_fim": "2026-06-23T10:00:00-03:00",
            "cliente": self.cliente.pk,
            "processo": self.processo.pk,
            "responsavel": self.usuario.pk,
            "status": "Agendado",
            "local": "Forum",
            "observacoes": "",
            "concluido": False,
        }

    @patch("agenda.views.sync_agenda")
    def test_listagem_nao_dispara_sincronizacao_google(self, sync_agenda):
        response = self.client.get(reverse("listar_eventos"))

        self.assertEqual(response.status_code, 200)
        sync_agenda.assert_not_called()

    @patch("agenda.views.sync_agenda")
    def test_listagem_filtra_por_cliente_id(self, sync_agenda):
        outro_cliente = Cliente.objects.create(
            nome="Outro Cliente",
            email="outro@example.com",
            telefone="11988888888",
            cpf="987.654.321-00",
            tipo_cliente="esporadico",
        )
        outro_processo = Processo.objects.create(
            numero_processo="0007654-56.2026.8.26.0001",
            cliente=outro_cliente,
            descricao="Processo",
            vara="1a Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )
        Evento.objects.create(
            titulo="Audiencia cliente",
            tipo_evento="Audiencia",
            prioridade="Alta",
            data_inicio="2026-06-23T09:00:00-03:00",
            data_fim="2026-06-23T10:00:00-03:00",
            cliente=self.cliente,
            processo=self.processo,
            status="Agendado",
            criado_por=self.usuario.nome,
            local="Forum",
        )
        Evento.objects.create(
            titulo="Audiencia outro cliente",
            tipo_evento="Audiencia",
            prioridade="Alta",
            data_inicio="2026-06-24T09:00:00-03:00",
            data_fim="2026-06-24T10:00:00-03:00",
            cliente=outro_cliente,
            processo=outro_processo,
            status="Agendado",
            criado_por=self.usuario.nome,
            local="Forum",
        )

        response = self.client.get(reverse("listar_eventos"), {"cliente_id": self.cliente.pk})

        self.assertEqual(response.status_code, 200)
        eventos = response.json()["dados"]["eventos"]
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0]["cliente_id"], str(self.cliente.pk))

    @patch("agenda.views.sync_agenda")
    def test_listagem_filtra_por_janela_de_data(self, sync_agenda):
        Evento.objects.create(
            titulo="Fora da janela",
            tipo_evento="Audiencia",
            prioridade="Alta",
            data_inicio="2026-01-01T09:00:00-03:00",
            data_fim="2026-01-01T10:00:00-03:00",
            cliente=self.cliente,
            processo=self.processo,
            status="Agendado",
            criado_por=self.usuario.nome,
            local="Forum",
        )
        Evento.objects.create(
            titulo="Dentro da janela",
            tipo_evento="Audiencia",
            prioridade="Alta",
            data_inicio="2026-06-23T09:00:00-03:00",
            data_fim="2026-06-23T10:00:00-03:00",
            cliente=self.cliente,
            processo=self.processo,
            status="Agendado",
            criado_por=self.usuario.nome,
            local="Forum",
        )

        response = self.client.get(
            reverse("listar_eventos"),
            {"data_inicio": "2026-06-01T00:00:00-03:00", "data_fim": "2026-06-30T23:59:59-03:00"},
        )

        self.assertEqual(response.status_code, 200)
        eventos = response.json()["dados"]["eventos"]
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0]["titulo"], "Dentro da janela")

    @patch("agenda.views.sincronizar_evento_google_calendar", return_value=None)
    def test_criar_evento_sincroniza_por_backend_e_expoe_status(self, sincronizar_task):
        response = self.client.post(
            reverse("criar_evento"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(
            response.json()["dados"]["sincronizacao_google"]["status"],
            "agendado",
        )
        sincronizar_task.delay.assert_called_once()

    @patch("agenda.views.sincronizar_evento_google_calendar", return_value=None)
    def test_patch_evento_marca_comparecimento_com_payload_parcial(
        self, sincronizar_task
    ):
        evento = Evento.objects.create(
            titulo="Audiencia",
            descricao="Descricao",
            data_inicio="2026-06-23T09:00:00-03:00",
            data_fim="2026-06-23T10:00:00-03:00",
            tipo_evento="Audiencia",
            status="Agendado",
            prioridade="Alta",
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            criado_por=self.usuario.nome,
            local="Forum",
            observacoes="",
        )

        response = self.client.patch(
            reverse("editar_evento", args=[evento.pk]),
            data=json.dumps({"status": "Compareceu", "concluido": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        evento.refresh_from_db()
        self.assertEqual(evento.status, "Compareceu")
        self.assertTrue(evento.concluido)
        sincronizar_task.delay.assert_called_once()

    @patch("agenda.views.sincronizar_evento_google_calendar", return_value=None)
    def test_endpoint_comparecimento_nao_depende_do_formulario_de_edicao(
        self, sincronizar_task
    ):
        evento = Evento.objects.create(
            titulo="Audiencia",
            descricao="Descricao",
            data_inicio="2026-06-23T09:00:00-03:00",
            data_fim="2026-06-23T10:00:00-03:00",
            tipo_evento="Audiencia",
            status="Agendado",
            prioridade="Alta",
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            criado_por=self.usuario.nome,
            local="Forum",
            observacoes="",
        )

        response = self.client.post(
            reverse("marcar_comparecimento", args=[evento.pk]),
            data=json.dumps({"status": "Compareceu"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        evento.refresh_from_db()
        self.assertEqual(evento.status, "Compareceu")
        self.assertTrue(evento.concluido)
        self.assertEqual(response.json()["dados"]["evento"]["status"], "Compareceu")
        sincronizar_task.delay.assert_called_once()

    @patch("agenda.views.sincronizar_evento_google_calendar", return_value=None)
    def test_put_evento_parcial_aceita_alias_completed(self, sincronizar_task):
        evento = Evento.objects.create(
            titulo="Audiencia",
            descricao="Descricao",
            data_inicio="2026-06-23T09:00:00-03:00",
            data_fim="2026-06-23T10:00:00-03:00",
            tipo_evento="Audiencia",
            status="Agendado",
            prioridade="Alta",
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            criado_por=self.usuario.nome,
            local="Forum",
            observacoes="",
        )

        response = self.client.put(
            reverse("editar_evento", args=[evento.pk]),
            data=json.dumps({"status": "Não compareceu", "completed": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        evento.refresh_from_db()
        self.assertEqual(evento.status, "Não compareceu")
        self.assertTrue(evento.concluido)
        sincronizar_task.delay.assert_called_once()

    @patch("agenda.views.sincronizar_evento_google_calendar")
    def test_criar_prazo_como_evento_e_bloqueado(self, sincronizar_task):
        payload = self.payload()
        payload["titulo"] = "Prazo"
        payload["tipo_evento"] = "Prazo"

        response = self.client.post(
            reverse("criar_evento"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Evento.objects.filter(tipo_evento__iexact="Prazo").exists())
        sincronizar_task.delay.assert_not_called()

    @patch("agenda.views.delete_remote_event", side_effect=RuntimeError("google down"))
    def test_exclusao_remota_falha_sem_apagar_evento_local(self, delete_remote_event):
        evento = Evento.objects.create(
            titulo="Evento",
            descricao="",
            data_inicio="2026-06-23T09:00:00-03:00",
            data_fim="2026-06-23T10:00:00-03:00",
            tipo_evento="Audiencia",
            status="Agendado",
            prioridade="Alta",
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            criado_por=self.usuario.nome,
            local="Forum",
            observacoes="",
        )

        response = self.client.delete(reverse("excluir_evento", args=[evento.pk]))

        self.assertEqual(response.status_code, 502)
        self.assertTrue(Evento.objects.filter(pk=evento.pk).exists())

    @patch(
        "agenda.views.delete_remote_event",
        side_effect=GoogleAuthorizationRequired(
            "Autorize novamente o Google Calendar."
        ),
    )
    def test_exclusao_com_token_revogado_preserva_evento_local(
        self, delete_remote_event
    ):
        evento = Evento.objects.create(
            titulo="Evento",
            descricao="",
            data_inicio="2026-06-23T09:00:00-03:00",
            data_fim="2026-06-23T10:00:00-03:00",
            tipo_evento="Audiencia",
            status="Agendado",
            prioridade="Alta",
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            criado_por=self.usuario.nome,
            local="Forum",
            observacoes="",
        )

        response = self.client.delete(reverse("excluir_evento", args=[evento.pk]))

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Evento.objects.filter(pk=evento.pk).exists())

    @patch(
        "agenda.views.sync_agenda", return_value={"conectado": True, "importados": 0}
    )
    def test_sincronizacao_google_e_explicita_por_post(self, sync_agenda):
        response = self.client.post(reverse("sincronizar_google_calendar"))

        self.assertEqual(response.status_code, 200, response.json())
        sync_agenda.assert_called_once_with(self.usuario)
