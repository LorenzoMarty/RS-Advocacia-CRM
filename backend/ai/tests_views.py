from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse

from ai.models import ConfiguracaoIA, UsoIA


class ConfiguracaoIAViewsTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username="admin@example.com", email="admin@example.com"
        )
        self.client.force_login(self.user)

    def test_get_sem_configuracao_retorna_nao_configurada(self):
        response = self.client.get(reverse("configuracao_ia"))

        self.assertEqual(response.status_code, 200)
        dados = response.json()["dados"]
        self.assertFalse(dados["configurada"])
        self.assertEqual(dados["api_key_mascarada"], "")

    def test_post_salva_key_e_mascara_na_resposta(self):
        response = self.client.post(
            reverse("configuracao_ia"),
            data={"api_key": "sk-abcdef1234"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        dados = response.json()["dados"]
        self.assertTrue(dados["configurada"])
        self.assertEqual(dados["api_key_mascarada"], "•" * 9 + "1234")
        self.assertEqual(ConfiguracaoIA.obter_api_key_ativa(), "sk-abcdef1234")

    def test_post_rejeita_key_vazia(self):
        response = self.client.post(
            reverse("configuracao_ia"),
            data={"api_key": "  "},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_delete_remove_key(self):
        self.client.post(
            reverse("configuracao_ia"),
            data={"api_key": "sk-abcdef1234"},
            content_type="application/json",
        )

        response = self.client.delete(reverse("configuracao_ia"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ConfiguracaoIA.obter_api_key_ativa(), "")

    def test_post_segunda_vez_atualiza_configuracao_existente(self):
        self.client.post(
            reverse("configuracao_ia"),
            data={"api_key": "sk-primeira"},
            content_type="application/json",
        )
        self.client.post(
            reverse("configuracao_ia"),
            data={"api_key": "sk-segunda"},
            content_type="application/json",
        )

        self.assertEqual(ConfiguracaoIA.objects.count(), 1)
        self.assertEqual(ConfiguracaoIA.obter_api_key_ativa(), "sk-segunda")


class ConfiguracaoIAPermissaoTests(TestCase):
    def test_usuario_sem_permissao_recebe_403(self):
        user = get_user_model().objects.create_user(
            username="comum@example.com", password="secret123"
        )
        user.user_permissions.add(Permission.objects.get(codename="view_cliente"))
        self.client.force_login(user)

        response = self.client.get(reverse("configuracao_ia"))

        self.assertEqual(response.status_code, 403)

    def test_usuario_nao_autenticado_recebe_401(self):
        response = self.client.get(reverse("configuracao_ia"))

        self.assertEqual(response.status_code, 401)


class CustoIAViewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username="admin@example.com", email="admin@example.com"
        )
        self.client.force_login(self.user)

    def test_custo_agrega_por_operacao_e_total(self):
        UsoIA.objects.create(
            operacao=UsoIA.OPERACAO_RESUMO,
            modelo="gpt-4.1-mini",
            tokens_entrada=1_000_000,
            tokens_saida=0,
        )
        UsoIA.objects.create(
            operacao=UsoIA.OPERACAO_TRANSCRICAO,
            modelo="gpt-4o-transcribe",
            tokens_entrada=1_000_000,
            tokens_saida=0,
        )

        response = self.client.get(reverse("custo_ia"))

        self.assertEqual(response.status_code, 200)
        dados = response.json()["dados"]
        self.assertAlmostEqual(dados["total_usd"], 0.40 + 6.00)
        self.assertEqual(len(dados["por_operacao"]), 2)
