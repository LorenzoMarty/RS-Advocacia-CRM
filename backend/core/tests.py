from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse

from core.br_identifiers import (
    classificar_por_palavras,
    extrair_cnj,
    extrair_cpf_cnpj,
    validar_cnj,
    validar_cnpj,
    validar_cpf,
    validar_cpf_cnpj,
)


class HealthEndpointTests(TestCase):
    def test_health_liveness_sempre_ok(self):
        response = self.client.get(reverse("health"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_health_rejeita_post(self):
        response = self.client.post(reverse("health"))
        self.assertEqual(response.status_code, 405)

    @override_settings(
        CELERY_BROKER_URL="",
        CACHES={
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            }
        },
    )
    def test_ready_ok_quando_db_e_cache_saudaveis(self):
        response = self.client.get(reverse("ready"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["checks"]["database"], "ok")
        self.assertEqual(payload["checks"]["cache"], "ok")
        self.assertNotIn("broker", payload["checks"])

    def test_ready_falha_quando_broker_indisponivel(self):
        # Porta sem broker => readiness deve falhar com 503 e broker="error".
        with override_settings(CELERY_BROKER_URL="redis://127.0.0.1:6399/0"):
            response = self.client.get(reverse("ready"))
        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["status"], "error")
        self.assertEqual(payload["checks"]["broker"], "error")


class BootstrapEndpointAuthTests(TestCase):
    VIEW_PERMISSIONS = [
        "agenda.view_evento",
        "peticoes.view_peticao",
        "prazos.view_prazo",
        "clientes.view_cliente",
        "processos.view_processo",
    ]

    def _grant(self, user, perms):
        for perm in perms:
            app_label, codename = perm.split(".")
            user.user_permissions.add(
                Permission.objects.get(
                    content_type__app_label=app_label, codename=codename
                )
            )

    def test_painel_exige_autenticacao(self):
        self.assertEqual(self.client.get(reverse("painel")).status_code, 401)

    def test_painel_403_sem_permissao(self):
        user = get_user_model().objects.create_user(
            username="semperm", password="secret123"
        )
        self.client.force_login(user)
        self.assertEqual(self.client.get(reverse("painel")).status_code, 403)

    def test_painel_200_com_permissoes(self):
        user = get_user_model().objects.create_user(
            username="comperm", password="secret123"
        )
        self._grant(user, self.VIEW_PERMISSIONS)
        self.client.force_login(user)
        response = self.client.get(reverse("painel"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["sucesso"])

    def test_inicializacao_200_com_permissoes(self):
        user = get_user_model().objects.create_user(
            username="initperm", password="secret123"
        )
        self._grant(user, self.VIEW_PERMISSIONS)
        self.client.force_login(user)
        response = self.client.get(reverse("inicializacao"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["sucesso"])


class BrIdentifiersTests(SimpleTestCase):
    CPF_VALIDO = "12345678909"
    CNPJ_VALIDO = "11044400000115"
    CNJ_VALIDO_FORMATADO = "1234567-79.2024.8.13.0001"
    CNJ_VALIDO_DIGITOS = "12345677920248130001"

    def test_validar_cpf_aceita_numero_valido(self):
        self.assertTrue(validar_cpf(self.CPF_VALIDO))

    def test_validar_cpf_rejeita_digito_verificador_errado(self):
        self.assertFalse(validar_cpf("12345678900"))

    def test_validar_cpf_rejeita_todos_digitos_iguais(self):
        self.assertFalse(validar_cpf("11111111111"))

    def test_validar_cnpj_aceita_numero_valido(self):
        self.assertTrue(validar_cnpj(self.CNPJ_VALIDO))

    def test_validar_cnpj_rejeita_digito_verificador_errado(self):
        self.assertFalse(validar_cnpj("11044400000100"))

    def test_validar_cpf_cnpj_detecta_pelo_tamanho(self):
        self.assertTrue(validar_cpf_cnpj(self.CPF_VALIDO))
        self.assertTrue(validar_cpf_cnpj(self.CNPJ_VALIDO))
        self.assertFalse(validar_cpf_cnpj("123"))

    def test_validar_cnj_aceita_formatado_e_digitos(self):
        self.assertTrue(validar_cnj(self.CNJ_VALIDO_FORMATADO))
        self.assertTrue(validar_cnj(self.CNJ_VALIDO_DIGITOS))

    def test_validar_cnj_rejeita_digito_verificador_errado(self):
        self.assertFalse(validar_cnj("1234567-00.2024.8.13.0001"))

    def test_extrair_cnj_encontra_no_nome_de_arquivo(self):
        texto = f"Processo {self.CNJ_VALIDO_FORMATADO} - peticao inicial.pdf"
        self.assertEqual(extrair_cnj(texto), [self.CNJ_VALIDO_FORMATADO])

    def test_extrair_cnj_ignora_numero_invalido(self):
        self.assertEqual(extrair_cnj("Documento 1234567-00.2024.8.13.0001.pdf"), [])

    def test_extrair_cpf_cnpj_encontra_sem_pontuacao(self):
        texto = f"CPF_{self.CPF_VALIDO}_doc.pdf"
        self.assertEqual(extrair_cpf_cnpj(texto), [self.CPF_VALIDO])

    def test_classificar_por_palavras_identifica_processo(self):
        self.assertEqual(
            classificar_por_palavras("Peticao inicial processo.pdf"), "processo"
        )

    def test_classificar_por_palavras_identifica_pessoal(self):
        self.assertEqual(
            classificar_por_palavras("RG comprovante residencia.pdf"), "pessoal"
        )

    def test_classificar_por_palavras_sem_pista_retorna_none(self):
        self.assertIsNone(classificar_por_palavras("foto.jpg"))
