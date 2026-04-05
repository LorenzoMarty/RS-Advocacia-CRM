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

        response = self.client.post(reverse("excluir_cargo", args=[cargo.pk]))

        self.assertRedirects(response, reverse("listar_cargos"))
        self.assertFalse(Group.objects.filter(pk=cargo.pk).exists())

    def test_listagem_exibe_link_de_exclusao_do_cargo(self):
        cargo = Group.objects.create(name="Operacional")

        response = self.client.get(reverse("listar_cargos"))

        self.assertContains(response, reverse("excluir_cargo", args=[cargo.pk]))

    def test_pagina_de_exclusao_informa_bloqueio_quando_ha_usuarios_vinculados(self):
        cargo = Group.objects.create(name="Administrador")
        Usuario.objects.create(
            nome="Renata",
            email="renata@example.com",
            senha="123456",
            cargo=cargo.name,
        )

        response = self.client.get(reverse("excluir_cargo", args=[cargo.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Exclusão indisponível no momento.")
        self.assertNotContains(response, "Confirmar exclusão")

    def test_nao_exclui_cargo_com_usuarios_vinculados(self):
        cargo = Group.objects.create(name="Operacional")
        Usuario.objects.create(
            nome="Lorena",
            email="lorena@example.com",
            senha="123456",
            cargo=cargo.name,
        )

        response = self.client.post(reverse("excluir_cargo", args=[cargo.pk]), follow=True)

        self.assertRedirects(response, reverse("detalhes_cargo", args=[cargo.pk]))
        self.assertContains(response, "Remova ou altere os usuários vinculados antes de excluir este cargo.")
        self.assertTrue(Group.objects.filter(pk=cargo.pk).exists())
