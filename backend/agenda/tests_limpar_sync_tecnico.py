from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from integrations.google.calendar import SYNC_CLIENT_NAME, SYNC_PROCESS_NUMBER
from peticoes.models import Peticao
from processos.models import Processo


class LimparEventoSyncTecnicoTests(TestCase):
    def setUp(self):
        self.cliente = Cliente.objects.create(
            nome=SYNC_CLIENT_NAME,
            email="sync@example.com",
            telefone="11999999999",
            tipo_cliente="esporadico",
        )
        self.processo = Processo.objects.create(
            numero_processo=SYNC_PROCESS_NUMBER,
            cliente=self.cliente,
            vara="-",
            area_juridica="-",
            status="Ativo",
            descricao="",
        )
        agora = timezone.now()
        self.evento = Evento.objects.create(
            titulo="Importado",
            data_inicio=agora,
            data_fim=agora,
            tipo_evento="Compromisso",
            status="Agendado",
            prioridade="Media",
            cliente=self.cliente,
            processo=self.processo,
            criado_por="google",
            local="",
        )

    def run_command(self, *args):
        out = StringIO()
        call_command("limpar_evento_sync_tecnico", *args, stdout=out)
        return out.getvalue()

    def test_sem_flag_so_relata_e_nao_grava(self):
        saida = self.run_command()

        self.assertIn("Modo relatorio", saida)
        self.assertTrue(Cliente.objects.filter(pk=self.cliente.pk).exists())
        self.assertTrue(Processo.objects.filter(pk=self.processo.pk).exists())

    def test_aplicar_solta_eventos_e_apaga_cliente_e_processo_sinteticos(self):
        self.run_command("--aplicar")

        self.evento.refresh_from_db()
        self.assertIsNone(self.evento.cliente_id)
        self.assertIsNone(self.evento.processo_id)
        self.assertFalse(Cliente.objects.filter(nome=SYNC_CLIENT_NAME).exists())
        self.assertFalse(Processo.objects.filter(numero_processo=SYNC_PROCESS_NUMBER).exists())

    def test_recusa_apagar_quando_ha_dado_real_preso_ao_cliente(self):
        Peticao.objects.create(cliente=self.cliente, adverso="Réu")

        saida = self.run_command("--aplicar")

        self.assertIn("peticoes do cliente sintetico: 1", saida)
        self.assertTrue(Cliente.objects.filter(pk=self.cliente.pk).exists())
        self.evento.refresh_from_db()
        self.assertEqual(self.evento.cliente_id, self.cliente.pk)

    def test_sem_cliente_sintetico_nao_faz_nada(self):
        self.run_command("--aplicar")

        saida = self.run_command("--aplicar")

        self.assertIn("Nada a fazer", saida)
