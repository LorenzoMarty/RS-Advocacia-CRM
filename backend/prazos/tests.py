import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from agenda.models import Evento
from clientes.models import Cliente
from prazos.models import Prazo
from processos.models import Processo
from usuarios.models import Usuario


class PrazosViewsTests(TestCase):
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
            "titulo": "0001234-56.2026.8.26.0001 - Advogada",
            "descricao": "Protocolar contestacao",
            "data_limite": "2026-06-23",
            "processo": self.processo.pk,
            "responsavel": self.usuario.nome,
            "status": "Pendente",
            "prioridade": "Alta",
            "observacoes": "",
            "concluido": False,
        }

    def test_criar_prazo_nao_cria_evento(self):
        response = self.client.post(
            reverse("criar_prazo"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Prazo.objects.count(), 1)
        self.assertEqual(Evento.objects.count(), 0)
        self.assertEqual(response.json()["dados"]["prazo"]["data_limite"], "2026-06-23")

    def test_atualizar_timer_prazo(self):
        prazo = Prazo.objects.create(
            titulo="Prazo",
            descricao="Descricao",
            data_limite="2026-06-23",
            processo=self.processo,
            responsavel=self.usuario.nome,
            status="Pendente",
            prioridade="Alta",
            criado_por=self.usuario.nome,
        )

        response = self.client.patch(
            reverse("atualizar_timer_prazo", args=[prazo.pk]),
            data=json.dumps({"tempo_decorrido_segundos": 120, "timer_iniciado_em": None}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        prazo.refresh_from_db()
        self.assertEqual(prazo.tempo_decorrido_segundos, 120)

    def test_prazo_pode_voltar_para_pendente(self):
        prazo = Prazo.objects.create(
            titulo="Prazo",
            descricao="Descricao",
            data_limite="2026-06-23",
            processo=self.processo,
            responsavel=self.usuario.nome,
            status="Protocolado",
            prioridade="Alta",
            concluido=True,
            criado_por=self.usuario.nome,
        )
        payload = self.payload()
        payload["status"] = "Pendente"
        payload["concluido"] = False

        response = self.client.put(
            reverse("editar_prazo", args=[prazo.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        prazo.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(prazo.status, "Pendente")
        self.assertFalse(prazo.concluido)
