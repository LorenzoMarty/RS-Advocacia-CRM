import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse

from clientes.models import Cliente
from processos.forms import ProcessoForm
from processos.models import Processo
from usuarios.models import Usuario


def _payload_valido(cliente, responsavel="Dra. Ana"):
    return {
        "numero_processo": "0001234-55.2024.8.26.0100",
        "cliente": cliente.pk,
        "descricao": "Ação de cobrança",
        "vara": "1ª Vara Cível",
        "area_juridica": "Cível",
        "status": "Ativo",
        "advogado_responsavel": responsavel,
    }


class ProcessoFormTests(TestCase):
    def setUp(self):
        self.cliente = Cliente.objects.create(
            nome="Cliente Teste",
            cpf="12345678901",
            tipo_cliente="esporadico",
            telefone="11999999999",
            email="cliente@example.com",
            obs="",
        )
        Usuario.objects.create(
            nome="Dra. Ana", email="ana@example.com", cargo="Advogado"
        )

    def test_form_valido(self):
        form = ProcessoForm(_payload_valido(self.cliente))
        self.assertTrue(form.is_valid(), form.errors)

    def test_form_rejeita_responsavel_fora_das_opcoes(self):
        form = ProcessoForm(_payload_valido(self.cliente, responsavel="Inexistente"))
        self.assertFalse(form.is_valid())
        self.assertIn("advogado_responsavel", form.errors)

    def test_form_exige_numero_processo(self):
        payload = _payload_valido(self.cliente)
        payload["numero_processo"] = ""
        form = ProcessoForm(payload)
        self.assertFalse(form.is_valid())
        self.assertIn("numero_processo", form.errors)


class ProcessoApiTests(TestCase):
    def setUp(self):
        self.cliente = Cliente.objects.create(
            nome="Cliente API",
            cpf="98765432100",
            tipo_cliente="mensalista",
            telefone="11888888888",
            email="api@example.com",
            obs="",
        )
        Usuario.objects.create(
            nome="Dra. Ana", email="ana@example.com", cargo="Advogado"
        )
        self.user = get_user_model().objects.create_user(
            username="proc-user", password="secret123"
        )

    def _grant(self, *codenames):
        for codename in codenames:
            self.user.user_permissions.add(
                Permission.objects.get(
                    content_type__app_label="processos", codename=codename
                )
            )

    def test_listar_exige_autenticacao(self):
        self.assertEqual(self.client.get(reverse("listar_processos")).status_code, 401)

    def test_listar_403_sem_permissao(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse("listar_processos")).status_code, 403)

    def test_criar_com_permissao(self):
        self._grant("add_processo")
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("criar_processo"),
            data=json.dumps(_payload_valido(self.cliente)),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        payload = response.json()
        self.assertTrue(payload["sucesso"])
        self.assertEqual(Processo.objects.count(), 1)

    def test_criar_sem_permissao_403(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("criar_processo"),
            data=json.dumps(_payload_valido(self.cliente)),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_editar_atualiza_campo(self):
        self._grant("change_processo")
        processo = Processo.objects.create(
            numero_processo="0001",
            cliente=self.cliente,
            descricao="",
            vara="1ª Vara Cível",
            area_juridica="Cível",
            status="Ativo",
            advogado_responsavel="Dra. Ana",
        )
        self.client.force_login(self.user)
        payload = _payload_valido(self.cliente)
        payload["status"] = "Concluído"
        response = self.client.put(
            reverse("editar_processo", args=[processo.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        processo.refresh_from_db()
        self.assertEqual(processo.status, "Concluído")

    def test_excluir_remove_registro(self):
        self._grant("delete_processo")
        processo = Processo.objects.create(
            numero_processo="0002",
            cliente=self.cliente,
            descricao="",
            vara="1ª Vara Cível",
            area_juridica="Cível",
            status="Ativo",
            advogado_responsavel="Dra. Ana",
        )
        self.client.force_login(self.user)
        response = self.client.delete(reverse("excluir_processo", args=[processo.pk]))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Processo.objects.count(), 0)
