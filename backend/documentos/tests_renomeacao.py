from datetime import timedelta
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from clientes.models import Cliente
from documentos import renomeacao, tasks
from documentos.models import RenomeacaoPastaPendente
from integrations.google.exceptions import GoogleApiError, GoogleAuthorizationRequired
from integrations.models import GoogleAccount
from processos.models import Processo
from usuarios.models import Usuario

CLIENTE = RenomeacaoPastaPendente.TIPO_CLIENTE
PROCESSO = RenomeacaoPastaPendente.TIPO_PROCESSO


class EsperaTests(SimpleTestCase):
    def test_backoff_cresce_e_tem_teto(self):
        minutos = [renomeacao.espera_para(n) // timedelta(minutes=1) for n in range(0, 8)]
        self.assertEqual(minutos, [1, 5, 10, 20, 40, 80, 120, 120])


class RenomeacaoTestBase(TestCase):
    def setUp(self):
        self.editor = Usuario.objects.create(
            nome="Editor", email="editor@example.com", cargo="Advogado"
        )
        self.cliente = Cliente.objects.create(
            nome="Cliente Novo",
            email="c@example.com",
            telefone="11999999999",
            cpf="12345678901",
            tipo_cliente="esporadico",
        )
        self.processo = Processo.objects.create(
            numero_processo="0001",
            cliente=self.cliente,
            descricao="",
            vara="1a",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.editor,
        )

    def _conectar(self, usuario, sub):
        conta = GoogleAccount.objects.create(
            usuario=usuario, google_user_id=sub, email=usuario.email
        )
        conta.store_tokens(access_token="a", refresh_token="r")
        conta.save()
        return conta

    def _pendencia(self, tipo=CLIENTE, objeto=None, usuario="editor", **extra):
        objeto = objeto or (self.cliente if tipo == CLIENTE else self.processo)
        return RenomeacaoPastaPendente.objects.create(
            tipo=tipo,
            objeto_id=objeto.pk,
            usuario=self.editor if usuario == "editor" else usuario,
            **extra,
        )

    def _envelhecer(self, pendencia, minutos):
        RenomeacaoPastaPendente.objects.filter(pk=pendencia.pk).update(
            atualizado_em=timezone.now() - timedelta(minutes=minutos)
        )
        pendencia.refresh_from_db()


class RegistrarTests(RenomeacaoTestBase):
    def test_cria_uma_unica_pendencia_por_objeto_e_zera_tentativas(self):
        primeira = renomeacao.registrar(CLIENTE, self.cliente.pk, self.editor)
        RenomeacaoPastaPendente.objects.filter(pk=primeira.pk).update(
            tentativas=5, ultimo_erro="x"
        )
        outro = Usuario.objects.create(nome="O", email="o@example.com", cargo="Advogado")
        segunda = renomeacao.registrar(CLIENTE, self.cliente.pk, outro)

        self.assertEqual(primeira.pk, segunda.pk)
        self.assertEqual(RenomeacaoPastaPendente.objects.count(), 1)
        segunda.refresh_from_db()
        self.assertEqual((segunda.tentativas, segunda.ultimo_erro), (0, ""))
        self.assertEqual(segunda.usuario_id, outro.pk)

    def test_clientes_e_processos_com_o_mesmo_id_nao_colidem(self):
        renomeacao.registrar(CLIENTE, 1, None)
        renomeacao.registrar(PROCESSO, 1, None)
        self.assertEqual(RenomeacaoPastaPendente.objects.count(), 2)

    @patch("documentos.tasks.aplicar_renomeacao.delay")
    def test_enfileira_so_depois_do_commit(self, delay):
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            pendencia = renomeacao.registrar(CLIENTE, self.cliente.pk, self.editor)
        delay.assert_not_called()
        for callback in callbacks:
            callback()
        delay.assert_called_once_with(pendencia.pk)

    @patch("documentos.tasks.aplicar_renomeacao.delay", side_effect=ConnectionError("x"))
    def test_broker_fora_nao_perde_a_pendencia(self, _delay):
        with self.assertLogs("core.utils", level="ERROR"):
            with self.captureOnCommitCallbacks(execute=True):
                renomeacao.registrar(CLIENTE, self.cliente.pk, self.editor)
        self.assertEqual(RenomeacaoPastaPendente.objects.count(), 1)

    def test_usuario_ausente_vira_nulo(self):
        pendencia = renomeacao.registrar(CLIENTE, self.cliente.pk, None)
        self.assertIsNone(pendencia.usuario_id)


class AplicarTests(RenomeacaoTestBase):
    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_cliente_usa_o_nome_atual_e_remove_a_pendencia(self, renomear):
        pendencia = self._pendencia()
        self.assertTrue(renomeacao.aplicar(pendencia))
        renomear.assert_called_once_with(self.editor, self.cliente, "Cliente Novo")
        self.assertFalse(RenomeacaoPastaPendente.objects.exists())

    @patch("documentos.renomeacao.services.renomear_pasta_processo")
    def test_processo_sempre_aplica_o_nome_calculado(self, renomear):
        pendencia = self._pendencia(PROCESSO)
        self.assertTrue(renomeacao.aplicar(pendencia))
        renomear.assert_called_once_with(self.editor, self.processo, "")
        self.assertFalse(RenomeacaoPastaPendente.objects.exists())

    def test_entidade_apagada_descarta_a_pendencia(self):
        pendencia = self._pendencia()
        self.cliente.delete()
        self.assertTrue(renomeacao.aplicar(pendencia))
        self.assertFalse(RenomeacaoPastaPendente.objects.exists())

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_editor_sem_conta_cai_para_outra_conta_conectada(self, renomear):
        outro = Usuario.objects.create(nome="O", email="o@example.com", cargo="Advogado")
        self._conectar(outro, "sub-outro")
        renomear.side_effect = [GoogleAuthorizationRequired("sem conta"), None]
        pendencia = self._pendencia()

        self.assertTrue(renomeacao.aplicar(pendencia))
        self.assertEqual([c.args[0] for c in renomear.call_args_list], [self.editor, outro])
        self.assertFalse(RenomeacaoPastaPendente.objects.exists())

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_sem_nenhuma_conta_conectada_mantem_e_conta_tentativa(self, renomear):
        renomear.side_effect = GoogleAuthorizationRequired("sem conta")
        pendencia = self._pendencia()

        self.assertFalse(renomeacao.aplicar(pendencia))
        pendencia.refresh_from_db()
        self.assertEqual(pendencia.tentativas, 1)
        self.assertIn("sem conta", pendencia.ultimo_erro)

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_pendencia_sem_editor_usa_conta_conectada(self, renomear):
        self._conectar(self.editor, "sub-editor")
        pendencia = self._pendencia(usuario=None)
        self.assertTrue(renomeacao.aplicar(pendencia))
        self.assertEqual(renomear.call_args.args[0], self.editor)

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_erro_da_api_nao_tenta_outras_contas_e_registra_o_erro(self, renomear):
        outro = Usuario.objects.create(nome="O", email="o@example.com", cargo="Advogado")
        self._conectar(outro, "sub-outro")
        renomear.side_effect = GoogleApiError("drive instavel")
        pendencia = self._pendencia()

        self.assertFalse(renomeacao.aplicar(pendencia))
        self.assertEqual(renomear.call_count, 1)
        pendencia.refresh_from_db()
        self.assertEqual((pendencia.tentativas, pendencia.ultimo_erro), (1, "drive instavel"))

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_desiste_com_log_de_erro_na_ultima_tentativa(self, renomear):
        renomear.side_effect = GoogleApiError("fora")
        pendencia = self._pendencia(tentativas=renomeacao.MAX_TENTATIVAS - 1)
        with self.assertLogs("documentos.renomeacao", level="ERROR"):
            self.assertFalse(renomeacao.aplicar(pendencia))
        pendencia.refresh_from_db()
        self.assertEqual(pendencia.tentativas, renomeacao.MAX_TENTATIVAS)

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_edicao_durante_a_aplicacao_nao_perde_a_nova_intencao(self, renomear):
        pendencia = self._pendencia()

        def reeditar(*_args):
            renomeacao.registrar(CLIENTE, self.cliente.pk, self.editor)

        renomear.side_effect = reeditar
        self.assertTrue(renomeacao.aplicar(pendencia))
        # the row was refreshed by the concurrent edit, so it must survive
        self.assertEqual(RenomeacaoPastaPendente.objects.count(), 1)


class VencidasEDrenoTests(RenomeacaoTestBase):
    def test_respeita_o_backoff_e_o_limite_de_tentativas(self):
        recente = self._pendencia(PROCESSO)  # tentativas=0, acabou de ser criada
        pronta = self._pendencia(CLIENTE)
        self._envelhecer(pronta, 2)
        esperando = RenomeacaoPastaPendente.objects.create(
            tipo=CLIENTE, objeto_id=9001, tentativas=2
        )
        self._envelhecer(esperando, 5)  # precisa de 10 min
        esgotada = RenomeacaoPastaPendente.objects.create(
            tipo=CLIENTE, objeto_id=9002, tentativas=renomeacao.MAX_TENTATIVAS
        )
        self._envelhecer(esgotada, 24 * 60)
        pronta_depois = RenomeacaoPastaPendente.objects.create(
            tipo=CLIENTE, objeto_id=9003, tentativas=2
        )
        self._envelhecer(pronta_depois, 11)

        ids = set(renomeacao.vencidas().values_list("pk", flat=True))
        self.assertEqual(ids, {pronta.pk, pronta_depois.pk})
        self.assertNotIn(recente.pk, ids)

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_drenar_aplica_so_as_vencidas_e_resume(self, renomear):
        pronta = self._pendencia(CLIENTE)
        self._envelhecer(pronta, 2)
        self._pendencia(PROCESSO)  # recente: fica para depois
        resumo = tasks.drenar_renomeacoes()
        self.assertEqual(resumo, {"concluidas": 1, "falhas": 0})
        self.assertEqual(RenomeacaoPastaPendente.objects.count(), 1)

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_drenar_conta_falhas(self, renomear):
        renomear.side_effect = GoogleApiError("x")
        pronta = self._pendencia(CLIENTE)
        self._envelhecer(pronta, 2)
        self.assertEqual(tasks.drenar_renomeacoes(), {"concluidas": 0, "falhas": 1})

    @patch("documentos.renomeacao.LOTE_MAXIMO", 2)
    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_drenar_respeita_o_tamanho_do_lote(self, renomear):
        for i in range(5):
            pendencia = RenomeacaoPastaPendente.objects.create(
                tipo=CLIENTE, objeto_id=8000 + i
            )
            self._envelhecer(pendencia, 2)
        # entities do not exist -> each is settled (discarded) without calling Drive
        resumo = tasks.drenar_renomeacoes()
        self.assertEqual(resumo["concluidas"], 2)
        self.assertEqual(RenomeacaoPastaPendente.objects.count(), 3)

    def test_aplicar_renomeacao_ignora_pendencia_inexistente(self):
        self.assertIsNone(tasks.aplicar_renomeacao(999999))

    @patch("documentos.renomeacao.services.renomear_pasta_cliente")
    def test_aplicar_renomeacao_executa_a_pendencia(self, renomear):
        pendencia = self._pendencia()
        tasks.aplicar_renomeacao(pendencia.pk)
        renomear.assert_called_once()
        self.assertFalse(RenomeacaoPastaPendente.objects.exists())
