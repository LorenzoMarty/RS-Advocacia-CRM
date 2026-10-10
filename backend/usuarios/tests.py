import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase
from django.urls import reverse

from auditoria.models import RegistroAuditoria
from integrations.models import GoogleAccount, GoogleCalendar
from usuarios import views as usuarios_views
from usuarios.models import Cargo, Usuario
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


class UsuariosApiFluxoTests(TestCase):
    """CRUD de usuários, sessão e sincronização com o auth user do Django."""

    def setUp(self):
        self.admin = Usuario.objects.create(
            nome="Admin", email="admin@example.com", cargo="Administrador"
        )
        self.auth_admin = get_user_model().objects.create_superuser(
            username=self.admin.email, email=self.admin.email
        )
        self.client.force_login(self.auth_admin)
        session = self.client.session
        session["usuario_id"] = self.admin.pk
        session.save()

    def _json(self, method, url, body):
        return getattr(self.client, method)(
            url, data=json.dumps(body), content_type="application/json"
        )

    def _usuario(self, nome="Fulano", email="fulano@example.com", cargo="Advogado"):
        return Usuario.objects.create(nome=nome, email=email, cargo=cargo)

    def test_listar_pagina_e_exige_permissao(self):
        self._usuario()
        response = self.client.get(reverse("listar_usuarios"))
        self.assertEqual(response.status_code, 200, response.content)
        dados = response.json()["dados"]
        self.assertEqual([u["nome"] for u in dados["usuarios"]], ["Admin", "Fulano"])
        self.assertIn("paginacao", dados)
        self.assertEqual(self.client.post(reverse("listar_usuarios")).status_code, 405)

        comum = get_user_model().objects.create_user(username="comum", password="x")
        self.client.force_login(comum)
        self.assertEqual(self.client.get(reverse("listar_usuarios")).status_code, 403)

    def test_criar_por_nome_de_cargo_e_erros(self):
        url = reverse("criar_usuario")
        ok = self._json(
            "post", url, {"nome": "Nova", "email": "nova@example.com", "cargo": "Advogado"}
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        auth_user = get_user_model().objects.get(email="nova@example.com")
        self.assertFalse(auth_user.has_usable_password())
        self.assertEqual(auth_user.first_name, "Nova")
        self.assertTrue(auth_user.groups.filter(name="Advogado").exists())

        duplicado = self._json(
            "post", url, {"nome": "Outra", "email": "nova@example.com", "cargo": "Advogado"}
        )
        self.assertEqual(duplicado.status_code, 400)
        self.assertIn("email", duplicado.json()["erros"])
        quebrado = self.client.post(url, data="x", content_type="application/json")
        self.assertEqual(quebrado.status_code, 400)
        self.assertEqual(self.client.get(url).status_code, 405)

    def test_detalhes_e_404(self):
        usuario = self._usuario()
        response = self.client.get(reverse("detalhes_usuario", args=[usuario.pk]))
        self.assertEqual(response.json()["dados"]["usuario"]["email"], usuario.email)
        self.assertTrue(get_user_model().objects.filter(email=usuario.email).exists())
        self.assertEqual(self.client.get(reverse("detalhes_usuario", args=[99999])).status_code, 404)
        self.assertEqual(self.client.post(reverse("detalhes_usuario", args=[usuario.pk])).status_code, 405)

    def test_editar_renomeia_auth_user_e_troca_grupo(self):
        usuario = self._usuario()
        self._json(
            "put",
            reverse("editar_usuario", args=[usuario.pk]),
            {"nome": "Fulano", "email": usuario.email, "cargo": "Advogado"},
        )
        auth_user = get_user_model().objects.get(email=usuario.email)

        response = self._json(
            "put",
            reverse("editar_usuario", args=[usuario.pk]),
            {"nome": "Fulano Silva", "email": "novo@example.com", "cargo": "Administrador"},
        )
        self.assertEqual(response.status_code, 200, response.content)
        auth_user.refresh_from_db()
        self.assertEqual(
            (auth_user.username, auth_user.email, auth_user.first_name),
            ("novo@example.com", "novo@example.com", "Fulano Silva"),
        )
        self.assertEqual([g.name for g in auth_user.groups.all()], ["Administrador"])

    def test_editar_erros(self):
        usuario = self._usuario()
        url = reverse("editar_usuario", args=[usuario.pk])
        self.assertEqual(self._json("put", url, {"nome": ""}).status_code, 400)
        self.assertEqual(self.client.put(url, data="x", content_type="application/json").status_code, 400)
        self.assertEqual(self.client.get(url).status_code, 405)
        self.assertEqual(self._json("put", reverse("editar_usuario", args=[99999]), {}).status_code, 404)

    def test_excluir_remove_usuario_auth_user_e_audita(self):
        usuario = self._usuario()
        self._json(
            "put",
            reverse("editar_usuario", args=[usuario.pk]),
            {"nome": usuario.nome, "email": usuario.email, "cargo": "Advogado"},
        )
        response = self.client.delete(reverse("excluir_usuario", args=[usuario.pk]))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(Usuario.objects.filter(pk=usuario.pk).exists())
        self.assertFalse(get_user_model().objects.filter(email=usuario.email).exists())
        self.assertTrue(
            RegistroAuditoria.objects.filter(
                acao=RegistroAuditoria.ACAO_EXCLUIDO,
                entidade_tipo=RegistroAuditoria.ENTIDADE_USUARIO,
                entidade_rotulo="Fulano",
            ).exists()
        )

    def test_excluir_protege_o_proprio_usuario_e_o_ultimo_admin(self):
        proprio = self.client.delete(reverse("excluir_usuario", args=[self.admin.pk]))
        self.assertEqual(proprio.status_code, 400)

        outro_admin_logado = self._usuario("Outro", "outro@example.com", "Administrador")
        auth_outro = get_user_model().objects.create_superuser(
            username=outro_admin_logado.email, email=outro_admin_logado.email
        )
        self.client.force_login(auth_outro)
        session = self.client.session
        session["usuario_id"] = outro_admin_logado.pk
        session.save()
        # há dois admins: excluir o primeiro é permitido
        ok = self.client.delete(reverse("excluir_usuario", args=[self.admin.pk]))
        self.assertEqual(ok.status_code, 200, ok.content)

        # agora só resta um admin: um superuser sem Usuario tenta excluí-lo
        sem_usuario = get_user_model().objects.create_superuser(
            username="root", email="root@example.com"
        )
        self.client.force_login(sem_usuario)
        session = self.client.session
        session.pop("usuario_id", None)
        session.save()
        ultimo = self.client.delete(reverse("excluir_usuario", args=[outro_admin_logado.pk]))
        self.assertEqual(ultimo.status_code, 400)
        self.assertIn("último Administrador", ultimo.json()["erros"]["usuario"][0])

    def test_excluir_404_e_metodo(self):
        self.assertEqual(self.client.delete(reverse("excluir_usuario", args=[99999])).status_code, 404)
        self.assertEqual(self.client.get(reverse("excluir_usuario", args=[self.admin.pk])).status_code, 405)

    def test_sair_encerra_sessao_e_limpa_chaves_do_usuario(self):
        session = self.client.session
        session["usuario_nome"] = "Admin"
        session["usuario_email"] = self.admin.email
        session.save()
        response = self.client.post(reverse("sair_autenticacao"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(reverse("usuario_atual")).json()["dados"]["usuario"], None)
        self.assertNotIn("usuario_id", self.client.session)
        self.assertEqual(self.client.get(reverse("sair_autenticacao")).status_code, 405)
        # anônimo também pode chamar sem erro
        self.assertEqual(self.client.post(reverse("sair_autenticacao")).status_code, 200)

    def test_usuario_atual_resolve_por_email_e_lembra_na_sessao(self):
        session = self.client.session
        session.pop("usuario_id", None)
        session.save()
        response = self.client.get(reverse("usuario_atual"))
        self.assertEqual(response.json()["dados"]["usuario"]["id"], str(self.admin.pk))
        self.assertEqual(self.client.session["usuario_id"], self.admin.pk)
        self.assertEqual(self.client.post(reverse("usuario_atual")).status_code, 405)

    def test_usuario_atual_anonimo_retorna_none(self):
        anonimo = self.client_class()
        response = anonimo.get(reverse("usuario_atual"))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["dados"]["usuario"])


class CargoPermissionsTests(TestCase):
    def test_administrador_recebe_todas_as_permissoes(self):
        cargo = Cargo.objects.create(name="Administrador")
        usuarios_views._apply_default_cargo_permissions(cargo)
        self.assertEqual(cargo.permissions.count(), Permission.objects.count())

    def test_cargo_padrao_so_recebe_apps_operacionais(self):
        cargo = Cargo.objects.create(name="Advogado")
        usuarios_views._apply_default_cargo_permissions(cargo)
        apps = set(cargo.permissions.values_list("content_type__app_label", flat=True))
        self.assertTrue(apps)
        self.assertTrue(apps.issubset(set(usuarios_views.STANDARD_CARGO_PERMISSION_APP_LABELS)))
        self.assertNotIn("usuarios", apps)
        self.assertNotIn("financeiro", apps)

    def test_cargo_personalizado_nao_tem_permissoes_alteradas(self):
        cargo = Cargo.objects.create(name="Operacional")
        permissao = Permission.objects.first()
        cargo.permissions.add(permissao)
        usuarios_views._apply_default_cargo_permissions(cargo)
        self.assertEqual(list(cargo.permissions.all()), [permissao])

    def test_resolve_cargo_por_id_nome_ou_vazio(self):
        cargo = Cargo.objects.create(name="Operacional")
        resolve = usuarios_views._resolve_cargo_api_value
        self.assertEqual(resolve(str(cargo.pk)), "Operacional")
        self.assertEqual(resolve("Operacional"), "Operacional")
        self.assertEqual(resolve("Desconhecido"), "Desconhecido")
        self.assertEqual(resolve(""), "")
        self.assertIsNone(resolve(None))

    def test_sync_cargo_vazio_limpa_grupos_do_auth_user(self):
        auth_user = get_user_model().objects.create_user(username="u")
        auth_user.groups.add(Group.objects.create(name="Antigo"))
        usuario = Usuario(nome="U", email="u@example.com", cargo="")
        self.assertIsNone(usuarios_views._sync_auth_user_cargo(usuario, auth_user))
        self.assertEqual(auth_user.groups.count(), 0)

    def test_sync_cargo_legado_normaliza_nome_no_usuario(self):
        auth_user = get_user_model().objects.create_user(username="v")
        usuario = Usuario.objects.create(nome="V", email="v@example.com", cargo="advogado")
        cargo = usuarios_views._sync_auth_user_cargo(usuario, auth_user)
        self.assertEqual(cargo.name, "Advogado")
        usuario.refresh_from_db()
        self.assertEqual(usuario.cargo, "Advogado")

    def test_get_or_sync_auth_user_cria_e_atualiza(self):
        usuario = Usuario.objects.create(nome="Ana", email="ana@example.com", cargo="Advogado")
        criado = usuarios_views._get_or_sync_auth_user(usuario)
        self.assertEqual((criado.username, criado.first_name), ("ana@example.com", "Ana"))
        self.assertFalse(criado.has_usable_password())

        usuario.nome = "Ana Maria"
        usuario.email = "ana.maria@example.com"
        atualizado = usuarios_views._get_or_sync_auth_user(
            usuario, previous_email="ana@example.com"
        )
        self.assertEqual(atualizado.pk, criado.pk)
        self.assertEqual(atualizado.username, "ana.maria@example.com")
        self.assertEqual(atualizado.first_name, "Ana Maria")
