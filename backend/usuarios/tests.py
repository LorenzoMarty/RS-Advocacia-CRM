import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import Group, Permission
from django.test import TestCase, override_settings
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

    def test_listagem_de_cargos_atende_formulario_de_usuario(self):
        staff = get_user_model().objects.create_user(
            username="staff@example.com",
            email="staff@example.com",
            password="senha-forte-123",
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
            senha="123456",
            cargo="Administrador",
        )
        auth_user = get_user_model().objects.create_user(
            username=usuario.email,
            email=usuario.email,
            password="senha-forte-123",
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
            senha="123456",
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

    def test_cria_usuario_com_cargo_dinamico(self):
        cargo = Group.objects.create(name="Operacional")

        response = self.client.post(
            reverse("criar_usuario"),
            data=json.dumps(
                {
                    "name": "Marina",
                    "email": "marina@example.com",
                    "password": "123456",
                    "roleId": str(cargo.pk),
                }
            ),
            content_type="application/json",
        )
        payload = response.json()

        self.assertEqual(response.status_code, 201, payload)
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"]["user"]["email"], "marina@example.com")
        self.assertEqual(payload["data"]["user"]["roleId"], str(cargo.pk))
        usuario = Usuario.objects.get(email="marina@example.com")
        self.assertEqual(usuario.cargo, "Operacional")
        self.assertTrue(check_password("123456", usuario.senha))

    def test_admin_adiciona_usuario_com_cargo_dinamico(self):
        cargo = Group.objects.create(name="Operacional")

        response = self.client.post(
            reverse("admin:usuarios_usuario_add"),
            data={
                "nome": "Ana Paula",
                "email": "ana@example.com",
                "senha": "123456",
                "cargo": cargo.name,
                "_save": "Salvar",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(Usuario.objects.filter(email="ana@example.com").exists())
        usuario = Usuario.objects.get(email="ana@example.com")
        self.assertEqual(usuario.cargo, cargo.name)
        self.assertTrue(check_password("123456", usuario.senha))

    def test_login_aceita_senha_legada_e_atualiza_para_hash(self):
        Group.objects.create(name="Operacional")
        Usuario.objects.create(
            nome="Usuario Legado",
            email="legado@example.com",
            senha="123456",
            cargo="Operacional",
        )

        response = self.client.post(
            reverse("login"),
            data=json.dumps({"email": "legado@example.com", "password": "123456"}),
            content_type="application/json",
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200, payload)
        self.assertTrue(payload["success"])
        self.assertTrue(check_password("123456", Usuario.objects.get(email="legado@example.com").senha))

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
    def test_google_login_config_expõe_client_id_publico(self):
        response = self.client.get(reverse("google_login_config"))
        payload = response.json()

        self.assertEqual(response.status_code, 200, payload)
        self.assertTrue(payload["success"])
        self.assertTrue(payload["data"]["enabled"])
        self.assertEqual(payload["data"]["clientId"], "google-client-id")

    @override_settings(GOOGLE_CLIENT_ID="google-client-id")
    @patch("usuarios.views.requests.get")
    def test_google_login_vincula_usuario_existente(self, requests_get):
        requests_get.return_value.json.return_value = {
            "sub": "google-sub-123",
            "email": "google-user@example.com",
            "email_verified": "true",
            "name": "Google User",
            "aud": "google-client-id",
        }
        usuario = Usuario.objects.create(
            nome="Google User",
            email="google-user@example.com",
            senha="123456",
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
        self.assertEqual(usuario.google_sub, "google-sub-123")
        self.assertEqual(self.client.session["usuario_id"], usuario.pk)

    @override_settings(GOOGLE_CLIENT_ID="google-client-id")
    @patch("usuarios.views.requests.get")
    def test_google_login_bloqueia_usuario_nao_cadastrado(self, requests_get):
        requests_get.return_value.json.return_value = {
            "sub": "google-sub-456",
            "email": "sem-cadastro@example.com",
            "email_verified": "true",
            "name": "Sem Cadastro",
            "aud": "google-client-id",
        }

        response = self.client.post(
            reverse("google_login"),
            data=json.dumps({"token": "token-google"}),
            content_type="application/json",
        )
        payload = response.json()

        self.assertEqual(response.status_code, 403)
        self.assertFalse(payload["success"])
        self.assertFalse(Usuario.objects.filter(email="sem-cadastro@example.com").exists())

    @override_settings(
        GOOGLE_CLIENT_ID="google-client-id",
        GOOGLE_LOGIN_AUTO_CREATE=True,
        GOOGLE_DEFAULT_CARGO="Operacional",
    )
    @patch("usuarios.views.requests.get")
    def test_google_login_cria_usuario_quando_habilitado(self, requests_get):
        requests_get.return_value.json.return_value = {
            "sub": "google-sub-789",
            "email": "novo-google@example.com",
            "email_verified": "true",
            "name": "Novo Google",
            "aud": "google-client-id",
        }

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

    def test_admin_abre_formulario_de_adicionar_usuario(self):
        Group.objects.create(name="Operacional")

        response = self.client.get(reverse("admin:usuarios_usuario_add"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Operacional")

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
            password="senha-forte-123",
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
            senha="123456",
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
