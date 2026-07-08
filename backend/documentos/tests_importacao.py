from unittest.mock import patch

from django.test import TestCase

from clientes.models import Cliente
from documentos import importacao
from documentos.models import DocumentoCliente, ProcessoDrive
from processos.models import Processo

CNJ_VALIDO = "1234567-79.2024.8.13.0001"


def _cliente(nome="João Silva"):
    return Cliente.objects.create(
        nome=nome,
        email="c@example.com",
        telefone="11999999999",
        cpf="12345678901",
        tipo_cliente="esporadico",
    )


class EscanearArvoreTests(TestCase):
    @patch("documentos.importacao.drive_service")
    @patch("documentos.importacao.drive")
    def test_percorre_subpastas_recursivamente(self, mock_drive, mock_service):
        def list_folders(service, parent_id):
            if parent_id == "raiz":
                return [{"id": "sub", "name": "Processo 123"}]
            return []

        def list_files(service, parent_id):
            if parent_id == "raiz":
                return [{"id": "f1", "name": "rg.pdf", "mimeType": "application/pdf"}]
            if parent_id == "sub":
                return [
                    {"id": "f2", "name": "peticao.pdf", "mimeType": "application/pdf"}
                ]
            return []

        mock_drive.list_folders.side_effect = list_folders
        mock_drive.list_files.side_effect = list_files

        arvore = importacao.escanear_arvore("usuario", "raiz")

        self.assertEqual(len(arvore["arquivos"]), 1)
        self.assertEqual(arvore["arquivos"][0]["nome"], "rg.pdf")
        self.assertEqual(len(arvore["subpastas"]), 1)
        subpasta = arvore["subpastas"][0]
        self.assertEqual(subpasta["nome"], "Processo 123")
        self.assertEqual(subpasta["arquivos"][0]["nome"], "peticao.pdf")

    @patch("documentos.importacao.drive_service")
    @patch("documentos.importacao.drive")
    def test_respeita_limite_maximo_de_nos(self, mock_drive, mock_service):
        with patch.object(importacao, "MAX_NOS", 2):

            def list_folders(service, parent_id):
                return [{"id": f"sub-{parent_id}-{i}", "name": "x"} for i in range(5)]

            def list_files(service, parent_id):
                return []

            mock_drive.list_folders.side_effect = list_folders
            mock_drive.list_files.side_effect = list_files

            arvore = importacao.escanear_arvore("usuario", "raiz")

            total_pastas = 1  # raiz
            pilha = list(arvore["subpastas"])
            while pilha:
                no = pilha.pop()
                total_pastas += 1
                pilha.extend(no["subpastas"])
            self.assertLessEqual(total_pastas, 3)  # raiz + até MAX_NOS subpastas


class SugerirPlanoTests(TestCase):
    def setUp(self):
        self.cliente = _cliente()

    def test_sugere_processo_a_partir_do_nome_da_pasta(self):
        arvore = {
            "id": "raiz",
            "nome": "",
            "arquivos": [],
            "subpastas": [
                {
                    "id": "sub",
                    "nome": f"Processo {CNJ_VALIDO}",
                    "arquivos": [
                        {
                            "id": "f1",
                            "nome": "peticao inicial.pdf",
                            "mime_type": "application/pdf",
                            "tamanho_bytes": 10,
                            "link_visualizacao": "http://x",
                        }
                    ],
                    "subpastas": [],
                }
            ],
        }

        plano = importacao.sugerir_plano(arvore, self.cliente)

        self.assertEqual(len(plano["processos_sugeridos"]), 1)
        self.assertEqual(plano["processos_sugeridos"][0]["numero_processo"], CNJ_VALIDO)
        self.assertEqual(len(plano["documentos_sugeridos"]), 1)
        doc = plano["documentos_sugeridos"][0]
        self.assertEqual(doc["numero_processo_sugerido"], CNJ_VALIDO)
        self.assertEqual(doc["categoria_sugerida"], DocumentoCliente.CATEGORIA_PETICAO)

    def test_nao_sugere_processo_ja_existente(self):
        Processo.objects.create(cliente=self.cliente, numero_processo=CNJ_VALIDO)
        arvore = {
            "id": "raiz",
            "nome": f"Processo {CNJ_VALIDO}",
            "arquivos": [],
            "subpastas": [],
        }

        plano = importacao.sugerir_plano(arvore, self.cliente)

        self.assertEqual(plano["processos_sugeridos"], [])

    def test_classifica_documento_pessoal_por_palavra_chave(self):
        arvore = {
            "id": "raiz",
            "nome": "Documentos Pessoais",
            "arquivos": [
                {
                    "id": "f1",
                    "nome": "RG comprovante residencia.pdf",
                    "mime_type": "application/pdf",
                    "tamanho_bytes": 10,
                    "link_visualizacao": "",
                }
            ],
            "subpastas": [],
        }

        plano = importacao.sugerir_plano(arvore, self.cliente)

        doc = plano["documentos_sugeridos"][0]
        self.assertEqual(
            doc["categoria_sugerida"], DocumentoCliente.CATEGORIA_DOCUMENTO
        )
        self.assertEqual(doc["numero_processo_sugerido"], "")


class ConfirmarImportacaoTests(TestCase):
    def setUp(self):
        self.cliente = _cliente()

    def test_cria_processo_e_documento(self):
        resultado = importacao.confirmar_importacao(
            self.cliente,
            processos=[
                {
                    "numero_processo": CNJ_VALIDO,
                    "origem_pasta_id": "pasta-1",
                }
            ],
            documentos=[
                {
                    "drive_file_id": "f1",
                    "nome": "peticao.pdf",
                    "mime_type": "application/pdf",
                    "tamanho_bytes": 10,
                    "drive_folder_id": "pasta-1",
                    "link_visualizacao": "http://x",
                    "categoria": DocumentoCliente.CATEGORIA_PETICAO,
                    "processo_numero": CNJ_VALIDO,
                }
            ],
        )

        self.assertEqual(len(resultado["processos"]), 1)
        self.assertEqual(len(resultado["documentos"]), 1)
        processo = Processo.objects.get(numero_processo=CNJ_VALIDO)
        self.assertEqual(
            ProcessoDrive.objects.get(processo=processo).pasta_id, "pasta-1"
        )
        documento = DocumentoCliente.objects.get(drive_file_id="f1")
        self.assertEqual(documento.processo, processo)
        self.assertEqual(documento.cliente, self.cliente)

    def test_idempotente_ao_reenviar_o_mesmo_payload(self):
        payload_processos = [
            {"numero_processo": CNJ_VALIDO, "origem_pasta_id": "pasta-1"}
        ]
        payload_documentos = [
            {
                "drive_file_id": "f1",
                "nome": "peticao.pdf",
                "categoria": DocumentoCliente.CATEGORIA_PETICAO,
                "processo_numero": CNJ_VALIDO,
            }
        ]

        importacao.confirmar_importacao(
            self.cliente, payload_processos, payload_documentos
        )
        importacao.confirmar_importacao(
            self.cliente, payload_processos, payload_documentos
        )

        self.assertEqual(Processo.objects.filter(numero_processo=CNJ_VALIDO).count(), 1)
        self.assertEqual(DocumentoCliente.objects.filter(drive_file_id="f1").count(), 1)

    def test_documento_sem_processo_correspondente_fica_sem_vinculo(self):
        importacao.confirmar_importacao(
            self.cliente,
            processos=[],
            documentos=[
                {
                    "drive_file_id": "f1",
                    "nome": "rg.pdf",
                    "categoria": DocumentoCliente.CATEGORIA_DOCUMENTO,
                    "processo_numero": "",
                }
            ],
        )

        documento = DocumentoCliente.objects.get(drive_file_id="f1")
        self.assertIsNone(documento.processo)
