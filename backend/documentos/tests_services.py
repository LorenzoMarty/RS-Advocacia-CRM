from unittest.mock import patch

from django.test import TestCase, override_settings

from clientes.models import Cliente
from documentos import services
from documentos.models import ClienteDrive, DocumentoCliente
from integrations.google.exceptions import GoogleConfigurationError

ROOT = "root-folder-id"


def _cliente(nome="João Silva"):
    return Cliente.objects.create(
        nome=nome,
        email="c@example.com",
        telefone="11999999999",
        cpf="12345678901",
        tipo_cliente="esporadico",
    )


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class EnsureStructureTests(TestCase):
    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_creates_full_tree_and_persists_ids(self, mock_drive, mock_service):
        mock_drive.ensure_folder.side_effect = [
            "cliente-folder",
            "peticoes-folder",
            "documentos-folder",
            "outros-folder",
        ]
        cliente = _cliente()

        estrutura = services.ensure_client_drive_structure("user", cliente)

        self.assertEqual(estrutura.pasta_cliente_id, "cliente-folder")
        self.assertEqual(estrutura.pasta_peticoes_id, "peticoes-folder")
        self.assertEqual(estrutura.pasta_documentos_id, "documentos-folder")
        self.assertEqual(estrutura.pasta_outros_id, "outros-folder")
        self.assertEqual(mock_drive.ensure_folder.call_count, 4)
        # client folder created under the configured root
        first_call = mock_drive.ensure_folder.call_args_list[0]
        self.assertEqual(first_call.args[1], "João Silva")
        self.assertEqual(first_call.args[2], ROOT)

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_reuses_existing_clientedrive_without_drive_calls(
        self, mock_drive, mock_service
    ):
        cliente = _cliente()
        ClienteDrive.objects.create(
            cliente=cliente,
            pasta_cliente_id="c",
            pasta_peticoes_id="p",
            pasta_documentos_id="d",
            pasta_outros_id="o",
        )

        estrutura = services.ensure_client_drive_structure("user", cliente)

        self.assertEqual(estrutura.pasta_peticoes_id, "p")
        mock_drive.ensure_folder.assert_not_called()
        mock_service.assert_not_called()


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID="")
class MissingConfigTests(TestCase):
    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_missing_root_raises(self, mock_drive, mock_service):
        mock_drive.ensure_folder.return_value = "x"
        cliente = _cliente()
        with self.assertRaises(GoogleConfigurationError):
            services.ensure_client_drive_structure("user", cliente)


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class UploadTests(TestCase):
    def setUp(self):
        self.cliente = _cliente()
        ClienteDrive.objects.create(
            cliente=self.cliente,
            pasta_cliente_id="c",
            pasta_peticoes_id="peticoes-folder",
            pasta_documentos_id="documentos-folder",
            pasta_outros_id="outros-folder",
        )

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_new_upload_creates_document(self, mock_drive, mock_service):
        mock_drive.upload_file.return_value = {
            "id": "file-1",
            "webViewLink": "http://view/1",
        }

        doc = services.upload_documento(
            "user",
            self.cliente,
            categoria=DocumentoCliente.CATEGORIA_DOCUMENTO,
            nome="rg.pdf",
            content=b"abc",
            mime_type="application/pdf",
        )

        self.assertEqual(doc.drive_file_id, "file-1")
        self.assertEqual(doc.drive_folder_id, "documentos-folder")
        self.assertEqual(doc.tamanho_bytes, 3)
        self.assertEqual(doc.link_visualizacao, "http://view/1")
        mock_drive.upload_file.assert_called_once()
        # uploaded into the Documentos subfolder
        self.assertEqual(mock_drive.upload_file.call_args.args[2], "documentos-folder")

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_reupload_same_name_updates_not_duplicates(self, mock_drive, mock_service):
        mock_drive.upload_file.return_value = {
            "id": "file-1",
            "webViewLink": "http://v",
        }
        services.upload_documento(
            "user",
            self.cliente,
            categoria=DocumentoCliente.CATEGORIA_DOCUMENTO,
            nome="rg.pdf",
            content=b"abc",
            mime_type="application/pdf",
        )

        mock_drive.update_file.return_value = {
            "id": "file-1",
            "webViewLink": "http://v2",
        }
        doc = services.upload_documento(
            "user",
            self.cliente,
            categoria=DocumentoCliente.CATEGORIA_DOCUMENTO,
            nome="rg.pdf",
            content=b"abcdef",
            mime_type="application/pdf",
        )

        self.assertEqual(DocumentoCliente.objects.count(), 1)
        self.assertEqual(doc.drive_file_id, "file-1")
        self.assertEqual(doc.tamanho_bytes, 6)
        self.assertEqual(doc.link_visualizacao, "http://v2")
        mock_drive.update_file.assert_called_once_with(
            mock_service.return_value, "file-1", b"abcdef", "application/pdf"
        )

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_invalid_category_rejected(self, mock_drive, mock_service):
        with self.assertRaises(ValueError):
            services.upload_documento(
                "user",
                self.cliente,
                categoria="bogus",
                nome="x.pdf",
                content=b"a",
                mime_type="application/pdf",
            )


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class ListTests(TestCase):
    def test_filters_by_category_and_isolates_clients(self):
        a = _cliente("Cliente A")
        b = _cliente("Cliente B")
        DocumentoCliente.objects.create(
            cliente=a,
            categoria=DocumentoCliente.CATEGORIA_PETICAO,
            nome="p1.docx",
            drive_file_id="f-a-1",
            drive_folder_id="pf",
        )
        DocumentoCliente.objects.create(
            cliente=a,
            categoria=DocumentoCliente.CATEGORIA_DOCUMENTO,
            nome="d1.pdf",
            drive_file_id="f-a-2",
            drive_folder_id="df",
        )
        DocumentoCliente.objects.create(
            cliente=b,
            categoria=DocumentoCliente.CATEGORIA_DOCUMENTO,
            nome="d2.pdf",
            drive_file_id="f-b-1",
            drive_folder_id="df",
        )

        self.assertEqual(len(services.list_client_files(a)), 2)
        self.assertEqual(len(services.list_client_petitions(a)), 1)
        self.assertEqual(len(services.list_client_documents(a)), 1)
        # client B's documents never leak into client A's listing
        a_ids = {d.drive_file_id for d in services.list_client_files(a)}
        self.assertNotIn("f-b-1", a_ids)
