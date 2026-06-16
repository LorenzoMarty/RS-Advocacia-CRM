import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from auditoria.models import RegistroAuditoria
from auditoria.services import calcular_diff
from clientes.models import Cliente
from prazos.models import Prazo
from processos.models import Processo
from usuarios.models import Usuario


class AuditoriaServicesTests(TestCase):
    def test_calcular_diff_ignora_campos_volateis(self):
        antes = {"status": "Ativo", "atualizado_em": "1", "id": "5"}
        depois = {"status": "Encerrado", "atualizado_em": "2", "id": "5"}

        diff = calcular_diff(antes, depois)

        self.assertEqual(diff, {"status": {"de": "Ativo", "para": "Encerrado"}})


class _AuditoriaBaseTestCase(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada",
            email="advogada@example.com",
            cargo="Administrador",
        )
        self.auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email,
            email=self.usuario.email,
        )
        self.client.force_login(self.auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session["usuario_nome"] = self.usuario.nome
        session.save()
        self.cliente = Cliente.objects.create(
            nome="Cliente",
            email="cliente@example.com",
            telefone="11999999999",
            cpf="123.456.789-00",
            tipo_cliente="esporadico",
        )
        self.processo = Processo.objects.create(
            numero_processo="0001234-56.2026.8.26.0001",
            cliente=self.cliente,
            descricao="Processo",
            vara="1a Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario.nome,
        )


class AuditoriaRegistroTests(_AuditoriaBaseTestCase):
    def test_editar_processo_registra_diff_e_autor(self):
        response = self.client.patch(
            reverse("editar_processo", args=[self.processo.pk]),
            data=json.dumps(
                {
                    "numero_processo": self.processo.numero_processo,
                    "cliente": self.cliente.pk,
                    "descricao": "Processo",
                    "vara": "1a Vara",
                    "area_juridica": "Civel",
                    "status": "Encerrado",
                    "advogado_responsavel": self.usuario.nome,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        registro = RegistroAuditoria.objects.get(
            entidade_tipo=RegistroAuditoria.ENTIDADE_PROCESSO,
            acao=RegistroAuditoria.ACAO_ATUALIZADO,
        )
        self.assertEqual(registro.entidade_id, str(self.processo.pk))
        self.assertEqual(registro.autor_nome, self.usuario.nome)
        self.assertIn("status", registro.alteracoes)
        self.assertEqual(registro.alteracoes["status"]["para"], "Encerrado")

    def test_excluir_prazo_registra(self):
        prazo = Prazo.objects.create(
            titulo="Contestacao",
            descricao="",
            data_limite="2026-06-23",
            processo=self.processo,
            responsavel=self.usuario.nome,
            status="Pendente",
        )

        response = self.client.delete(reverse("excluir_prazo", args=[prazo.pk]))

        self.assertEqual(response.status_code, 200, response.json())
        registro = RegistroAuditoria.objects.get(
            entidade_tipo=RegistroAuditoria.ENTIDADE_PRAZO,
            acao=RegistroAuditoria.ACAO_EXCLUIDO,
        )
        self.assertEqual(registro.entidade_rotulo, "Contestacao")


class AuditoriaListagemTests(_AuditoriaBaseTestCase):
    def test_listar_admin_retorna_registros(self):
        RegistroAuditoria.objects.create(
            acao=RegistroAuditoria.ACAO_CRIADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_PROCESSO,
            entidade_id="1",
            entidade_rotulo="X",
            resumo="Processo 'X' criado",
        )

        response = self.client.get(reverse("listar_auditoria"))

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(len(response.json()["dados"]["registros"]), 1)

    def test_listar_filtra_por_entidade(self):
        RegistroAuditoria.objects.create(
            acao=RegistroAuditoria.ACAO_CRIADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_PROCESSO,
            entidade_id="1",
            resumo="a",
        )
        RegistroAuditoria.objects.create(
            acao=RegistroAuditoria.ACAO_CRIADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_PRAZO,
            entidade_id="2",
            resumo="b",
        )

        response = self.client.get(
            reverse("listar_auditoria"), {"entidade_tipo": "prazo"}
        )

        registros = response.json()["dados"]["registros"]
        self.assertEqual(len(registros), 1)
        self.assertEqual(registros[0]["entidade_tipo"], "prazo")

    def test_listar_nao_admin_recebe_403(self):
        usuario_comum = Usuario.objects.create(
            nome="Estagiario",
            email="estagiario@example.com",
            cargo="Estagiario",
        )
        auth_user = get_user_model().objects.create_user(
            username=usuario_comum.email,
            email=usuario_comum.email,
            password="x",
        )
        # Concede as permissões de view exigidas pelo decorator, mas não é admin.
        from django.contrib.auth.models import Permission

        auth_user.user_permissions.add(
            Permission.objects.get(codename="view_processo"),
            Permission.objects.get(codename="view_prazo"),
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = usuario_comum.pk
        session.save()

        response = self.client.get(reverse("listar_auditoria"))

        self.assertEqual(response.status_code, 403, response.json())
