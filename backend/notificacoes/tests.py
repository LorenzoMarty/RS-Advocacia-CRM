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
