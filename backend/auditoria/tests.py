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


# ---------------------------------------------------------------------------
# Agenda CRUD audit instrumentation
# ---------------------------------------------------------------------------

@override_settings(SECURE_SSL_REDIRECT=False)
class AuditoriaEventoTests(_AuditoriaBaseTestCase):
    """Garante que criar/editar/excluir evento cria RegistroAuditoria."""

    def _payload_evento(self, titulo="Audiência", **kwargs):
        from django.utils import timezone

        now = timezone.now()
        base = {
            "titulo": titulo,
            "tipo_evento": "Audiência",
            "prioridade": "Alta",
            "descricao": "",
            "data_inicio": (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M"),
            "data_fim": (now + timedelta(days=1, hours=2)).strftime("%Y-%m-%dT%H:%M"),
            "cliente": self.cliente.pk,
            "processo": self.processo.pk,
            "responsavel": self.usuario.pk,
            "status": "Agendado",
            "local": "Fórum",
            "observacoes": "",
            "concluido": False,
        }
        base.update(kwargs)
        return base

    def test_criar_evento_registra(self):
        response = self.client.post(
            reverse("criar_evento"),
            data=json.dumps(self._payload_evento()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        registro = RegistroAuditoria.objects.get(
            entidade_tipo=RegistroAuditoria.ENTIDADE_EVENTO,
            acao=RegistroAuditoria.ACAO_CRIADO,
        )
        self.assertEqual(registro.entidade_rotulo, "Audiência")
        self.assertEqual(registro.autor_nome, self.usuario.nome)
        self.assertEqual(registro.processo_id, str(self.processo.pk))
        self.assertEqual(registro.processo_rotulo, self.processo.numero_processo)

    def test_editar_evento_registra_diff(self):
        from agenda.models import Evento
        from django.utils import timezone

        now = timezone.now()
        evento = Evento.objects.create(
            titulo="Reunião",
            tipo_evento="Reunião",
            prioridade="Normal",
            descricao="",
            data_inicio=now + timedelta(days=1),
            data_fim=now + timedelta(days=1, hours=1),
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            status="Agendado",
            local="Escritório",
            criado_por=self.usuario.nome,
        )

        payload = self._payload_evento(titulo="Reunião")
        payload["local"] = "Tribunal"  # muda o local
        payload["status"] = "Agendado"

        response = self.client.put(
            reverse("editar_evento", args=[evento.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        registro = RegistroAuditoria.objects.get(
            entidade_tipo=RegistroAuditoria.ENTIDADE_EVENTO,
            acao=RegistroAuditoria.ACAO_ATUALIZADO,
        )
        self.assertIn("local", registro.alteracoes)
        self.assertEqual(registro.alteracoes["local"]["para"], "Tribunal")

    def test_excluir_evento_registra(self):
        from agenda.models import Evento
        from django.utils import timezone

        # Mocking Google Calendar delete — override with a no-op
        import unittest.mock as mock

        now = timezone.now()
        evento = Evento.objects.create(
            titulo="Excluir",
            tipo_evento="Audiência",
            prioridade="Alta",
            descricao="",
            data_inicio=now + timedelta(days=1),
            data_fim=now + timedelta(days=1, hours=2),
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            status="Agendado",
            local="Fórum",
            criado_por=self.usuario.nome,
        )

        with mock.patch(
            "agenda.views.delete_remote_event", return_value=None
        ):
            response = self.client.delete(
                reverse("excluir_evento", args=[evento.pk])
            )

        self.assertEqual(response.status_code, 200, response.json())
        registro = RegistroAuditoria.objects.get(
            entidade_tipo=RegistroAuditoria.ENTIDADE_EVENTO,
            acao=RegistroAuditoria.ACAO_EXCLUIDO,
        )
        self.assertEqual(registro.entidade_rotulo, "Excluir")
        self.assertEqual(registro.processo_id, str(self.processo.pk))


# ---------------------------------------------------------------------------
# listar_auditoria — novos filtros e paginação
# ---------------------------------------------------------------------------

@override_settings(SECURE_SSL_REDIRECT=False)
class AuditoriaListagemFiltrosTests(_AuditoriaBaseTestCase):
    def _criar_registro(self, **kwargs):
        defaults = dict(
            acao=RegistroAuditoria.ACAO_CRIADO,
            entidade_tipo=RegistroAuditoria.ENTIDADE_PROCESSO,
            entidade_id="1",
            entidade_rotulo="X",
            autor_nome="Advogada",
            processo_rotulo="Proc 001",
            resumo="Processo 'X' criado",
        )
        defaults.update(kwargs)
        return RegistroAuditoria.objects.create(**defaults)

    def test_paginacao_retorna_paginacao_no_payload(self):
        for i in range(5):
            self._criar_registro(entidade_id=str(i), resumo=f"Registro {i}")

        response = self.client.get(
            reverse("listar_auditoria"), {"limit": 3, "offset": 0}
        )
        dados = response.json()["dados"]
        self.assertEqual(len(dados["registros"]), 3)
        pag = dados["paginacao"]
        self.assertEqual(pag["total"], 5)
        self.assertEqual(pag["limit"], 3)
        self.assertEqual(pag["tem_mais"], True)

    def test_paginacao_segunda_pagina(self):
        for i in range(5):
            self._criar_registro(entidade_id=str(i), resumo=f"Registro {i}")

        response = self.client.get(
            reverse("listar_auditoria"), {"limit": 3, "offset": 3}
        )
        dados = response.json()["dados"]
        self.assertEqual(len(dados["registros"]), 2)
        self.assertFalse(dados["paginacao"]["tem_mais"])

    def test_filtro_autor_nome(self):
        self._criar_registro(autor_nome="Maria")
        self._criar_registro(autor_nome="João", entidade_id="2")

        response = self.client.get(
            reverse("listar_auditoria"), {"autor_nome": "Maria"}
        )
        registros = response.json()["dados"]["registros"]
        self.assertEqual(len(registros), 1)
        self.assertEqual(registros[0]["autor_nome"], "Maria")

    def test_filtro_acao(self):
        self._criar_registro(acao=RegistroAuditoria.ACAO_CRIADO)
        self._criar_registro(
            acao=RegistroAuditoria.ACAO_EXCLUIDO, entidade_id="2", resumo="excluido"
        )

        response = self.client.get(
            reverse("listar_auditoria"), {"acao": "excluido"}
        )
        registros = response.json()["dados"]["registros"]
        self.assertEqual(len(registros), 1)
        self.assertEqual(registros[0]["acao"], "excluido")

    def test_filtro_q_busca_resumo(self):
        self._criar_registro(resumo="Processo teste criado")
        self._criar_registro(resumo="Prazo vencido", entidade_id="2")

        response = self.client.get(
            reverse("listar_auditoria"), {"q": "teste"}
        )
        registros = response.json()["dados"]["registros"]
        self.assertEqual(len(registros), 1)
        self.assertIn("teste", registros[0]["resumo"])

    def test_filtro_desde_ate(self):
        import datetime

        hoje = timezone.localdate()
        # Cria um registro antigo via update direto
        r = self._criar_registro(resumo="antigo")
        RegistroAuditoria.objects.filter(pk=r.pk).update(
            criado_em=timezone.now() - timedelta(days=10)
        )
        self._criar_registro(resumo="recente", entidade_id="99")

        response = self.client.get(
            reverse("listar_auditoria"),
            {
                "desde": hoje.isoformat(),
                "ate": hoje.isoformat(),
            },
        )
        registros = response.json()["dados"]["registros"]
        self.assertEqual(len(registros), 1)
        self.assertEqual(registros[0]["resumo"], "recente")


# ---------------------------------------------------------------------------
# visao_geral endpoint
# ---------------------------------------------------------------------------

@override_settings(SECURE_SSL_REDIRECT=False)
class VisaoGeralTests(_AuditoriaBaseTestCase):
    def _criar_prazo(self, dias, concluido=False):
        return Prazo.objects.create(
            titulo=f"Prazo {dias}d",
            data_limite=timezone.localdate() + timedelta(days=dias),
            processo=self.processo,
            responsavel=self.usuario.nome,
            status="Pendente",
            concluido=concluido,
        )

    def _criar_evento(self, delta_inicio_horas=2, delta_fim_horas=3, concluido=False):
        from agenda.models import Evento

        now = timezone.now()
        return Evento.objects.create(
            titulo="Audiência",
            tipo_evento="Audiência",
            prioridade="Alta",
            descricao="",
            data_inicio=now + timedelta(hours=delta_inicio_horas),
            data_fim=now + timedelta(hours=delta_fim_horas),
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            status="Agendado",
            local="Fórum",
            criado_por=self.usuario.nome,
            concluido=concluido,
        )

    def test_visao_geral_retorna_todas_secoes(self):
        self._criar_prazo(-1)  # overdue
        self._criar_prazo(3)   # due soon
        self._criar_prazo(0, concluido=True)  # done
        Peticao.objects.create(
            cliente=self.cliente,
            processo=self.processo,
            tipo=Peticao.TIPO_PETICAO,
            adverso="Empresa",
            responsavel_acao=self.usuario.nome,
            status=Peticao.STATUS_PENDENTE,
        )
        self._criar_evento()
        TimeEntry.objects.create(
            user=self.usuario,
            task_id="1",
            task_type=TimeEntry.TASK_PRAZO,
            started_at=timezone.now(),
            status=TimeEntry.STATUS_RUNNING,
        )

        response = self.client.get(reverse("visao_geral"))

        self.assertEqual(response.status_code, 200, response.json())
        dados = response.json()["dados"]

        # Risk panel keys (from build_panel)
        self.assertIn("risk", dados)
        self.assertIn("summary", dados)
        self.assertIn("priority_actions", dados)
        self.assertIn("status_distribution", dados)

        # Macro overview keys
        self.assertIn("processos_por_status", dados)
        self.assertIn("processos_parados", dados)
        self.assertIn("prazos", dados)
        self.assertIn("eventos", dados)
        self.assertIn("peticoes_por_status", dados)
        self.assertIn("produtividade", dados)

    def test_prazos_buckets(self):
        self._criar_prazo(-2)  # overdue
        self._criar_prazo(3)   # due soon
        self._criar_prazo(0, concluido=True)  # done
        self._criar_prazo(90)  # later

        dados = self.client.get(reverse("visao_geral")).json()["dados"]
        prazos = dados["prazos"]

        self.assertEqual(prazos["overdue"], 1)
        self.assertEqual(prazos["due_soon"], 1)
        self.assertEqual(prazos["done"], 1)

    def test_peticoes_funnel_ordem_workflow(self):
        for status in [
            Peticao.STATUS_PENDENTE,
            Peticao.STATUS_EM_ANDAMENTO,
            Peticao.STATUS_PROTOCOLAR,
            Peticao.STATUS_PROTOCOLADO,
        ]:
            Peticao.objects.create(
                cliente=self.cliente,
                tipo=Peticao.TIPO_PETICAO,
                adverso="A",
                responsavel_acao="X",
                status=status,
            )

        dados = self.client.get(reverse("visao_geral")).json()["dados"]
        funnel = dados["peticoes_por_status"]

        self.assertEqual(len(funnel), 4)
        statuses = [item["status"] for item in funnel]
        self.assertEqual(
            statuses,
            [
                Peticao.STATUS_PENDENTE,
                Peticao.STATUS_EM_ANDAMENTO,
                Peticao.STATUS_PROTOCOLAR,
                Peticao.STATUS_PROTOCOLADO,
            ],
        )
        for item in funnel:
            self.assertEqual(item["count"], 1)

    def test_eventos_proximos_e_atrasados(self):
        from agenda.models import Evento

        now = timezone.now()
        Evento.objects.create(
            titulo="Futuro",
            tipo_evento="Reunião",
            prioridade="Normal",
            data_inicio=now + timedelta(hours=2),
            data_fim=now + timedelta(hours=3),
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            status="Agendado",
            local="",
            criado_por="",
        )
        Evento.objects.create(
            titulo="Atrasado",
            tipo_evento="Reunião",
            prioridade="Normal",
            data_inicio=now - timedelta(hours=5),
            data_fim=now - timedelta(hours=4),
            cliente=self.cliente,
            processo=self.processo,
            responsavel=self.usuario,
            status="Agendado",
            local="",
            criado_por="",
        )

        dados = self.client.get(reverse("visao_geral")).json()["dados"]
        eventos = dados["eventos"]

        self.assertEqual(len(eventos["proximos"]), 1)
        self.assertEqual(eventos["proximos"][0]["titulo"], "Futuro")
        self.assertEqual(len(eventos["atrasados"]), 1)
        self.assertEqual(eventos["atrasados"][0]["titulo"], "Atrasado")

    def test_produtividade_por_usuario(self):
        from productivity.models import ProductivityGoal

        ProductivityGoal.objects.create(user=self.usuario, weekly_hours=30)
        TimeEntry.objects.create(
            user=self.usuario,
            task_id="1",
            task_type=TimeEntry.TASK_PRAZO,
            started_at=timezone.now() - timedelta(hours=2),
            ended_at=timezone.now() - timedelta(hours=1),
            total_seconds=3600,
            status=TimeEntry.STATUS_STOPPED,
        )

        dados = self.client.get(reverse("visao_geral")).json()["dados"]
        prod = dados["produtividade"]

        self.assertIn("por_usuario", prod)
        self.assertEqual(len(prod["por_usuario"]), 1)
        u = prod["por_usuario"][0]
        self.assertEqual(u["user_name"], self.usuario.nome)
        self.assertAlmostEqual(u["horas"], 1.0, places=1)
        self.assertEqual(u["meta_horas"], 30.0)

    def test_visao_geral_nao_admin_403(self):
        usuario_comum = Usuario.objects.create(
            nome="Estagiario",
            email="estagiario3@example.com",
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

        response = self.client.get(reverse("visao_geral"))
        self.assertEqual(response.status_code, 403)
