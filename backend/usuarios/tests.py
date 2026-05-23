import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse

from integrations.models import GoogleAccount, GoogleCalendar
from usuarios.models import Usuario


class UsuariosTests(TestCase):
    def setUp(self):
        self.auth_user = get_user_model().objects.create_superuser(
            username="admin@example.com",
            email="admin@example.com",
        )
        self.client.force_login(self.auth_user)

    def test_exclui_cargo_sem_usuarios_vinculados(self):
        cargo = Group.objects.create(name="Operacional")
        response = self.client.delete(reverse("excluir_cargo", args=[cargo.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Group.objects.filter(pk=cargo.pk).exists())

    def test_nao_exclui_cargo_com_usuario_vinculado(self):
        cargo = Group.objects.create(name="Operacional")
        Usuario.objects.create(nome="Ana", email="ana@example.com", cargo=cargo.name)

        response = self.client.delete(reverse("excluir_cargo", args=[cargo.pk]))

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Group.objects.filter(pk=cargo.pk).exists())

    def test_usuario_atual_sincroniza_permissoes_do_cargo(self):
        usuario = Usuario.objects.create(
            nome="Admin Front",
            email="admin-front@example.com",
            cargo="Administrador",
        )
        auth_user = get_user_model().objects.create_user(
            username=usuario.email,
            email=usuario.email,
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = usuario.pk
        session.save()

        response = self.client.get(reverse("usuario_atual"))

        auth_user.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(auth_user.groups.filter(name="Administrador").exists())

    def test_serializa_conexao_google_a_partir_da_integracao(self):
        usuario = Usuario.objects.create(
            nome="Agenda",
            email="agenda@example.com",
            cargo="Administrador",
        )
        account = GoogleAccount.objects.create(
            usuario=usuario,
            google_user_id="sub-agenda",
            email=usuario.email,
        )
        account.store_tokens(access_token="access", refresh_token="refresh")
        account.save()
        GoogleCalendar.objects.create(
            account=account,
            calendar_id="primary",
            summary="Minha agenda",
            enabled=True,
        )

        response = self.client.get(reverse("inicializacao"))
        serialized = next(
            item
            for item in response.json()["dados"]["usuarios"]
            if item["id"] == str(usuario.pk)
        )

        self.assertTrue(serialized["google_calendar_conectado"])
        self.assertEqual(serialized["google_calendar_destino"], "Minha agenda")

    def test_admin_nao_abre_cadastro_manual_de_usuario(self):
        response = self.client.get(reverse("admin:usuarios_usuario_add"))

        self.assertEqual(response.status_code, 403)
