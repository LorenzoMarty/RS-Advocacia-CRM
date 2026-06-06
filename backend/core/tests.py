from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings
from django.urls import reverse


class HealthEndpointTests(TestCase):
    def test_health_liveness_sempre_ok(self):
        response = self.client.get(reverse("health"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_health_rejeita_post(self):
        response = self.client.post(reverse("health"))
        self.assertEqual(response.status_code, 405)

    @override_settings(CELERY_BROKER_URL="")
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
