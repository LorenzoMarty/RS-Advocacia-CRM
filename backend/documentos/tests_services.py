from unittest.mock import patch

from django.test import TestCase, override_settings

from clientes.models import Cliente
from documentos import services
from documentos.models import (
    ClienteDrive,
    DocumentoCliente,
    PastaGerenciada,
    ProcessoDrive,
)
from integrations.google.exceptions import GoogleConfigurationError
from processos.models import Processo

ROOT = "root-folder-id"


def _cliente(nome="João Silva"):
    return Cliente.objects.create(
        nome=nome,
        email="c@example.com",
        telefone="11999999999",
        cpf="12345678901",
        tipo_cliente="esporadico",
    )


def _processo(cliente, *, area="Cível", numero="0001234-56.2026"):
    return Processo.objects.create(
        numero_processo=numero,
        cliente=cliente,
        descricao="",
        vara="1ª Vara",
        area_juridica=area,
        status="ativo",
        advogado_responsavel="Dra. X",
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


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class TemplateTests(TestCase):
    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_creates_template_and_caches_root(self, mock_drive, mock_service):
        mock_drive.ensure_folder.side_effect = lambda _s, name, _parent: f"id-{name}"
        cliente = _cliente()

        root_id = services.ensure_client_template("user", cliente)

        self.assertEqual(root_id, "id-João Silva")
        names = [c.args[1] for c in mock_drive.ensure_folder.call_args_list]
        # client root + the three fixed template folders
        self.assertEqual(names[0], "João Silva")
        for fixed in services.TEMPLATE_FOLDERS:
            self.assertIn(fixed, names)
        # root id cached for reuse
        registro = ClienteDrive.objects.get(cliente=cliente)
        self.assertEqual(registro.pasta_cliente_id, "id-João Silva")

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_per_process_folders_with_subfolders(self, mock_drive, mock_service):
        mock_drive.ensure_folder.side_effect = lambda _s, name, _parent: f"id-{name}"
        cliente = _cliente()
        _processo(cliente, area="Cível", numero="123")

        services.ensure_client_template("user", cliente)

        names = [c.args[1] for c in mock_drive.ensure_folder.call_args_list]
        self.assertIn("Cível - 123", names)
        for subpasta in services.PROCESSO_SUBPASTAS:
            self.assertIn(subpasta, names)
        # process subfolders are created under the process folder
        sub_call = next(
            c
            for c in mock_drive.ensure_folder.call_args_list
            if c.args[1] == services.PROCESSO_SUBPASTAS[0]
        )
        self.assertEqual(sub_call.args[2], "id-Cível - 123")

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_reuses_legacy_clientedrive_root(self, mock_drive, mock_service):
        mock_drive.ensure_folder.side_effect = lambda _s, name, _parent: f"id-{name}"
        cliente = _cliente()
        ClienteDrive.objects.create(
            cliente=cliente,
            pasta_cliente_id="legacy-root",
            pasta_peticoes_id="p",
            pasta_documentos_id="d",
            pasta_outros_id="o",
        )

        root_id = services.ensure_client_template("user", cliente)

        self.assertEqual(root_id, "legacy-root")
        # template folders created under the existing root, no new client folder
        names = [c.args[1] for c in mock_drive.ensure_folder.call_args_list]
        self.assertNotIn("João Silva", names)
        self.assertEqual(ClienteDrive.objects.filter(cliente=cliente).count(), 1)

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_listar_conteudo_root_ensures_template(self, mock_drive, mock_service):
        mock_drive.ensure_folder.side_effect = lambda _s, name, _parent: f"id-{name}"
        mock_drive.list_folders.return_value = [{"id": "f1", "name": "1. DOCUMENTOS"}]
        mock_drive.list_files.return_value = [
            {"id": "a1", "name": "rg.pdf", "mimeType": "application/pdf"}
        ]
        cliente = _cliente()

        conteudo = services.listar_conteudo_pasta("user", cliente, None)

        self.assertEqual(conteudo["folder_id"], "id-João Silva")
        self.assertEqual(conteudo["raiz_id"], "id-João Silva")
        self.assertEqual(conteudo["pastas"][0]["id"], "f1")
        self.assertEqual(conteudo["arquivos"][0]["id"], "a1")

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_listar_conteudo_subfolder_skips_template(self, mock_drive, mock_service):
        mock_drive.list_folders.return_value = []
        mock_drive.list_files.return_value = []
        cliente = _cliente()
        ClienteDrive.objects.create(
            cliente=cliente,
            pasta_cliente_id="root-x",
            pasta_peticoes_id="",
            pasta_documentos_id="",
            pasta_outros_id="",
        )

        conteudo = services.listar_conteudo_pasta("user", cliente, "sub-folder")

        self.assertEqual(conteudo["folder_id"], "sub-folder")
        self.assertEqual(conteudo["raiz_id"], "root-x")
        mock_drive.ensure_folder.assert_not_called()
        mock_drive.list_folders.assert_called_once_with(
            mock_service.return_value, "sub-folder"
        )


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class PastaNumeradaTests(TestCase):
    def setUp(self):
        self.cliente = _cliente()

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_create_prefixes_sequential_number(self, mock_drive, mock_service):
        mock_drive.create_folder.side_effect = [
            {"id": "f1", "name": "1. A"},
            {"id": "f2", "name": "2. B"},
            {"id": "f3", "name": "3. C"},
        ]
        for nome in ("A", "B", "C"):
            services.criar_pasta("user", self.cliente, nome=nome, parent_id="parent")

        nomes = [c.args[1] for c in mock_drive.create_folder.call_args_list]
        self.assertEqual(nomes, ["1. A", "2. B", "3. C"])
        ordens = list(
            PastaGerenciada.objects.filter(parent_drive_id="parent")
            .order_by("ordem")
            .values_list("ordem", "nome_base")
        )
        self.assertEqual(ordens, [(1, "A"), (2, "B"), (3, "C")])

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_delete_renumbers_following_siblings(self, mock_drive, mock_service):
        mock_drive.create_folder.side_effect = [
            {"id": "f1", "name": "1. A"},
            {"id": "f2", "name": "2. B"},
            {"id": "f3", "name": "3. C"},
        ]
        for nome in ("A", "B", "C"):
            services.criar_pasta("user", self.cliente, nome=nome, parent_id="parent")

        services.excluir_pasta("user", self.cliente, "f2")

        # B removed; C must become "2. C" (gap closed) via rename_file.
        mock_drive.delete_folder.assert_called_once_with(
            mock_service.return_value, "f2"
        )
        mock_drive.rename_file.assert_called_once_with(
            mock_service.return_value, "f3", "2. C"
        )
        restantes = list(
            PastaGerenciada.objects.filter(parent_drive_id="parent")
            .order_by("ordem")
            .values_list("ordem", "nome_base")
        )
        self.assertEqual(restantes, [(1, "A"), (2, "C")])

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_rename_keeps_number(self, mock_drive, mock_service):
        mock_drive.create_folder.return_value = {"id": "f1", "name": "1. A"}
        services.criar_pasta("user", self.cliente, nome="A", parent_id="parent")

        services.renomear_pasta("user", self.cliente, "f1", "Contratos")

        mock_drive.rename_file.assert_called_once_with(
            mock_service.return_value, "f1", "1. Contratos"
        )
        self.assertEqual(
            PastaGerenciada.objects.get(drive_folder_id="f1").nome_base, "Contratos"
        )

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_rename_rejects_unmanaged_folder(self, mock_drive, mock_service):
        with self.assertRaises(ValueError):
            services.renomear_pasta("user", self.cliente, "structural", "X")


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class RenameSyncTests(TestCase):
    def setUp(self):
        self.cliente = _cliente(nome="Cliente Antigo")

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_renomear_pasta_cliente_renames_root_folder(self, mock_drive, mock_service):
        ClienteDrive.objects.create(
            cliente=self.cliente,
            pasta_cliente_id="cliente-folder",
            pasta_peticoes_id="",
            pasta_documentos_id="",
            pasta_outros_id="",
        )

        services.renomear_pasta_cliente("user", self.cliente, "Cliente Novo")

        mock_drive.rename_file.assert_called_once_with(
            mock_service.return_value, "cliente-folder", "Cliente Novo"
        )

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_renomear_pasta_cliente_noop_without_drive(self, mock_drive, mock_service):
        services.renomear_pasta_cliente("user", self.cliente, "Cliente Novo")
        mock_drive.rename_file.assert_not_called()

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_renomear_pasta_processo_renames_via_processo_drive(
        self, mock_drive, mock_service
    ):
        processo = _processo(self.cliente, area="Trabalhista", numero="0001234-56.2026")
        ProcessoDrive.objects.create(processo=processo, pasta_id="p-old")

        services.renomear_pasta_processo("user", processo, "Cível - 0001234-56.2026")

        mock_drive.rename_file.assert_called_once_with(
            mock_service.return_value, "p-old", "Trabalhista - 0001234-56.2026"
        )

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_renomear_pasta_processo_noop_without_processo_drive(
        self, mock_drive, mock_service
    ):
        processo = _processo(self.cliente, area="Trabalhista", numero="0001234-56.2026")

        services.renomear_pasta_processo("user", processo, "Cível - 0001234-56.2026")

        mock_drive.rename_file.assert_not_called()

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_renomear_pasta_processo_noop_when_name_unchanged(
        self, mock_drive, mock_service
    ):
        processo = _processo(self.cliente, area="Cível", numero="0001234-56.2026")
        ProcessoDrive.objects.create(processo=processo, pasta_id="p-old")

        services.renomear_pasta_processo("user", processo, "Cível - 0001234-56.2026")

        mock_drive.rename_file.assert_not_called()
