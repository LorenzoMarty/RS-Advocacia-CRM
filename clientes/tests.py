from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse

from clientes.forms import ClienteForm
from clientes.models import Cliente


class ClienteFormTests(TestCase):
    def test_clean_cpf_accepts_masked_cpf_and_stores_digits(self):
        form = ClienteForm(
            data={
                "nome": "Cliente CPF",
                "cpf": "123.456.789-01",
                "tipo_cliente": "esporadico",
                "telefone": "11999999999",
                "email": "cpf@example.com",
                "obs": "",
            }
        )

        self.assertTrue(form.is_valid())
        self.assertEqual(form.cleaned_data["cpf"], "12345678901")

    def test_clean_cpf_accepts_masked_cnpj_and_stores_digits(self):
        form = ClienteForm(
            data={
                "nome": "Cliente CNPJ",
                "cpf": "12.345.678/0001-99",
                "tipo_cliente": "mensalista",
                "telefone": "11999999999",
                "email": "cnpj@example.com",
                "obs": "",
            }
        )

        self.assertTrue(form.is_valid())
        self.assertEqual(form.cleaned_data["cpf"], "12345678000199")

    def test_clean_cpf_rejects_invalid_document_length(self):
        form = ClienteForm(
            data={
                "nome": "Cliente Invalido",
                "cpf": "12345",
                "tipo_cliente": "esporadico",
                "telefone": "11999999999",
                "email": "invalido@example.com",
                "obs": "",
            }
        )

        self.assertFalse(form.is_valid())
        self.assertIn("cpf", form.errors)


class ClienteListViewTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="cliente-viewer", password="secret123")
        permission = Permission.objects.get(codename="view_cliente")
        self.user.user_permissions.add(permission)
        self.client.force_login(self.user)

    def test_masked_document_search_matches_unformatted_value(self):
        Cliente.objects.create(
            nome="Cliente Documento",
            cpf="12345678901",
            tipo_cliente="esporadico",
            telefone="11999999999",
            email="cliente@example.com",
            obs="",
        )

        response = self.client.get(reverse("listar_clientes"), {"q": "123.456.789-01"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Cliente Documento")
