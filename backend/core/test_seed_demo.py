from io import StringIO

from django.contrib.sessions.backends.db import SessionStore
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from financeiro.models import Lancamento
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo
from prospeccao.models import Prospect


class SeedDemoTests(TestCase):
    @override_settings(DEBUG=False)
    def test_recusa_rodar_fora_do_debug(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo", stdout=StringIO())
        self.assertFalse(Cliente.objects.exists())

    @override_settings(DEBUG=True)
    def test_cria_dados_ficticios_e_sessao_de_desenvolvimento(self):
        out = StringIO()
        call_command("seed_demo", stdout=out)

        self.assertEqual(Cliente.objects.count(), 8)
        self.assertEqual(Processo.objects.count(), 10)
        self.assertEqual(Prazo.objects.count(), 12)
        self.assertEqual(Evento.objects.count(), 8)
        self.assertEqual(Peticao.objects.count(), 6)
        self.assertEqual(Lancamento.objects.count(), 15)
        self.assertEqual(Prospect.objects.count(), 5)

        # Sempre ha um compromisso futuro hoje/amanha para o painel nao nascer vazio.
        self.assertTrue(
            Evento.objects.filter(
                titulo="Audiência de conciliação", data_inicio__gt=timezone.now()
            ).exists()
        )

        session_key = out.getvalue().split("sessionid = ")[1].strip()
        sessao = SessionStore(session_key=session_key)
        self.assertEqual(sessao["usuario_nome"], "Helena Duarte")

    @override_settings(DEBUG=True)
    def test_recusa_banco_que_ja_tem_dados(self):
        call_command("seed_demo", stdout=StringIO())
        with self.assertRaises(CommandError):
            call_command("seed_demo", stdout=StringIO())
        self.assertEqual(Cliente.objects.count(), 8)
