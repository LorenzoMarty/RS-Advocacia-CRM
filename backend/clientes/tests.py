import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse

from clientes.forms import ClienteForm
from clientes.models import Cliente


def _payload_valido():
    return {
        "nome": "Cliente API",
        "cpf": "529.982.247-25",
        "tipo_cliente": "esporadico",
        "parceria": "",
        "telefone": "11999999999",
        "email": "cliente-api@example.com",
        "obs": "",
    }


class ClienteFormTests(TestCase):
    def test_clean_cpf_accepts_masked_cpf_and_stores_digits(self):
        form = ClienteForm(
            data={
                "nome": "Cliente CPF",
                "cpf": "529.982.247-25",
                "tipo_cliente": "esporadico",
                "telefone": "11999999999",
                "email": "cpf@example.com",
                "obs": "",
            }
        )

        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["cpf"], "52998224725")

    def test_clean_cpf_accepts_masked_cnpj_and_stores_digits(self):
        form = ClienteForm(
            data={
                "nome": "Cliente CNPJ",
                "cpf": "11.444.777/0001-61",
                "tipo_cliente": "mensalista",
                "telefone": "11999999999",
                "email": "cnpj@example.com",
                "obs": "",
            }
        )

        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["cpf"], "11444777000161")

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
        self.user = user_model.objects.create_user(
            username="cliente-viewer", password="secret123"
        )
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
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["sucesso"])
        self.assertEqual(payload["dados"]["clientes"][0]["nome"], "Cliente Documento")


class ClienteApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="cliente-user", password="secret123"
        )

    def _grant(self, *codenames):
        for codename in codenames:
            self.user.user_permissions.add(
                Permission.objects.get(
                    content_type__app_label="clientes", codename=codename
                )
            )

    def test_listar_exige_autenticacao(self):
        self.assertEqual(self.client.get(reverse("listar_clientes")).status_code, 401)

    def test_listar_403_sem_permissao(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse("listar_clientes")).status_code, 403)

    def test_criar_com_permissao(self):
        self._grant("add_cliente")
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("criar_cliente"),
            data=json.dumps(_payload_valido()),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        payload = response.json()
        self.assertTrue(payload["sucesso"])
        self.assertEqual(Cliente.objects.count(), 1)

    def test_criar_sem_permissao_403(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("criar_cliente"),
            data=json.dumps(_payload_valido()),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    @patch(
        "clientes.views.documentos_tasks.renomear_pasta_cliente.delay",
        return_value=None,
    )
    def test_editar_atualiza_campo_e_dispara_rename_assincrono(self, mock_delay):
        self._grant("change_cliente")
        cliente = Cliente.objects.create(
            nome="Cliente Original",
            cpf="52998224725",
            tipo_cliente="esporadico",
            telefone="11999999999",
            email="cliente@example.com",
            obs="",
        )
        self.client.force_login(self.user)
        payload = _payload_valido()
        payload["nome"] = "Cliente Renomeado"
        response = self.client.put(
            reverse("editar_cliente", args=[cliente.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        cliente.refresh_from_db()
        self.assertEqual(cliente.nome, "Cliente Renomeado")
        mock_delay.assert_called_once_with(cliente.pk, None, "Cliente Renomeado")

    def test_excluir_remove_registro(self):
        self._grant("delete_cliente")
        cliente = Cliente.objects.create(
            nome="Cliente Exclusao",
            cpf="11444777000161",
            tipo_cliente="mensalista",
            telefone="11999999999",
            email="exclusao@example.com",
            obs="",
        )
        self.client.force_login(self.user)
        response = self.client.delete(reverse("excluir_cliente", args=[cliente.pk]))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Cliente.objects.count(), 0)
