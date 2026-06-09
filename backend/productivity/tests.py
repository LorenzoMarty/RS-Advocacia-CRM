import json
from datetime import datetime

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from clientes.models import Cliente
from prazos.models import Prazo
from processos.models import Processo
from productivity.models import ProductivityGoal, TimeEntry
from usuarios.models import Usuario


def _aware(year, month, day, hour=10):
    return timezone.make_aware(
        datetime(year, month, day, hour, 0), timezone.get_current_timezone()
    )


class ResumoProdutividadeTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada",
            email="advogada@example.com",
            cargo="Administrador",
        )
        self.outro = Usuario.objects.create(
            nome="Estagiario",
            email="estagiario@example.com",
            cargo="Estagiario",
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email,
            email=self.usuario.email,
        )
        self.client.force_login(auth_user)
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
        self.prazo = Prazo.objects.create(
            titulo="Contestacao",
            descricao="Protocolar",
            data_limite="2026-06-23",
            processo=self.processo,
            responsavel=self.usuario.nome,
        )

    def _entry(
        self,
        user,
        total_seconds,
        ended,
        task_type=TimeEntry.TASK_PRAZO,
        task_id=None,
        status=TimeEntry.STATUS_STOPPED,
    ):
        return TimeEntry.objects.create(
            user=user,
            task_id=task_id if task_id is not None else str(self.prazo.pk),
            task_type=task_type,
            started_at=ended,
            ended_at=ended if status == TimeEntry.STATUS_STOPPED else None,
            total_seconds=total_seconds,
            status=status,
        )

    def _resumo(self, **params):
        params.setdefault("periodo", "custom")
        params.setdefault("inicio", "2026-06-01")
        params.setdefault("fim", "2026-06-07")
        response = self.client.get(reverse("resumo_produtividade"), data=params)
        self.assertEqual(response.status_code, 200, response.json())
        self.assertTrue(response.json()["sucesso"])
        return response.json()["dados"]

    def test_total_e_variacao_vs_periodo_anterior(self):
        # período atual (01-07/06): 3600 + 1800 = 5400
        self._entry(self.usuario, 3600, _aware(2026, 6, 3))
        self._entry(self.usuario, 1800, _aware(2026, 6, 5))
        # período anterior (25-31/05): 1200
        self._entry(self.usuario, 1200, _aware(2026, 5, 28))

        dados = self._resumo()

        self.assertEqual(dados["tempo_total_segundos"], 5400)
        self.assertEqual(dados["tempo_periodo_anterior_segundos"], 1200)
        self.assertEqual(dados["variacao_percentual"], 350.0)

    def test_filtro_periodo_exclui_fora_do_range(self):
        self._entry(self.usuario, 3600, _aware(2026, 6, 3))
        self._entry(self.usuario, 9999, _aware(2026, 7, 15))  # fora

        dados = self._resumo()

        self.assertEqual(dados["tempo_total_segundos"], 3600)

    def test_variacao_nula_sem_periodo_anterior(self):
        self._entry(self.usuario, 3600, _aware(2026, 6, 3))

        dados = self._resumo()

        self.assertEqual(dados["tempo_total_segundos"], 3600)
        self.assertIsNone(dados["variacao_percentual"])

    def test_agregacao_por_dia_e_processo(self):
        self._entry(self.usuario, 3600, _aware(2026, 6, 3))
        self._entry(self.usuario, 1800, _aware(2026, 6, 3))
        self._entry(self.usuario, 600, _aware(2026, 6, 5))

        dados = self._resumo()

        por_dia = {item["data"]: item["segundos"] for item in dados["por_dia"]}
        self.assertEqual(por_dia["2026-06-03"], 5400)
        self.assertEqual(por_dia["2026-06-05"], 600)

        # processo resolvido via Prazo -> número do processo
        self.assertEqual(len(dados["por_processo"]), 1)
        self.assertEqual(
            dados["por_processo"][0]["process_number"], self.processo.numero_processo
        )
        self.assertEqual(dados["por_processo"][0]["segundos"], 6000)

    def test_admin_filtra_por_user_id(self):
        self._entry(self.usuario, 3600, _aware(2026, 6, 3))
        self._entry(self.outro, 1200, _aware(2026, 6, 3))

        # sem filtro: soma de todos (admin vê tudo)
        dados = self._resumo()
        self.assertEqual(dados["tempo_total_segundos"], 4800)
        self.assertEqual(len(dados["por_usuario"]), 2)

        # com filtro por usuário
        dados_filtrado = self._resumo(user_id=str(self.outro.pk))
        self.assertEqual(dados_filtrado["tempo_total_segundos"], 1200)
        self.assertEqual(len(dados_filtrado["por_usuario"]), 1)

    def test_timers_ativos_listados(self):
        self._entry(self.usuario, 0, timezone.now(), status=TimeEntry.STATUS_RUNNING)
        self._entry(self.usuario, 120, timezone.now(), status=TimeEntry.STATUS_PAUSED)

        dados = self._resumo()

        self.assertEqual(len(dados["timers_ativos"]), 2)
        statuses = {t["status"] for t in dados["timers_ativos"]}
        self.assertEqual(statuses, {"running", "paused"})

    def test_periodo_week_padrao(self):
        response = self.client.get(
            reverse("resumo_produtividade"), data={"periodo": "week"}
        )
        self.assertEqual(response.status_code, 200, response.json())
        dados = response.json()["dados"]
        self.assertEqual(dados["periodo"], "week")
        self.assertIn("inicio", dados)
        self.assertIn("fim", dados)


WORKER_EMAIL = "worker@example.com"


class ProductivityTimerTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Trabalhador", email=WORKER_EMAIL, cargo="Advogado"
        )
        self.user = get_user_model().objects.create_user(
            username="worker", email=WORKER_EMAIL, password="secret123"
        )
        self._grant("add_timeentry", "change_timeentry", "view_timeentry")
        self.client.force_login(self.user)

    def _grant(self, *codenames):
        for codename in codenames:
            self.user.user_permissions.add(
                Permission.objects.get(
                    content_type__app_label="productivity", codename=codename
                )
            )

    def _iniciar(self):
        return self.client.post(
            reverse("iniciar_timer"),
            data=json.dumps({"task_id": "10", "task_type": TimeEntry.TASK_PRAZO}),
            content_type="application/json",
        )

    def test_iniciar_cria_timer_rodando(self):
        response = self._iniciar()
        self.assertEqual(response.status_code, 201, response.content)
        entry = TimeEntry.objects.get()
        self.assertEqual(entry.status, TimeEntry.STATUS_RUNNING)
        self.assertEqual(entry.user_id, self.usuario.pk)

    def test_fluxo_iniciar_pausar_retomar_encerrar(self):
        entry_id = self._iniciar().json()["dados"]["time_entry"]["id"]

        pausar = self.client.patch(reverse("pausar_timer", args=[entry_id]))
        self.assertEqual(pausar.status_code, 200, pausar.content)
        self.assertEqual(
            TimeEntry.objects.get(pk=entry_id).status, TimeEntry.STATUS_PAUSED
        )

        retomar = self.client.patch(
            reverse("retomar_timer", args=[entry_id]),
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(retomar.status_code, 200, retomar.content)
        self.assertEqual(
            TimeEntry.objects.get(pk=entry_id).status, TimeEntry.STATUS_RUNNING
        )

        encerrar = self.client.patch(reverse("encerrar_timer", args=[entry_id]))
        self.assertEqual(encerrar.status_code, 200, encerrar.content)
        entry = TimeEntry.objects.get(pk=entry_id)
        self.assertEqual(entry.status, TimeEntry.STATUS_STOPPED)
        self.assertIsNotNone(entry.ended_at)

    def test_iniciar_segundo_timer_sem_pausar_conflita(self):
        self._iniciar()
        response = self.client.post(
            reverse("iniciar_timer"),
            data=json.dumps({"task_id": "20", "task_type": TimeEntry.TASK_PETICAO}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409, response.content)

    def test_tipo_de_tarefa_invalido_400(self):
        response = self.client.post(
            reverse("iniciar_timer"),
            data=json.dumps({"task_id": "10", "task_type": "invalido"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)


class ProductivityAuthTests(TestCase):
    def test_produtividade_exige_autenticacao(self):
        self.assertEqual(self.client.get(reverse("produtividade")).status_code, 401)

    def test_produtividade_403_sem_permissao(self):
        user = get_user_model().objects.create_user(
            username="noperm", email="noperm@example.com", password="secret123"
        )
        self.client.force_login(user)
        self.assertEqual(self.client.get(reverse("produtividade")).status_code, 403)


class ProductivityGoalModelTests(TestCase):
    def test_defaults_de_meta(self):
        usuario = Usuario.objects.create(
            nome="Metas", email="metas@example.com", cargo="Advogado"
        )
        goal = ProductivityGoal.objects.create(user=usuario)
        self.assertEqual(int(goal.daily_hours), 6)
        self.assertEqual(int(goal.weekly_hours), 30)
