import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from clientes.models import Cliente
from prospeccao.models import InteracaoProspect, Prospect
from usuarios.models import Usuario


class ProspeccaoViewsTests(TestCase):
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

    def payload(self):
        return {
            "nome": "Cliente Potencial",
            "telefone": "11999999999",
            "email": "potencial@example.com",
            "origem_contato": "Indicação",
            "tipo_demanda_juridica": "Trabalhista",
            "descricao_caso": "Rescisão indireta",
            "responsavel_interno": self.usuario.pk,
            "status_prospeccao": "Novo",
            "prioridade": "Alta",
            "proxima_acao": "Ligar amanhã",
            "observacoes": "",
        }

    def test_criar_prospect(self):
        response = self.client.post(
            reverse("criar_prospect"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Prospect.objects.count(), 1)
        dados = response.json()["dados"]["prospect"]
        self.assertEqual(dados["status_prospeccao"], "Novo")
        self.assertEqual(dados["responsavel_nome"], "Advogada")

    def test_editar_prospect_muda_status(self):
        prospect = Prospect.objects.create(
            nome="Lead",
            status_prospeccao="Novo",
            prioridade="Media",
            responsavel_interno=self.usuario,
        )
        payload = self.payload()
        payload["status_prospeccao"] = "Em contato"

        response = self.client.put(
            reverse("editar_prospect", args=[prospect.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        prospect.refresh_from_db()
        self.assertEqual(prospect.status_prospeccao, "Em contato")

    def test_criar_interacao_atualiza_ultimo_contato(self):
        prospect = Prospect.objects.create(
            nome="Lead",
            status_prospeccao="Novo",
            prioridade="Media",
            responsavel_interno=self.usuario,
        )

        response = self.client.post(
            reverse("criar_interacao", args=[prospect.pk]),
            data=json.dumps({"tipo": "ligacao", "descricao": "Primeiro contato"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(InteracaoProspect.objects.count(), 1)
        prospect.refresh_from_db()
        self.assertIsNotNone(prospect.data_ultimo_contato)

    def test_converter_cria_cliente(self):
        prospect = Prospect.objects.create(
            nome="Lead Convert",
            email="lead@example.com",
            telefone="11988887777",
            status_prospeccao="Proposta enviada",
            prioridade="Alta",
            responsavel_interno=self.usuario,
        )

        response = self.client.post(
            reverse("converter_prospect", args=[prospect.pk]),
            data=json.dumps({"cpf": "12345678901", "tipo_cliente": "esporadico"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(Cliente.objects.count(), 1)
        prospect.refresh_from_db()
        self.assertIsNotNone(prospect.cliente_convertido_id)
        self.assertEqual(prospect.status_prospeccao, "Convertido")

    def test_converter_vincula_cliente_existente(self):
        cliente = Cliente.objects.create(
            nome="Existente",
            email="existente@example.com",
            telefone="11900000000",
            cpf="12345678901",
            tipo_cliente="esporadico",
        )
        prospect = Prospect.objects.create(
            nome="Lead Link",
            status_prospeccao="Proposta enviada",
            prioridade="Alta",
            responsavel_interno=self.usuario,
        )

        response = self.client.post(
            reverse("converter_prospect", args=[prospect.pk]),
            data=json.dumps({"cliente_id": cliente.pk}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(Cliente.objects.count(), 1)
        prospect.refresh_from_db()
        self.assertEqual(prospect.cliente_convertido_id, cliente.pk)

    def test_bloqueia_dupla_conversao(self):
        cliente = Cliente.objects.create(
            nome="Existente",
            email="existente@example.com",
            telefone="11900000000",
            cpf="12345678901",
            tipo_cliente="esporadico",
        )
        prospect = Prospect.objects.create(
            nome="Lead Done",
            status_prospeccao="Convertido",
            prioridade="Alta",
            responsavel_interno=self.usuario,
            cliente_convertido=cliente,
        )

        response = self.client.post(
            reverse("converter_prospect", args=[prospect.pk]),
            data=json.dumps({"cliente_id": cliente.pk}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409, response.json())
