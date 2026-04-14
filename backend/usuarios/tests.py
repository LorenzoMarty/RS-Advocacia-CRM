from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse

from usuarios.models import Usuario


class ExcluirCargoTests(TestCase):
    def setUp(self):
        self.auth_user = get_user_model().objects.create_superuser(
            username="admin@example.com",
            email="admin@example.com",
            password="senha-forte-123",
        )
        self.client.force_login(self.auth_user)

    def test_exclui_cargo_sem_usuarios_vinculados(self):
        cargo = Group.objects.create(name="Operacional")

        response = self.client.delete(reverse("excluir_cargo", args=[cargo.pk]))
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"]["id"], str(cargo.pk))
        self.assertFalse(Group.objects.filter(pk=cargo.pk).exists())

    def test_listagem_inclui_cargo_serializado(self):
        cargo = Group.objects.create(name="Operacional")

        response = self.client.get(reverse("listar_cargos"))
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["success"])
        self.assertIn(
            {"id": str(cargo.pk), "name": cargo.name},
            [
                {"id": item["id"], "name": item["name"]}
                for item in payload["data"]["cargos"]
            ],
        )

    def test_exclusao_informa_bloqueio_quando_ha_usuarios_vinculados(self):
        cargo = Group.objects.create(name="Administrador")
        Usuario.objects.create(
            nome="Renata",
            email="renata@example.com",
            senha="123456",
            cargo=cargo.name,
        )

        response = self.client.delete(reverse("excluir_cargo", args=[cargo.pk]))
        payload = response.json()

        self.assertEqual(response.status_code, 409)
        self.assertFalse(payload["success"])
        self.assertIn("cargo", payload["errors"])
        self.assertTrue(Group.objects.filter(pk=cargo.pk).exists())

    def test_nao_exclui_cargo_com_usuarios_vinculados(self):
        cargo = Group.objects.create(name="Operacional")
        Usuario.objects.create(
            nome="Lorena",
            email="lorena@example.com",
            senha="123456",
            cargo=cargo.name,
        )

        response = self.client.delete(reverse("excluir_cargo", args=[cargo.pk]))
        payload = response.json()

        self.assertEqual(response.status_code, 409)
        self.assertFalse(payload["success"])
        self.assertEqual(
            payload["errors"]["cargo"],
            ["Remova ou altere os usuarios vinculados antes de excluir este cargo."],
        )
        self.assertTrue(Group.objects.filter(pk=cargo.pk).exists())
