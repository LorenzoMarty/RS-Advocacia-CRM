import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase
from django.urls import reverse

from integrations.models import GoogleAccount, GoogleCalendar
from usuarios.models import Usuario
from usuarios.views import _ensure_default_cargos


class UsuariosTests(TestCase):
    def setUp(self):
        self.auth_user = get_user_model().objects.create_superuser(
            username="admin@example.com",
            email="admin@example.com",
        )
        self.client.force_login(self.auth_user)

    def test_ensure_default_cargos_semeia_padroes_em_base_sem_cargos(self):
        _ensure_default_cargos()

        nomes = {
            cargo.name for cargo in Group.objects.order_by("name")
        }
        self.assertTrue(set(dict(Usuario.TIPOS).values()).issubset(nomes))

    def test_ensure_default_cargos_nao_recria_padrao_removido_em_base_inicializada(self):
        admin = Group.objects.create(name="Administrador")
        Group.objects.create(name="Operacional")
        admin.delete()

        _ensure_default_cargos()

        nomes = {
            cargo.name for cargo in Group.objects.order_by("name")
        }
        self.assertNotIn("Administrador", nomes)
        self.assertIn("Operacional", nomes)

    def test_ensure_default_cargos_remove_assistente_juridico(self):
        Group.objects.create(name="Advogado")
        Group.objects.create(name="Assistente Jurídico")
        usuario = Usuario.objects.create(
            nome="Assistente",
            email="assistente@example.com",
            cargo="Assistente Jurídico",
        )

        _ensure_default_cargos()

        usuario.refresh_from_db()
        self.assertEqual(usuario.cargo, "Advogado")
        self.assertFalse(Group.objects.filter(name="Assistente Jurídico").exists())

    def test_advogado_e_estagiario_tem_mesmas_permissoes_operacionais(self):
        _ensure_default_cargos()

        advogado = Group.objects.get(name="Advogado")
        estagiario = Group.objects.get(name=dict(Usuario.TIPOS)["estagiario"])
        advogado_permissions = {
            f"{app_label}.{codename}"
            for app_label, codename in advogado.permissions.values_list(
                "content_type__app_label", "codename"
            )
        }
        estagiario_permissions = {
            f"{app_label}.{codename}"
            for app_label, codename in estagiario.permissions.values_list(
                "content_type__app_label", "codename"
            )
        }
        forbidden_apps = {"financeiro", "usuarios", "auth"}

        self.assertEqual(advogado_permissions, estagiario_permissions)
        self.assertIn("clientes.delete_cliente", advogado_permissions)
        self.assertIn("processos.delete_processo", advogado_permissions)
        self.assertIn("documentos.add_documentocliente", advogado_permissions)
        self.assertFalse(
            forbidden_apps
            & set(
                advogado.permissions.values_list(
                    "content_type__app_label", flat=True
                )
            )
        )

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

    def test_cria_usuario_pela_api(self):
        cargo = Group.objects.create(name="Operacional")
        response = self.client.post(
            reverse("criar_usuario"),
            data=json.dumps(
                {
                    "nome": "Novo Usuario",
                    "email": "novo@example.com",
                    "cargo_id": str(cargo.pk),
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        usuario = Usuario.objects.get(email="novo@example.com")
        auth_user = get_user_model().objects.get(email="novo@example.com")
        self.assertEqual(usuario.cargo, cargo.name)
        self.assertTrue(auth_user.groups.filter(name=cargo.name).exists())
        self.assertEqual(response.json()["dados"]["usuario"]["id"], str(usuario.pk))

    def test_admin_nao_abre_cadastro_manual_de_usuario(self):
        response = self.client.get(reverse("admin:usuarios_usuario_add"))

        self.assertEqual(response.status_code, 403)

    def test_sync_cargos_dry_run_nao_persiste_alteracoes(self):
        usuario = Usuario.objects.create(
            nome="Estagio",
            email="estagio@example.com",
            cargo="estagiario",
        )
        auth_user = get_user_model().objects.create_user(
            username=usuario.email,
            email=usuario.email,
        )

        call_command("sync_cargos", stdout=StringIO())

        usuario.refresh_from_db()
        auth_user.refresh_from_db()
        self.assertEqual(usuario.cargo, "estagiario")
        self.assertFalse(auth_user.groups.exists())

    def test_sync_cargos_write_normaliza_cargo_e_grupo_do_auth_user(self):
        usuario = Usuario.objects.create(
            nome="Estagio",
            email="estagio-write@example.com",
            cargo="estagiario",
        )
        auth_user = get_user_model().objects.create_user(
            username=usuario.email,
            email=usuario.email,
        )
        cargo_label = dict(Usuario.TIPOS)["estagiario"]

        call_command("sync_cargos", "--write", stdout=StringIO())

        usuario.refresh_from_db()
        auth_user.refresh_from_db()
        self.assertEqual(usuario.cargo, cargo_label)
        self.assertTrue(auth_user.groups.filter(name=cargo_label).exists())


class UsuariosInicializacaoParaleloTests(TransactionTestCase):
    # TransactionTestCase (não TestCase): a view /inicializacao/ roda queries
    # em threads próprias (core.views._executar_em_paralelo), cada uma com sua
    # conexão de banco. Sob TestCase normal (rollback por savepoint), essas
    # conexões não enxergam dados criados na mesma transação de teste.
    def setUp(self):
        self.auth_user = get_user_model().objects.create_superuser(
            username="admin@example.com",
            email="admin@example.com",
        )
        self.client.force_login(self.auth_user)

    def test_serializa_conexao_google_a_partir_da_integracao(self):
        usuario = Usuario.objects.create(
            nome="Agenda",
            email="agenda@example.com",
            cargo="Administrador",
        )
        session = self.client.session
        session["usuario_id"] = usuario.pk
        session.save()

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

        cache.clear()
        response = self.client.get(reverse("inicializacao"))
        serialized = next(
            item
            for item in response.json()["dados"]["usuarios"]
            if item["id"] == str(usuario.pk)
        )

        self.assertTrue(serialized["google_calendar_conectado"])
        self.assertEqual(serialized["google_calendar_destino"], "Minha agenda")
