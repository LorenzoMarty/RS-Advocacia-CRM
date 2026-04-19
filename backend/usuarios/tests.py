import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import TestCase, override_settings
from django.urls import reverse

from usuarios.models import Usuario


def make_google_response(payload):
    class Response:
        status_code = 200

        def json(self):
            return payload

    return Response()


class ExcluirCargoTests(TestCase):
    def setUp(self):
        self.auth_user = get_user_model().objects.create_superuser(
            username="admin@example.com",
            email="admin@example.com",
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

    def test_listagem_de_cargos_atende_formulario_de_usuario(self):
        staff = get_user_model().objects.create_user(
            username="staff@example.com",
            email="staff@example.com",
        )
        permission = Permission.objects.get(
            content_type__app_label="usuarios",
            codename="add_usuario",
        )
        staff.user_permissions.add(permission)
        self.client.force_login(staff)

        response = self.client.get(reverse("listar_cargos"))
        payload = response.json()

        self.assertEqual(response.status_code, 200, payload)
        self.assertTrue(payload["success"])
        self.assertTrue(payload["data"]["roles"])

    def test_usuario_atual_ressincroniza_permissoes_do_cargo(self):
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

        current_response = self.client.get(reverse("current_usuario"))
        create_response = self.client.post(
            reverse("criar_cargo"),
            data=json.dumps({"name": "Financeiro", "permissionIds": []}),
            content_type="application/json",
        )

        auth_user.refresh_from_db()
        self.assertEqual(current_response.status_code, 200)
        self.assertTrue(auth_user.groups.filter(name="Administrador").exists())
        self.assertTrue(auth_user.has_perm("auth.add_group"))
        self.assertEqual(create_response.status_code, 201, create_response.json())
        self.assertTrue(Group.objects.filter(name="Financeiro").exists())

    def test_bootstrap_serializa_role_id_com_id_do_cargo(self):
        usuario = Usuario.objects.create(
            nome="Usuario Admin",
            email="usuario-admin@example.com",
            cargo="admin",
        )

        response = self.client.get(reverse("bootstrap"))
        payload = response.json()

        cargo = Group.objects.get(name="Administrador")
        serialized_user = next(
            item for item in payload["data"]["users"] if item["id"] == str(usuario.pk)
        )
        self.assertEqual(response.status_code, 200, payload)
        self.assertEqual(serialized_user["roleId"], str(cargo.pk))

    @override_settings(GOOGLE_CLIENT_ID="")
    def test_google_login_exige_client_id_configurado(self):
        response = self.client.post(
            reverse("google_login"),
            data=json.dumps({"credential": "token-google"}),
            content_type="application/json",
        )
        payload = response.json()

        self.assertEqual(response.status_code, 503)
        self.assertFalse(payload["success"])

    @override_settings(GOOGLE_CLIENT_ID="google-client-id")
    @patch("usuarios.views.requests.get")
    def test_google_login_vincula_usuario_existente(self, requests_get):
        requests_get.return_value = make_google_response(
            {
                "sub": "google-sub-123",
                "email": "google-user@example.com",
                "email_verified": "true",
                "name": "Google User",
                "picture": "https://example.com/avatar.png",
                "aud": "google-client-id",
            }
        )
        usuario = Usuario.objects.create(
            nome="Google User",
            email="google-user@example.com",
            cargo="Operacional",
        )

        response = self.client.post(
            reverse("google_login"),
            data=json.dumps({"token": "token-google"}),
            content_type="application/json",
        )
        payload = response.json()

        usuario.refresh_from_db()
        self.assertEqual(response.status_code, 200, payload)
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"]["user"]["email"], usuario.email)
        self.assertEqual(payload["data"]["user"]["picture"], "https://example.com/avatar.png")
        self.assertEqual(usuario.google_sub, "google-sub-123")
        self.assertEqual(self.client.session["usuario_id"], usuario.pk)
        requests_get.assert_called_once_with(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": "token-google"},
            timeout=10,
        )

    @override_settings(GOOGLE_CLIENT_ID="google-client-id", GOOGLE_DEFAULT_CARGO="Operacional")
    @patch("usuarios.views.requests.get")
    def test_google_login_cria_usuario_automaticamente(self, requests_get):
        requests_get.return_value = make_google_response(
            {
                "sub": "google-sub-789",
                "email": "novo-google@example.com",
                "email_verified": "true",
                "name": "Novo Google",
                "picture": "https://example.com/novo.png",
                "aud": "google-client-id",
            }
        )

        response = self.client.post(
            reverse("google_login"),
            data=json.dumps({"token": "token-google"}),
            content_type="application/json",
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200, payload)
        self.assertTrue(payload["success"])
        usuario = Usuario.objects.get(email="novo-google@example.com")
        self.assertEqual(usuario.nome, "Novo Google")
        self.assertEqual(usuario.cargo, "Operacional")
        self.assertEqual(usuario.google_sub, "google-sub-789")
        self.assertEqual(usuario.picture, "https://example.com/novo.png")

    @override_settings(GOOGLE_CLIENT_ID="google-client-id")
    @patch("usuarios.views.requests.get")
    def test_google_login_rejeita_client_id_invalido(self, requests_get):
        requests_get.return_value = make_google_response(
            {
                "sub": "google-sub-bad",
                "email": "bad@example.com",
                "email_verified": "true",
                "name": "Bad Client",
                "aud": "outro-client-id",
            }
        )

        response = self.client.post(
            reverse("google_login"),
            data=json.dumps({"token": "token-google"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Usuario.objects.filter(email="bad@example.com").exists())

    def test_admin_nao_abre_cadastro_manual_de_usuario(self):
        response = self.client.get(reverse("admin:usuarios_usuario_add"))

        self.assertEqual(response.status_code, 403)

    def test_admin_abre_formulario_de_editar_cargo(self):
        cargo = Group.objects.create(name="Operacional")

        response = self.client.get(
            reverse("admin:usuarios_cargo_change", args=[cargo.pk])
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Operacional")
        self.assertContains(response, "Nome do cargo")

    def test_admin_cargo_usa_permissoes_de_auth_group(self):
        cargo = Group.objects.create(name="Operacional")
        staff = get_user_model().objects.create_user(
            username="staff@example.com",
            email="staff@example.com",
            is_staff=True,
        )
        permissions = Permission.objects.filter(
            content_type__app_label="auth",
            codename__in=["change_group", "view_group"],
        )
        staff.user_permissions.add(*permissions)
        self.client.force_login(staff)

        response = self.client.get(
            reverse("admin:usuarios_cargo_change", args=[cargo.pk])
        )

        self.assertEqual(response.status_code, 200)

    def test_admin_edita_cargo_e_sincroniza_usuarios_vinculados(self):
        cargo = Group.objects.create(name="Operacional")
        Usuario.objects.create(
            nome="Bianca",
            email="bianca@example.com",
            cargo=cargo.name,
        )

        response = self.client.post(
            reverse("admin:usuarios_cargo_change", args=[cargo.pk]),
            data={
                "name": "Financeiro",
                "permissions": [],
                "_save": "Salvar",
            },
        )

        self.assertEqual(response.status_code, 302)
        cargo.refresh_from_db()
        self.assertEqual(cargo.name, "Financeiro")
        self.assertEqual(
            Usuario.objects.get(email="bianca@example.com").cargo,
            "Financeiro",
        )

    def test_exclusao_informa_bloqueio_quando_ha_usuarios_vinculados(self):
        cargo = Group.objects.create(name="Administrador")
        Usuario.objects.create(
            nome="Renata",
            email="renata@example.com",
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
