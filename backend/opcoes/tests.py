import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from usuarios.models import Usuario

from .models import OpcaoPersonalizada


class OpcoesViewsTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada",
            email="advogada@example.com",
            cargo="Administrador",
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email, email=self.usuario.email
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session["usuario_nome"] = self.usuario.nome
        session.save()

    def test_criar_e_listar_opcao(self):
        response = self.client.post(
            reverse("criar_opcao", args=["prospect_origem"]),
            data=json.dumps({"valor": "Evento"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(OpcaoPersonalizada.objects.count(), 1)

        response = self.client.get(reverse("listar_opcoes", args=["prospect_origem"]))
        self.assertEqual(response.status_code, 200)
        itens = response.json()["dados"]["itens"]
        self.assertEqual(len(itens), 1)
        self.assertEqual(itens[0]["valor"], "Evento")

    def test_criar_opcao_duplicada_nao_duplica(self):
        OpcaoPersonalizada.objects.create(campo="prospect_origem", valor="Evento")
        response = self.client.post(
            reverse("criar_opcao", args=["prospect_origem"]),
            data=json.dumps({"valor": "Evento"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(OpcaoPersonalizada.objects.count(), 1)

    def test_criar_opcao_campo_invalido(self):
        response = self.client.post(
            reverse("criar_opcao", args=["campo_qualquer"]),
            data=json.dumps({"valor": "Evento"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_criar_opcao_valor_vazio(self):
        response = self.client.post(
            reverse("criar_opcao", args=["prospect_origem"]),
            data=json.dumps({"valor": "   "}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_apagar_opcao(self):
        opcao = OpcaoPersonalizada.objects.create(campo="prospect_origem", valor="Evento")
        response = self.client.delete(
            reverse("apagar_opcao", args=["prospect_origem", opcao.pk])
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(OpcaoPersonalizada.objects.filter(pk=opcao.pk).exists())

    def test_listar_opcoes_isola_por_campo(self):
        OpcaoPersonalizada.objects.create(campo="prospect_origem", valor="Evento")
        OpcaoPersonalizada.objects.create(campo="processo_area", valor="Penal")
        response = self.client.get(reverse("listar_opcoes", args=["prospect_origem"]))
        itens = response.json()["dados"]["itens"]
        self.assertEqual(len(itens), 1)
        self.assertEqual(itens[0]["valor"], "Evento")
