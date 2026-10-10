from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from clientes.models import Cliente
from documentos import tasks
from documentos.models import ClienteDrive, DocumentoCliente, ProcessoDrive
from integrations.models import GoogleAccount, GoogleDriveSync
from processos.models import Processo
from usuarios.models import Usuario

CNJ_VALIDO = "1234567-79.2024.8.13.0001"


def _usuario():
    return Usuario.objects.create(
        nome="Advogada", email="advogada@example.com", cargo="Administrador"
    )


def _account(usuario):
    account = GoogleAccount.objects.create(
        usuario=usuario, google_user_id="sub", email=usuario.email
    )
    account.store_tokens(access_token="access", refresh_token="refresh")
    account.save()
    return account


class SincronizarContaTests(TestCase):
    @patch("documentos.tasks.drive_service")
    @patch("documentos.tasks.drive")
    def test_primeira_execucao_apenas_estabelece_cursor(self, mock_drive, mock_service):
        usuario = _usuario()
        account = _account(usuario)
        mock_drive.get_start_page_token.return_value = "token-inicial"

        resultado = tasks._sincronizar_conta(account)

        self.assertEqual(resultado, {})
        estado = GoogleDriveSync.objects.get(account=account)
        self.assertEqual(estado.start_page_token, "token-inicial")
        self.assertIsNotNone(estado.last_synced_at)
        mock_drive.list_changes.assert_not_called()

    @patch("documentos.tasks.services._root_folder_id", return_value="raiz-clientes")
    @patch("documentos.tasks.drive_service")
    @patch("documentos.tasks.drive")
    def test_persiste_novo_cursor_apos_processar_mudancas(
        self, mock_drive, mock_service, mock_root
    ):
        usuario = _usuario()
        account = _account(usuario)
        GoogleDriveSync.objects.create(account=account, start_page_token="token-antigo")
        mock_drive.list_changes.return_value = {
            "changes": [],
            "new_start_page_token": "token-novo",
        }

        tasks._sincronizar_conta(account)

        estado = GoogleDriveSync.objects.get(account=account)
        self.assertEqual(estado.start_page_token, "token-novo")


class ProcessarMudancasTests(TestCase):
    @patch("documentos.importacao.services._root_folder_id", return_value="raiz-clientes")
    @patch("documentos.tasks.services._root_folder_id", return_value="raiz-clientes")
    @patch("documentos.importacao.drive_service")
    @patch("documentos.importacao.drive")
    def test_pasta_nova_na_raiz_cria_cliente(
        self, mock_drive_importacao, mock_drive_service, mock_root_tasks, mock_root_importacao
    ):
        mock_drive_importacao.ensure_folder.side_effect = (
            lambda service, nome, parent_id: f"{parent_id}/{nome}"
        )
        mock_drive_importacao.list_folders.return_value = []
        mock_drive_importacao.list_files.return_value = []

        changes = [
            {
                "fileId": "pasta-nova",
                "file": {
                    "id": "pasta-nova",
                    "name": "Maria Souza",
                    "mimeType": "application/vnd.google-apps.folder",
                    "parents": ["raiz-clientes"],
                    "trashed": False,
                },
            }
        ]

        contadores = tasks._processar_mudancas("usuario", changes)

        self.assertEqual(contadores["clientes_criados"], 1)
        self.assertEqual(Cliente.objects.count(), 1)

    @patch("documentos.tasks.services._root_folder_id", return_value="raiz-clientes")
    @patch("documentos.importacao.drive_service")
    @patch("documentos.importacao.drive")
    def test_mudanca_em_pasta_conhecida_reescaneia(
        self, mock_drive_importacao, mock_drive_service, mock_root
    ):
        cliente = Cliente.objects.create(
            nome="João Silva",
            email="joao@example.com",
            telefone="11999999999",
            cpf="12345678901",
        )
        ClienteDrive.objects.create(
            cliente=cliente,
            pasta_cliente_id="pasta-cliente",
            pasta_peticoes_id="p",
            pasta_documentos_id="d",
            pasta_outros_id="o",
        )

        def list_folders(service, parent_id):
            if parent_id == "pasta-cliente":
                return [{"id": "sub", "name": f"Processo {CNJ_VALIDO}"}]
            return []

        mock_drive_importacao.list_folders.side_effect = list_folders
        mock_drive_importacao.list_files.side_effect = lambda service, parent_id: []

        changes = [
            {
                "fileId": "sub",
                "file": {
                    "id": "sub",
                    "name": f"Processo {CNJ_VALIDO}",
                    "mimeType": "application/vnd.google-apps.folder",
                    "parents": ["pasta-cliente"],
                    "trashed": False,
                },
            }
        ]

        contadores = tasks._processar_mudancas("usuario", changes)

        self.assertEqual(contadores["processos_criados"], 1)
        Processo.objects.get(cliente=cliente, numero_processo=CNJ_VALIDO)

    @patch("documentos.tasks.services._root_folder_id", return_value="raiz-clientes")
    def test_mudanca_sem_pai_conhecido_e_ignorada(self, mock_root):
        changes = [
            {
                "fileId": "arquivo-solto",
                "file": {
                    "id": "arquivo-solto",
                    "name": "algo.pdf",
                    "mimeType": "application/pdf",
                    "parents": ["pasta-desconhecida"],
                    "trashed": False,
                },
            }
        ]

        contadores = tasks._processar_mudancas("usuario", changes)

        self.assertEqual(contadores["clientes_criados"], 0)
        self.assertEqual(contadores["processos_criados"], 0)


class InativarTests(TestCase):
    def test_inativa_cliente_quando_pasta_cliente_removida(self):
        cliente = Cliente.objects.create(
            nome="João Silva",
            email="joao@example.com",
            telefone="11999999999",
            cpf="12345678901",
        )
        ClienteDrive.objects.create(
            cliente=cliente,
            pasta_cliente_id="pasta-cliente",
            pasta_peticoes_id="p",
            pasta_documentos_id="d",
            pasta_outros_id="o",
        )

        total = tasks._inativar("pasta-cliente")

        cliente.refresh_from_db()
        self.assertEqual(total, 1)
        self.assertFalse(cliente.ativo)

    def test_inativa_processo_quando_pasta_processo_removida(self):
        cliente = Cliente.objects.create(
            nome="João Silva",
            email="joao@example.com",
            telefone="11999999999",
            cpf="12345678901",
        )
        processo = Processo.objects.create(cliente=cliente, numero_processo=CNJ_VALIDO)
        ProcessoDrive.objects.create(processo=processo, pasta_id="pasta-processo")

        total = tasks._inativar("pasta-processo")

        processo.refresh_from_db()
        self.assertEqual(total, 1)
        self.assertEqual(processo.status, "Inativo (pasta removida do Drive)")

    def test_remove_documento_quando_arquivo_removido(self):
        cliente = Cliente.objects.create(
            nome="João Silva",
            email="joao@example.com",
            telefone="11999999999",
            cpf="12345678901",
        )
        DocumentoCliente.objects.create(
            cliente=cliente,
            drive_file_id="arquivo-x",
            categoria=DocumentoCliente.CATEGORIA_OUTRO,
            nome="doc.pdf",
        )

        total = tasks._inativar("arquivo-x")

        self.assertEqual(total, 0)
        self.assertFalse(DocumentoCliente.objects.filter(drive_file_id="arquivo-x").exists())

    def test_pasta_sem_id_nao_faz_nada(self):
        self.assertEqual(tasks._inativar(None), 0)


class SincronizarDriveTests(TestCase):
    @patch("documentos.tasks._sincronizar_conta")
    def test_ignora_contas_revogadas(self, mock_sincronizar_conta):
        usuario = _usuario()
        account = _account(usuario)
        account.revoked_at = timezone.now()
        account.save()

        resumo = tasks.sincronizar_drive()

        mock_sincronizar_conta.assert_not_called()
        self.assertEqual(resumo["contas_sincronizadas"], 0)

    @patch("documentos.tasks._sincronizar_conta")
    def test_soma_contadores_de_contas_conectadas(self, mock_sincronizar_conta):
        usuario = _usuario()
        _account(usuario)
        mock_sincronizar_conta.return_value = {
            "clientes_criados": 2,
            "processos_criados": 1,
            "documentos_criados": 0,
            "inativados": 0,
        }

        resumo = tasks.sincronizar_drive()

        self.assertEqual(resumo["contas_sincronizadas"], 1)
        self.assertEqual(resumo["clientes_criados"], 2)
