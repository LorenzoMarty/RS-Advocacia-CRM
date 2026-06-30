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
            advogado_responsavel=self.usuario.nome,
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

    @patch("agenda.views.sync_local_event", return_value=1)
    def test_criar_evento_sincroniza_por_backend_e_expoe_status(self, sync_local_event):
        response = self.client.post(
            reverse("criar_evento"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(
            response.json()["dados"]["sincronizacao_google"]["status"],
            "sincronizado",
        )
        sync_local_event.assert_called_once()

    @patch("agenda.views.sync_local_event", return_value=1)
    def test_patch_evento_marca_comparecimento_com_payload_parcial(
        self, sync_local_event
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
        sync_local_event.assert_called_once()

    @patch("agenda.views.sync_local_event", return_value=1)
    def test_endpoint_comparecimento_nao_depende_do_formulario_de_edicao(
        self, sync_local_event
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
        sync_local_event.assert_called_once()

    @patch("agenda.views.sync_local_event", return_value=1)
    def test_put_evento_parcial_aceita_alias_completed(self, sync_local_event):
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
        sync_local_event.assert_called_once()

    @patch("agenda.views.sync_local_event")
    def test_criar_prazo_como_evento_e_bloqueado(self, sync_local_event):
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
        sync_local_event.assert_not_called()

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
