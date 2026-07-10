from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from clientes.models import Cliente
from documentos.models import ClienteDrive, DocumentoCliente
from usuarios.models import Usuario

ROOT = "root-folder-id"


def _cliente(nome="João Silva", cpf=""):
    return Cliente.objects.create(
        nome=nome,
        email="c@example.com",
        telefone="11999999999",
        cpf=cpf,
        tipo_cliente="esporadico",
    )


def _clientedrive(cliente):
    return ClienteDrive.objects.create(
        cliente=cliente,
        pasta_cliente_id="c",
        pasta_peticoes_id="peticoes-folder",
        pasta_documentos_id="documentos-folder",
        pasta_outros_id="outros-folder",
    )


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class DocumentoViewsTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="adv@example.com", cargo="Administrador"
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email, email=self.usuario.email
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session.save()

        self.cliente = _cliente()
        _clientedrive(self.cliente)

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_upload_creates_document(self, mock_drive, mock_service):
        mock_drive.upload_file.return_value = {
            "id": "file-1",
            "webViewLink": "http://view/1",
        }
        upload = SimpleUploadedFile(
            "rg.pdf", b"conteudo", content_type="application/pdf"
        )
        response = self.client.post(
            reverse("upload_documento", args=[self.cliente.pk]),
            {"categoria": DocumentoCliente.CATEGORIA_DOCUMENTO, "arquivo": upload},
        )
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(DocumentoCliente.objects.count(), 1)
        doc = response.json()["dados"]["documento"]
        self.assertEqual(doc["drive_file_id"], "file-1")
        self.assertEqual(doc["nome"], "rg.pdf")

    def test_upload_rejects_invalid_extension(self):
        upload = SimpleUploadedFile(
            "malware.exe", b"x", content_type="application/octet-stream"
        )
        response = self.client.post(
            reverse("upload_documento", args=[self.cliente.pk]),
            {"categoria": DocumentoCliente.CATEGORIA_DOCUMENTO, "arquivo": upload},
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["sucesso"])
        self.assertEqual(DocumentoCliente.objects.count(), 0)

    @override_settings(DRIVE_MAX_FILE_SIZE_MB=0)
    def test_upload_rejects_too_large(self):
        upload = SimpleUploadedFile("rg.pdf", b"x", content_type="application/pdf")
        response = self.client.post(
            reverse("upload_documento", args=[self.cliente.pk]),
            {"categoria": DocumentoCliente.CATEGORIA_DOCUMENTO, "arquivo": upload},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(DocumentoCliente.objects.count(), 0)

    def test_list_returns_documents(self):
        DocumentoCliente.objects.create(
            cliente=self.cliente,
            categoria=DocumentoCliente.CATEGORIA_PETICAO,
            nome="p1.docx",
            drive_file_id="f-1",
            drive_folder_id="peticoes-folder",
        )
        response = self.client.get(reverse("listar_documentos", args=[self.cliente.pk]))
        self.assertEqual(response.status_code, 200)
        docs = response.json()["dados"]["documentos"]
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]["nome"], "p1.docx")

    def test_list_filters_by_category(self):
        DocumentoCliente.objects.create(
            cliente=self.cliente,
            categoria=DocumentoCliente.CATEGORIA_PETICAO,
            nome="p1.docx",
            drive_file_id="f-1",
            drive_folder_id="pf",
        )
        DocumentoCliente.objects.create(
            cliente=self.cliente,
            categoria=DocumentoCliente.CATEGORIA_DOCUMENTO,
            nome="d1.pdf",
            drive_file_id="f-2",
            drive_folder_id="df",
        )
        response = self.client.get(
            reverse("listar_documentos", args=[self.cliente.pk]),
            {"categoria": DocumentoCliente.CATEGORIA_PETICAO},
        )
        docs = response.json()["dados"]["documentos"]
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]["categoria"], DocumentoCliente.CATEGORIA_PETICAO)

    def test_estrutura_returns_folder_ids(self):
        response = self.client.get(reverse("estrutura_drive", args=[self.cliente.pk]))
        self.assertEqual(response.status_code, 200)
        estrutura = response.json()["dados"]["estrutura"]
        self.assertEqual(estrutura["pasta_peticoes_id"], "peticoes-folder")

    @patch("documentos.services.drive_service")
    @patch("documentos.services.drive")
    def test_download_blocks_cross_client_access(self, mock_drive, mock_service):
        outro = _cliente("Cliente B")
        doc_outro = DocumentoCliente.objects.create(
            cliente=outro,
            categoria=DocumentoCliente.CATEGORIA_DOCUMENTO,
            nome="segredo.pdf",
            drive_file_id="f-b-1",
            drive_folder_id="df",
        )
        # requesting client B's document under client A's URL must 404
        response = self.client.get(
            reverse("download_documento", args=[self.cliente.pk, doc_outro.pk])
        )
        self.assertEqual(response.status_code, 404)
        mock_drive.download_file.assert_not_called()


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class ImportacaoDriveViewsTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="adv@example.com", cargo="Administrador"
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email, email=self.usuario.email
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session.save()

        self.cliente = _cliente()
        _clientedrive(self.cliente)

    @patch("documentos.importacao.drive_service")
    @patch("documentos.importacao.drive")
    def test_escanear_retorna_sugestoes_sem_gravar_no_banco(
        self, mock_drive, mock_service
    ):
        mock_drive.list_folders.return_value = []
        mock_drive.list_files.return_value = [
            {
                "id": "f1",
                "name": "RG comprovante residencia.pdf",
                "mimeType": "application/pdf",
            }
        ]

        response = self.client.post(
            reverse("escanear_importacao", args=[self.cliente.pk]),
            data={},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        dados = response.json()["dados"]
        self.assertEqual(len(dados["documentos_sugeridos"]), 1)
        self.assertEqual(DocumentoCliente.objects.count(), 0)

    def test_confirmar_cria_processo_e_documento(self):
        cnj = "1234567-79.2024.8.13.0001"
        response = self.client.post(
            reverse("confirmar_importacao", args=[self.cliente.pk]),
            data={
                "processos": [{"numero_processo": cnj, "origem_pasta_id": "pasta-1"}],
                "documentos": [
                    {
                        "drive_file_id": "f1",
                        "nome": "peticao.pdf",
                        "categoria": DocumentoCliente.CATEGORIA_PETICAO,
                        "processo_numero": cnj,
                    }
                ],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        dados = response.json()["dados"]
        self.assertEqual(dados["processos_criados"], 1)
        self.assertEqual(dados["documentos_criados"], 1)
        documento = DocumentoCliente.objects.get(drive_file_id="f1")
        self.assertEqual(documento.processo.numero_processo, cnj)

    def test_confirmar_rejeita_corpo_mal_formado(self):
        response = self.client.post(
            reverse("confirmar_importacao", args=[self.cliente.pk]),
            data={"processos": "nao-e-lista", "documentos": []},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class DocumentoPermissionTests(TestCase):
    def setUp(self):
        self.cliente = _cliente()

    def test_requires_permission(self):
        # authenticated user without documentos permissions
        user = get_user_model().objects.create_user(
            username="semperm", password="secret123"
        )
        user.user_permissions.add(Permission.objects.get(codename="view_cliente"))
        self.client.force_login(user)

        response = self.client.get(reverse("listar_documentos", args=[self.cliente.pk]))
        self.assertEqual(response.status_code, 403)

    def test_requires_authentication(self):
        response = self.client.get(reverse("listar_documentos", args=[self.cliente.pk]))
        self.assertEqual(response.status_code, 401)


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class OrganizacaoViewsTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="adv@example.com", cargo="Administrador"
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email, email=self.usuario.email
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session.save()

        self.cliente = _cliente()
        _clientedrive(self.cliente)

    def test_sugerir_rejeita_get(self):
        response = self.client.get(
            reverse("sugerir_organizacao_drive", args=[self.cliente.pk])
        )
        self.assertEqual(response.status_code, 405)

    def test_aplicar_rejeita_get(self):
        response = self.client.get(
            reverse("aplicar_organizacao_drive", args=[self.cliente.pk])
        )
        self.assertEqual(response.status_code, 405)

    @patch("documentos.views.organizacao.sugerir_organizacao")
    def test_sugerir_retorna_plano(self, mock_sugerir):
        mock_sugerir.return_value = {"operacoes": [], "descartadas": 0}

        response = self.client.post(
            reverse("sugerir_organizacao_drive", args=[self.cliente.pk]),
            content_type="application/json",
            data="{}",
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["dados"]["operacoes"], [])

    @patch("documentos.views.organizacao.sugerir_organizacao")
    def test_sugerir_ia_indisponivel_retorna_502(self, mock_sugerir):
        from documentos.organizacao import OrganizacaoIndisponivel

        mock_sugerir.side_effect = OrganizacaoIndisponivel("IA fora do ar")

        response = self.client.post(
            reverse("sugerir_organizacao_drive", args=[self.cliente.pk]),
            content_type="application/json",
            data="{}",
        )

        self.assertEqual(response.status_code, 502)

    @patch("documentos.views.organizacao.aplicar_organizacao")
    def test_aplicar_retorna_resumo(self, mock_aplicar):
        mock_aplicar.return_value = {
            "aplicadas": 2,
            "falhas": [],
            "rejeitadas": [],
            "pastas_criadas": {},
        }

        response = self.client.post(
            reverse("aplicar_organizacao_drive", args=[self.cliente.pk]),
            content_type="application/json",
            data='{"operacoes": []}',
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["dados"]["aplicadas"], 2)

    @patch("documentos.views.organizacao.aplicar_organizacao")
    def test_aplicar_corpo_invalido_retorna_400(self, mock_aplicar):
        from documentos.organizacao import OrganizacaoInvalida

        mock_aplicar.side_effect = OrganizacaoInvalida("'operacoes' deve ser uma lista.")

        response = self.client.post(
            reverse("aplicar_organizacao_drive", args=[self.cliente.pk]),
            content_type="application/json",
            data='{"operacoes": 1}',
        )

        self.assertEqual(response.status_code, 400)

    @patch("documentos.views.importacao.sugerir_plano_ia")
    @patch("documentos.views.importacao.escanear_arvore")
    def test_escanear_com_usar_ia_chama_plano_ia(self, mock_scan, mock_plano_ia):
        mock_scan.return_value = {"id": "c", "nome": "", "arquivos": [], "subpastas": []}
        mock_plano_ia.return_value = {
            "processos_sugeridos": [],
            "documentos_sugeridos": [],
            "avisos_processos_sem_numero": [],
            "ia": {"usada": True, "aviso": None},
        }

        response = self.client.post(
            reverse("escanear_importacao", args=[self.cliente.pk]),
            content_type="application/json",
            data='{"usar_ia": true}',
        )

        self.assertEqual(response.status_code, 200, response.json())
        mock_plano_ia.assert_called_once()
        self.assertTrue(response.json()["dados"]["ia"]["usada"])
