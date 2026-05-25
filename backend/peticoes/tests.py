import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from clientes.models import Cliente
from peticoes.models import Peticao
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

    def payload(self):
        return {
            "cliente": self.cliente.pk,
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
        self.assertEqual(response.json()["dados"]["peticao"]["adverso"], "Empresa adversa")

    def test_pendente_exige_motivo(self):
        payload = self.payload()
        payload["motivo_pendente"] = ""

        response = self.client.post(
            reverse("criar_peticao"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Peticao.objects.count(), 0)
