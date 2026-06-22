from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from processos.models import Processo
from usuarios.models import Usuario

from .models import Notificacao
from .tasks import checar_lembretes


def _usuario(nome="User A", email="a@test.com"):
    u, _ = Usuario.objects.get_or_create(email=email, defaults={"nome": nome, "cargo": "advogado"})
    return u


def _cliente():
    c, _ = Cliente.objects.get_or_create(
        nome="Cliente Teste",
        defaults={"tipo": "pessoa_fisica", "cpf_cnpj": "000.000.000-00"},
    )
    return c


def _processo(cliente):
    p, _ = Processo.objects.get_or_create(
        numero_processo="0001",
        defaults={"cliente": cliente, "tipo": "civel", "status": "ativo", "descricao": ""},
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
        from django.contrib.sessions.backends.db import SessionStore
        session = SessionStore()
        session["usuario_id"] = self.usuario.pk
        session.save()
        self.client.cookies["sessionid"] = session.session_key

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
