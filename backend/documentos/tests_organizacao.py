from unittest.mock import MagicMock, patch

from django.test import TestCase

from clientes.models import Cliente
from documentos import organizacao
from documentos.models import ClienteDrive, DocumentoCliente
from processos.models import Processo

CNJ_VALIDO = "1234567-79.2024.8.13.0001"


def _cliente(nome="João Silva"):
    return Cliente.objects.create(
        nome=nome,
        email="c@example.com",
        telefone="11999999999",
        cpf="",
        tipo_cliente="esporadico",
    )


ARVORE = {
    "id": "raiz",
    "nome": "Cliente",
    "arquivos": [
        {
            "id": "f1",
            "nome": "peticao.pdf",
            "mime_type": "application/pdf",
            "tamanho_bytes": 10,
            "link_visualizacao": "",
        }
    ],
    "subpastas": [
        {
            "id": "peticoes",
            "nome": "Petições",
            "arquivos": [],
            "subpastas": [
                {"id": "interna", "nome": "Interna", "arquivos": [], "subpastas": []}
            ],
        }
    ],
}


def _vincular_drive(cliente):
    return ClienteDrive.objects.create(
        cliente=cliente,
        pasta_cliente_id="raiz",
        pasta_peticoes_id="peticoes",
        pasta_documentos_id="",
        pasta_outros_id="",
    )


class SugerirOrganizacaoTests(TestCase):
    def setUp(self):
        self.cliente = _cliente()
        _vincular_drive(self.cliente)

    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.ai_drive.sugerir_organizacao")
    def test_valida_e_descarta_operacoes_invalidas(self, mock_ia, mock_scan):
        mock_ia.return_value = {
            "operacoes": [
                {"tipo": "move", "arquivo_id": "f1", "destino_id": "peticoes"},
                {"tipo": "move", "arquivo_id": "alucinado", "destino_id": "peticoes"},
                {"tipo": "delete", "arquivo_id": "f1"},
                {"tipo": "rename", "arquivo_id": "raiz", "novo_nome": "Outro"},
                {"tipo": "rename", "arquivo_id": "f1", "novo_nome": ""},
                {"tipo": "create_folder", "ref": "p1", "nome": "Nova", "pai_id": "fora"},
            ],
        }

        plano = organizacao.sugerir_organizacao("usuario", self.cliente)

        self.assertEqual(len(plano["operacoes"]), 1)
        self.assertEqual(plano["operacoes"][0]["tipo"], "move")
        self.assertEqual(plano["descartadas"], 5)

    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.ai_drive.sugerir_organizacao")
    def test_ia_indisponivel_vira_erro_dedicado(self, mock_ia, mock_scan):
        mock_ia.side_effect = RuntimeError("fora do ar")

        with self.assertRaises(organizacao.OrganizacaoIndisponivel):
            organizacao.sugerir_organizacao("usuario", self.cliente)

    def test_cliente_sem_pasta_drive(self):
        cliente = _cliente(nome="Sem Drive")

        with self.assertRaises(organizacao.OrganizacaoInvalida):
            organizacao.sugerir_organizacao("usuario", cliente)

    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.ai_drive.sugerir_organizacao")
    def test_move_de_pasta_para_dentro_de_si_e_rejeitado(self, mock_ia, mock_scan):
        mock_ia.return_value = {
            "operacoes": [
                {"tipo": "move", "arquivo_id": "peticoes", "destino_id": "interna"},
            ],
        }

        plano = organizacao.sugerir_organizacao("usuario", self.cliente)

        self.assertEqual(plano["operacoes"], [])
        self.assertEqual(plano["descartadas"], 1)

    @patch(
        "documentos.organizacao.escanear_arvore",
        return_value={
            "id": "raiz",
            "nome": "Cliente",
            "arquivos": [],
            "subpastas": [
                {
                    "id": f"pasta-{CNJ_VALIDO}",
                    "nome": CNJ_VALIDO,
                    "arquivos": [],
                    "subpastas": [],
                }
            ],
        },
    )
    @patch("documentos.organizacao.ai_drive.sugerir_organizacao", return_value={"operacoes": []})
    def test_identifica_processo_por_nome_de_pasta(self, mock_ia, mock_scan):
        plano = organizacao.sugerir_organizacao("usuario", self.cliente)

        self.assertEqual(len(plano["processos_sugeridos"]), 1)
        self.assertEqual(plano["processos_sugeridos"][0]["numero_processo"], CNJ_VALIDO)

    @patch(
        "documentos.organizacao.escanear_arvore",
        return_value={
            "id": "raiz",
            "nome": "Cliente",
            "arquivos": [],
            "subpastas": [
                {
                    "id": f"pasta-{CNJ_VALIDO}",
                    "nome": CNJ_VALIDO,
                    "arquivos": [],
                    "subpastas": [],
                }
            ],
        },
    )
    @patch("documentos.organizacao.ai_drive.sugerir_organizacao", return_value={"operacoes": []})
    def test_nao_sugere_processo_ja_cadastrado(self, mock_ia, mock_scan):
        Processo.objects.create(cliente=self.cliente, numero_processo=CNJ_VALIDO)

        plano = organizacao.sugerir_organizacao("usuario", self.cliente)

        self.assertEqual(plano["processos_sugeridos"], [])

    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.ai_drive.sugerir_organizacao")
    def test_aviso_de_processo_com_numero_incompleto(self, mock_ia, mock_scan):
        mock_ia.return_value = {
            "operacoes": [],
            "avisos_processos": [
                {
                    "pasta_id": "peticoes",
                    "titulo": "Ação trabalhista - fulano",
                    "numero_parcial": "0021396-54.2026",
                    "motivo": "número incompleto no nome da pasta",
                }
            ],
        }

        plano = organizacao.sugerir_organizacao("usuario", self.cliente)

        self.assertEqual(len(plano["avisos_processos"]), 1)
        self.assertEqual(plano["avisos_processos"][0]["titulo"], "Ação trabalhista - fulano")
        self.assertEqual(plano["avisos_processos"][0]["origem_pasta_nome"], "Petições")

    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.ai_drive.sugerir_organizacao")
    def test_aviso_com_pasta_alucinada_e_descartado(self, mock_ia, mock_scan):
        mock_ia.return_value = {
            "operacoes": [],
            "avisos_processos": [
                {"pasta_id": "nao-existe", "titulo": "Processo fantasma"},
                {"pasta_id": "peticoes", "titulo": ""},
            ],
        }

        plano = organizacao.sugerir_organizacao("usuario", self.cliente)

        self.assertEqual(plano["avisos_processos"], [])


class AplicarOrganizacaoTests(TestCase):
    def setUp(self):
        self.cliente = _cliente()
        _vincular_drive(self.cliente)

    @patch("documentos.organizacao.drive_service", return_value=MagicMock())
    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.drive")
    def test_aplica_na_ordem_e_resolve_refs(self, mock_drive, mock_scan, mock_service):
        mock_drive.create_folder.return_value = {"id": "nova-pasta"}
        operacoes = [
            {
                "tipo": "move",
                "arquivo_id": "f1",
                "destino_id": "",
                "destino_ref": "p1",
            },
            {"tipo": "create_folder", "ref": "p1", "nome": "Processo X", "pai_id": "raiz"},
            {"tipo": "rename", "arquivo_id": "f1", "novo_nome": "peticao inicial.pdf"},
        ]

        resultado = organizacao.aplicar_organizacao("usuario", self.cliente, operacoes)

        self.assertEqual(resultado["aplicadas"], 3)
        self.assertEqual(resultado["falhas"], [])
        self.assertEqual(resultado["pastas_criadas"], {"p1": "nova-pasta"})
        mock_drive.create_folder.assert_called_once()
        args = mock_drive.move_file.call_args.args
        self.assertEqual(args[1:], ("f1", "nova-pasta", "raiz"))
        mock_drive.rename_file.assert_called_once()

    @patch("documentos.organizacao.drive_service", return_value=MagicMock())
    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.drive")
    def test_atualiza_documento_cliente_ao_mover(
        self, mock_drive, mock_scan, mock_service
    ):
        DocumentoCliente.objects.create(
            cliente=self.cliente,
            drive_file_id="f1",
            categoria=DocumentoCliente.CATEGORIA_OUTRO,
            nome="peticao.pdf",
            drive_folder_id="raiz",
        )
        operacoes = [
            {"tipo": "move", "arquivo_id": "f1", "destino_id": "peticoes"},
        ]

        resultado = organizacao.aplicar_organizacao("usuario", self.cliente, operacoes)

        self.assertEqual(resultado["aplicadas"], 1)
        documento = DocumentoCliente.objects.get(drive_file_id="f1")
        self.assertEqual(documento.drive_folder_id, "peticoes")

    def test_rejeita_corpo_que_nao_e_lista(self):
        with self.assertRaises(organizacao.OrganizacaoInvalida):
            organizacao.aplicar_organizacao("usuario", self.cliente, None)

    def test_rejeita_lote_acima_do_limite(self):
        operacoes = [{"tipo": "rename"}] * 101

        with self.assertRaises(organizacao.OrganizacaoInvalida):
            organizacao.aplicar_organizacao("usuario", self.cliente, operacoes)

    @patch("documentos.organizacao.drive_service", return_value=MagicMock())
    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.drive")
    def test_operacao_invalida_e_rejeitada_sem_escrita(
        self, mock_drive, mock_scan, mock_service
    ):
        operacoes = [
            {"tipo": "move", "arquivo_id": "fora-da-arvore", "destino_id": "peticoes"},
        ]

        resultado = organizacao.aplicar_organizacao("usuario", self.cliente, operacoes)

        self.assertEqual(resultado["aplicadas"], 0)
        self.assertEqual(len(resultado["rejeitadas"]), 1)
        mock_drive.move_file.assert_not_called()

    @patch("documentos.organizacao.drive_service", return_value=MagicMock())
    @patch("documentos.organizacao.escanear_arvore", return_value=dict(ARVORE))
    @patch("documentos.organizacao.drive")
    def test_aplica_cria_processos_aprovados(self, mock_drive, mock_scan, mock_service):
        resultado = organizacao.aplicar_organizacao(
            "usuario",
            self.cliente,
            [],
            [{"numero_processo": CNJ_VALIDO, "origem_pasta_id": "raiz"}],
        )

        self.assertEqual(resultado["processos_criados"], 1)
        self.assertTrue(
            Processo.objects.filter(
                cliente=self.cliente, numero_processo=CNJ_VALIDO
            ).exists()
        )
