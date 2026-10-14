from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from processos.models import Processo
from usuarios.models import Usuario

from .models import Notificacao
from .tasks import checar_lembretes, checar_prazos


def _usuario(nome="User A", email="a@test.com"):
    u, _ = Usuario.objects.get_or_create(email=email, defaults={"nome": nome, "cargo": "advogado"})
    return u


def _cliente():
    c, _ = Cliente.objects.get_or_create(
        nome="Cliente Teste",
        defaults={
            "email": "cliente@test.com",
            "telefone": "11999999999",
            "tipo_cliente": "esporadico",
        },
    )
    return c


def _processo(cliente):
    p, _ = Processo.objects.get_or_create(
        numero_processo="0001",
        defaults={
            "cliente": cliente,
            "vara": "1ª Vara Cível",
            "area_juridica": "Cível",
            "status": "Ativo",
            "descricao": "",
        },
    )
    return p


def _evento(usuario, processo, cliente, lembrete_em=None, lembrete_enviado=False):
    agora = timezone.now()
    return Evento.objects.create(
        titulo="Audiência Teste",
        descricao="",
        data_inicio=agora + timedelta(hours=1),
        data_fim=agora + timedelta(hours=2),
        tipo_evento="audiencia",
        status="agendado",
        prioridade="normal",
        cliente=cliente,
        processo=processo,
        responsavel=usuario,
        criado_por=usuario.nome,
        local="",
        lembrete_em=lembrete_em or agora - timedelta(seconds=30),
        lembrete_enviado=lembrete_enviado,
    )


class NotificacaoModelTests(TestCase):
    def test_str(self):
        u = _usuario()
        n = Notificacao(usuario=u, tipo="evento", titulo="Test")
        self.assertIn("Test", str(n))

    def test_default_lida_false(self):
        u = _usuario()
        n = Notificacao.objects.create(usuario=u, tipo="sistema", titulo="Bem-vindo")
        self.assertFalse(n.lida)


class MarcarLidaViewTests(TestCase):
    def setUp(self):
        self.usuario = _usuario()

    def _login(self):
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email, email=self.usuario.email
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session["usuario_nome"] = self.usuario.nome
        session.save()

    def test_marcar_lida(self):
        self._login()
        n = Notificacao.objects.create(usuario=self.usuario, tipo="sistema", titulo="Teste")
        resp = self.client.post(f"/api/notificacoes/{n.pk}/ler/")
        self.assertEqual(resp.status_code, 200)
        n.refresh_from_db()
        self.assertTrue(n.lida)

    def test_marcar_todas_lidas(self):
        self._login()
        Notificacao.objects.create(usuario=self.usuario, tipo="sistema", titulo="A")
        Notificacao.objects.create(usuario=self.usuario, tipo="sistema", titulo="B")
        resp = self.client.post("/api/notificacoes/ler-todas/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Notificacao.objects.filter(usuario=self.usuario, lida=False).count(), 0)


class NotificacoesViewsTests(TestCase):
    def setUp(self):
        self.usuario = _usuario()
        self.outro = _usuario("User B", "b@test.com")

    def _login(self, usuario=None, com_sessao=True):
        usuario = usuario or self.usuario
        auth_user = get_user_model().objects.create_superuser(
            username=usuario.email, email=usuario.email
        )
        self.client.force_login(auth_user)
        if com_sessao:
            session = self.client.session
            session["usuario_id"] = usuario.pk
            session.save()

    def _notificar(self, usuario, titulo="N", lida=False):
        return Notificacao.objects.create(
            usuario=usuario, tipo="sistema", titulo=titulo, lida=lida
        )

    def test_exigem_autenticacao(self):
        n = self._notificar(self.usuario)
        for method, url in (
            ("get", "/api/notificacoes/"),
            ("post", f"/api/notificacoes/{n.pk}/ler/"),
            ("post", "/api/notificacoes/ler-todas/"),
        ):
            self.assertEqual(getattr(self.client, method)(url).status_code, 401, url)
        n.refresh_from_db()
        self.assertFalse(n.lida)

    def test_metodo_errado_retorna_405(self):
        self._login()
        n = self._notificar(self.usuario)
        self.assertEqual(self.client.post("/api/notificacoes/").status_code, 405)
        self.assertEqual(self.client.get(f"/api/notificacoes/{n.pk}/ler/").status_code, 405)
        self.assertEqual(self.client.get("/api/notificacoes/ler-todas/").status_code, 405)

    def test_listar_devolve_so_nao_lidas_do_proprio_usuario(self):
        self._login()
        visivel = self._notificar(self.usuario, "Visível")
        self._notificar(self.usuario, "Já lida", lida=True)
        self._notificar(self.outro, "De outro usuário")

        resp = self.client.get("/api/notificacoes/")

        self.assertEqual(resp.status_code, 200)
        dados = resp.json()["dados"]
        self.assertEqual([i["id"] for i in dados["itens"]], [visivel.pk])
        self.assertEqual(dados["total_nao_lidas"], 1)

    def test_listar_limita_a_50_itens_mas_conta_todas(self):
        self._login()
        Notificacao.objects.bulk_create(
            Notificacao(usuario=self.usuario, tipo="sistema", titulo=f"N{i}")
            for i in range(60)
        )

        dados = self.client.get("/api/notificacoes/").json()["dados"]

        self.assertEqual(len(dados["itens"]), 50)
        self.assertEqual(dados["total_nao_lidas"], 60)

    def test_usuario_da_sessao_inexistente_retorna_401(self):
        # Usuário Django autenticado sem Usuario de domínio correspondente.
        auth_user = get_user_model().objects.create_user(
            username="fantasma@test.com", email="fantasma@test.com"
        )
        self.client.force_login(auth_user)
        for method, url in (
            ("get", "/api/notificacoes/"),
            ("post", "/api/notificacoes/1/ler/"),
            ("post", "/api/notificacoes/ler-todas/"),
        ):
            self.assertEqual(getattr(self.client, method)(url).status_code, 401, url)

    def test_marcar_lida_de_notificacao_alheia_ou_inexistente_retorna_404(self):
        self._login()
        alheia = self._notificar(self.outro)

        self.assertEqual(self.client.post(f"/api/notificacoes/{alheia.pk}/ler/").status_code, 404)
        self.assertEqual(self.client.post("/api/notificacoes/999999/ler/").status_code, 404)
        alheia.refresh_from_db()
        self.assertFalse(alheia.lida)

    def test_marcar_todas_lidas_nao_toca_nas_de_outros_usuarios(self):
        self._login()
        propria = self._notificar(self.usuario)
        alheia = self._notificar(self.outro)

        resp = self.client.post("/api/notificacoes/ler-todas/")

        self.assertEqual(resp.status_code, 200)
        propria.refresh_from_db()
        alheia.refresh_from_db()
        self.assertTrue(propria.lida)
        self.assertFalse(alheia.lida)


class ChecarLembretesTaskTests(TestCase):
    def setUp(self):
        self.usuario = _usuario()
        self.cliente = _cliente()
        self.processo = _processo(self.cliente)

    def test_cria_notificacao_para_evento_com_lembrete_pendente(self):
        _evento(self.usuario, self.processo, self.cliente)
        criados = checar_lembretes()
        self.assertEqual(criados, 1)
        n = Notificacao.objects.get(usuario=self.usuario)
        self.assertEqual(n.tipo, "evento")
        self.assertIn("Audiência Teste", n.titulo)

    def test_nao_duplica_lembrete_ja_enviado(self):
        _evento(self.usuario, self.processo, self.cliente, lembrete_enviado=True)
        criados = checar_lembretes()
        self.assertEqual(criados, 0)
        self.assertEqual(Notificacao.objects.filter(usuario=self.usuario).count(), 0)

    def test_ignora_evento_sem_responsavel(self):
        agora = timezone.now()
        Evento.objects.create(
            titulo="Sem responsável",
            descricao="",
            data_inicio=agora + timedelta(hours=1),
            data_fim=agora + timedelta(hours=2),
            tipo_evento="audiencia",
            status="agendado",
            prioridade="normal",
            cliente=self.cliente,
            processo=self.processo,
            responsavel=None,
            criado_por="sistema",
            local="",
            lembrete_em=agora - timedelta(seconds=30),
            lembrete_enviado=False,
        )
        criados = checar_lembretes()
        self.assertEqual(criados, 0)


class ChecarPrazosTaskTests(TestCase):
    def setUp(self):
        self.usuario = _usuario()
        self.cliente = _cliente()
        self.processo = _processo(self.cliente)

    def _prazo(self, dias=2, concluido=False, notificacao_enviada=False, responsavel=True):
        from prazos.models import Prazo

        return Prazo.objects.create(
            titulo="Contestação",
            descricao="",
            data_limite=timezone.localdate() + timedelta(days=dias),
            processo=self.processo,
            responsavel=self.usuario if responsavel else None,
            status="a_fazer",
            concluido=concluido,
            notificacao_enviada=notificacao_enviada,
        )

    def test_cria_notificacao_para_prazo_proximo(self):
        self._prazo(dias=2)
        criados = checar_prazos()
        self.assertEqual(criados, 1)
        n = Notificacao.objects.get(usuario=self.usuario)
        self.assertEqual(n.tipo, "prazo")
        self.assertIn("Contestação", n.titulo)

    def test_ignora_prazo_fora_da_janela(self):
        self._prazo(dias=10)
        criados = checar_prazos()
        self.assertEqual(criados, 0)

    def test_nao_duplica_prazo_ja_notificado(self):
        self._prazo(dias=1, notificacao_enviada=True)
        criados = checar_prazos()
        self.assertEqual(criados, 0)

    def test_ignora_prazo_concluido(self):
        self._prazo(dias=1, concluido=True)
        criados = checar_prazos()
        self.assertEqual(criados, 0)

    def test_ignora_prazo_sem_responsavel(self):
        self._prazo(dias=1, responsavel=False)
        criados = checar_prazos()
        self.assertEqual(criados, 0)


class NotificarAtribuicaoTests(TestCase):
    def setUp(self):
        self.usuario = _usuario()
        self.cliente = _cliente()

    def test_notifica_ao_criar_processo_com_responsavel(self):
        Processo.objects.create(
            numero_processo="1111",
            cliente=self.cliente,
            vara="1ª Vara Cível",
            area_juridica="Cível",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )
        n = Notificacao.objects.get(usuario=self.usuario, tipo="atribuicao")
        self.assertIn("1111", n.titulo)

    def test_notifica_ao_trocar_responsavel_do_processo(self):
        outro = _usuario(nome="User B", email="b@test.com")
        processo = Processo.objects.create(
            numero_processo="2222",
            cliente=self.cliente,
            vara="1ª Vara Cível",
            area_juridica="Cível",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )
        Notificacao.objects.filter(usuario=self.usuario).delete()

        processo.advogado_responsavel = outro
        processo.save()

        self.assertTrue(
            Notificacao.objects.filter(usuario=outro, tipo="atribuicao").exists()
        )
        self.assertFalse(
            Notificacao.objects.filter(usuario=self.usuario, tipo="atribuicao").exists()
        )

    def test_nao_duplica_notificacao_em_update_sem_troca_de_responsavel(self):
        processo = Processo.objects.create(
            numero_processo="3333",
            cliente=self.cliente,
            vara="1ª Vara Cível",
            area_juridica="Cível",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )
        processo.descricao = "atualizado"
        processo.save()

        self.assertEqual(
            Notificacao.objects.filter(usuario=self.usuario, tipo="atribuicao").count(), 1
        )

    def test_notifica_ao_criar_prospect_com_responsavel(self):
        from prospeccao.models import Prospect

        Prospect.objects.create(
            nome="Lead Teste",
            status_prospeccao="Em contato",
            prioridade="Media",
            responsavel_interno=self.usuario,
        )
        n = Notificacao.objects.get(usuario=self.usuario, tipo="atribuicao")
        self.assertIn("Lead Teste", n.titulo)
