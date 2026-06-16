import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from auditoria.models import RegistroAuditoria
from auditoria.services import calcular_diff
from clientes.models import Cliente
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo
from productivity.models import TimeEntry
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


@override_settings(SECURE_SSL_REDIRECT=False)
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

    def test_criar_peticao_registra_com_processo(self):
        response = self.client.post(
            reverse("criar_peticao"),
            data=json.dumps(
                {
                    "cliente": self.cliente.pk,
                    "processo": self.processo.pk,
                    "tipo": Peticao.TIPO_PETICAO,
                    "adverso": "Empresa",
                    "responsavel_acao": self.usuario.nome,
                    "status": Peticao.STATUS_PENDENTE,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        registro = RegistroAuditoria.objects.get(
            entidade_tipo=RegistroAuditoria.ENTIDADE_PETICAO,
            acao=RegistroAuditoria.ACAO_CRIADO,
        )
        self.assertEqual(registro.processo_id, str(self.processo.pk))
        self.assertEqual(registro.processo_rotulo, self.processo.numero_processo)


@override_settings(SECURE_SSL_REDIRECT=False)
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
        registros = response.json()["dados"]["registros"]
        self.assertEqual(len(registros), 1)
        self.assertEqual(registros[0]["processo_id"], "1")
        self.assertEqual(registros[0]["processo_numero"], "X")

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


@override_settings(SECURE_SSL_REDIRECT=False)
class PainelAuditoriaTests(_AuditoriaBaseTestCase):
    def _criar_prazo(self, dias, responsavel="Adv", concluido=False):
        return Prazo.objects.create(
            titulo=f"Prazo {dias}",
            data_limite=timezone.localdate() + timedelta(days=dias),
            processo=self.processo,
            responsavel=responsavel,
            status="Pendente",
            concluido=concluido,
        )

    def _tornar_parado(self, processo):
        # data_ultima_movimentacao é auto_now; um UPDATE direto evita o bump.
        Processo.objects.filter(pk=processo.pk).update(
            data_ultima_movimentacao=timezone.now() - timedelta(days=40)
        )

    def test_painel_calcula_risco_kpis_e_prioridades(self):
        self._criar_prazo(-1)  # vencido
        self._criar_prazo(2)  # vence em 3 dias (dueSoon, dentro do horizonte 7)
        self._criar_prazo(20)  # later — fora do dueSoon e do horizonte
        self._criar_prazo(-1, concluido=True)  # concluído → ignorado

        parado = Processo.objects.create(
            numero_processo="0009999-00.2026.8.26.0001",
            cliente=self.cliente,
            descricao="",
            vara="2a Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel="",  # sem dono → severidade 50
        )
        self._tornar_parado(parado)

        TimeEntry.objects.create(
            user=self.usuario,
            task_id="1",
            task_type=TimeEntry.TASK_PRAZO,
            started_at=timezone.now(),
            status=TimeEntry.STATUS_RUNNING,
        )

        response = self.client.get(reverse("painel_auditoria"))
        self.assertEqual(response.status_code, 200, response.json())
        dados = response.json()["dados"]

        self.assertEqual(dados["periodo"], 7)
        self.assertEqual(
            dados["summary"],
            {
                "active_processes": 2,
                "overdue": 1,
                "due_soon": 1,
                "stale": 1,
                "clients_without_process": 0,
                "running_timers": 1,
            },
        )
        # raw = 1*12 + 1*4 + 1*5 = 21 → saudável
        self.assertEqual(dados["risk"]["score"], 21)
        self.assertEqual(dados["risk"]["level"], "healthy")
        self.assertEqual(
            [d["key"] for d in dados["risk"]["drivers"]],
            ["overdue", "stale", "dueSoon"],
        )

        acoes = dados["priority_actions"]
        # vencido(90) > dueSoon soon3(60) > processo parado sem dono(50); +20 excluído
        self.assertEqual([a["severity"] for a in acoes], [90, 60, 50])
        self.assertEqual(acoes[0]["tone"], "danger")
        self.assertEqual(acoes[0]["action"], "Resolver agora")
        self.assertEqual(acoes[2]["kind"], "process")

    def test_painel_horizonte_filtra_prioridades(self):
        self._criar_prazo(-1)  # vencido — sempre entra
        self._criar_prazo(5)  # vence em 5 dias (bucket soon7)

        em2 = self.client.get(reverse("painel_auditoria"), {"periodo": 2}).json()[
            "dados"
        ]
        em7 = self.client.get(reverse("painel_auditoria"), {"periodo": 7}).json()[
            "dados"
        ]

        self.assertEqual(len(em2["priority_actions"]), 1)  # só o vencido (5 > 2)
        self.assertEqual(len(em7["priority_actions"]), 2)  # vencido + 5 dias

    def test_painel_nao_admin_recebe_403(self):
        usuario_comum = Usuario.objects.create(
            nome="Estagiario",
            email="estagiario2@example.com",
            cargo="Estagiario",
        )
        from django.contrib.auth.models import Permission

        auth_user = get_user_model().objects.create_user(
            username=usuario_comum.email,
            email=usuario_comum.email,
            password="x",
        )
        auth_user.user_permissions.add(
            Permission.objects.get(codename="view_processo"),
            Permission.objects.get(codename="view_prazo"),
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = usuario_comum.pk
        session.save()

        response = self.client.get(reverse("painel_auditoria"))
        self.assertEqual(response.status_code, 403, response.json())
