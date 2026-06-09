import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from clientes.models import Cliente
from peticoes.models import Peticao
from processos.models import Processo
from usuarios.models import Usuario


class PeticoesViewsTests(TestCase):
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
            numero_processo="1000000-00.2026.8.26.0000",
            cliente=self.cliente,
            descricao="Processo de teste",
            vara="1a Vara Civel",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario.nome,
        )

    def payload(self):
        return {
            "cliente": self.cliente.pk,
            "processo": self.processo.pk,
            "tipo": Peticao.TIPO_CONTESTACAO,
            "adverso": "Empresa adversa",
            "responsavel_acao": self.usuario.nome,
            "link_drive": "https://drive.google.com/file/d/exemplo",
            "motivo_pendente": "Aguardando documentos",
            "area_juridica": "Cível",
            "status": Peticao.STATUS_PENDENTE,
        }

    def test_criar_peticao(self):
        response = self.client.post(
            reverse("criar_peticao"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Peticao.objects.count(), 1)
        self.assertEqual(
            response.json()["dados"]["peticao"]["adverso"], "Empresa adversa"
        )
        self.assertEqual(
            response.json()["dados"]["peticao"]["tipo"], Peticao.TIPO_CONTESTACAO
        )
        self.assertEqual(
            response.json()["dados"]["peticao"]["processo_id"], str(self.processo.pk)
        )

    def test_pendente_nao_exige_motivo(self):
        payload = self.payload()
        payload["motivo_pendente"] = ""

        response = self.client.post(
            reverse("criar_peticao"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Peticao.objects.count(), 1)
        self.assertEqual(Peticao.objects.get().status, Peticao.STATUS_PENDENTE)

    def test_peticao_pode_voltar_para_pendente_sem_motivo(self):
        peticao = Peticao.objects.create(
            cliente=self.cliente,
            adverso="Empresa adversa",
            responsavel_acao=self.usuario.nome,
            area_juridica="Civel",
            status=Peticao.STATUS_PROTOCOLADO,
        )
        payload = self.payload()
        payload["motivo_pendente"] = ""
        payload["status"] = Peticao.STATUS_PENDENTE

        response = self.client.put(
            reverse("editar_peticao", args=[peticao.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        peticao.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(peticao.status, Peticao.STATUS_PENDENTE)
        self.assertEqual(peticao.motivo_pendente, "")
