import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from clientes.models import Cliente
from documentos.models import ClienteDrive, DocumentoCliente
from integrations.google.exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
    GoogleConfigurationError,
)
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
            "processos_criados": 0,
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


def _login_admin(testcase):
    usuario = Usuario.objects.create(
        nome="Advogada", email="adv@example.com", cargo="Administrador"
    )
    auth_user = get_user_model().objects.create_superuser(
        username=usuario.email, email=usuario.email
    )
    testcase.client.force_login(auth_user)
    session = testcase.client.session
    session["usuario_id"] = usuario.pk
    session.save()
    return usuario


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class DriveExplorerViewsTests(TestCase):
    """Folder explorer endpoints; the Drive service layer is mocked."""

    def setUp(self):
        _login_admin(self)
        self.cliente = _cliente()
        _clientedrive(self.cliente)

    def _json(self, method, url, body):
        return getattr(self.client, method)(
            url, data=json.dumps(body), content_type="application/json"
        )

    @patch("documentos.views.services.pastas_gerenciadas_ids", return_value={"p1"})
    @patch("documentos.views.services.listar_conteudo_pasta")
    def test_listar_drive_serializa_pastas_e_arquivos(self, mock_listar, _mock_ger):
        mock_listar.return_value = {
            "folder_id": "f",
            "raiz_id": "r",
            "pastas": [{"id": "p1", "name": "01 Contratos"}, {"id": "p2", "name": "X"}],
            "arquivos": [{"id": "a1", "name": "a.pdf", "size": "10"}],
        }
        response = self.client.get(
            reverse("listar_drive", args=[self.cliente.pk]), {"folder_id": "f"}
        )
        self.assertEqual(response.status_code, 200, response.content)
        dados = response.json()["dados"]
        self.assertEqual(dados["raiz_id"], "r")
        self.assertEqual(
            [(p["id"], p["gerenciada"]) for p in dados["pastas"]],
            [("p1", True), ("p2", False)],
        )
        self.assertEqual(dados["arquivos"][0]["tamanho_bytes"], 10)
        self.assertEqual(mock_listar.call_args.args[2], "f")

    def test_listar_drive_rejeita_post(self):
        response = self.client.post(reverse("listar_drive", args=[self.cliente.pk]))
        self.assertEqual(response.status_code, 405)

    @patch("documentos.views.services.listar_conteudo_pasta")
    def test_erros_google_sao_mapeados(self, mock_listar):
        url = reverse("listar_drive", args=[self.cliente.pk])
        for exc, status in [
            (GoogleConfigurationError("cfg"), 503),
            (GoogleAuthorizationRequired("auth"), 401),
            (GoogleApiError("api"), 502),
        ]:
            with self.subTest(exc=type(exc).__name__):
                mock_listar.side_effect = exc
                self.assertEqual(self.client.get(url).status_code, status)

    @patch("documentos.views.services.criar_pasta")
    def test_criar_pasta(self, mock_criar):
        mock_criar.return_value = {"id": "nova", "name": "Nova"}
        url = reverse("criar_pasta_drive", args=[self.cliente.pk])
        ok = self._json("post", url, {"nome": " Nova ", "parent_id": "pai"})
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(ok.json()["dados"]["pasta"]["id"], "nova")
        self.assertEqual(
            mock_criar.call_args.kwargs, {"nome": "Nova", "parent_id": "pai"}
        )
        self.assertEqual(self._json("post", url, {"parent_id": "pai"}).status_code, 400)
        self.assertEqual(self._json("post", url, {"nome": "x"}).status_code, 400)
        self.assertEqual(self.client.get(url).status_code, 405)

    @patch("documentos.views.services.renomear_pasta")
    def test_renomear_pasta(self, mock_renomear):
        url = reverse("gerenciar_pasta_drive", args=[self.cliente.pk, "f1"])
        mock_renomear.return_value = {"id": "f1", "name": "Novo"}
        ok = self._json("patch", url, {"nome": "Novo"})
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertTrue(ok.json()["dados"]["pasta"]["gerenciada"])
        self.assertEqual(self._json("patch", url, {"nome": " "}).status_code, 400)
        mock_renomear.side_effect = ValueError("pasta estrutural")
        recusado = self._json("patch", url, {"nome": "Y"})
        self.assertEqual(recusado.status_code, 400)
        self.assertIn("pasta estrutural", recusado.json()["erros"]["folder_id"][0])

    @patch("documentos.views.services.excluir_pasta")
    def test_excluir_pasta_protege_raiz_do_cliente(self, mock_excluir):
        raiz = self.client.delete(
            reverse("gerenciar_pasta_drive", args=[self.cliente.pk, "c"])
        )
        self.assertEqual(raiz.status_code, 400)
        mock_excluir.assert_not_called()

        ok = self.client.delete(
            reverse("gerenciar_pasta_drive", args=[self.cliente.pk, "outra"])
        )
        self.assertEqual(ok.status_code, 200, ok.content)
        mock_excluir.assert_called_once()

    def test_gerenciar_pasta_rejeita_get(self):
        url = reverse("gerenciar_pasta_drive", args=[self.cliente.pk, "f1"])
        self.assertEqual(self.client.get(url).status_code, 405)

    @patch("documentos.views.services.upload_para_pasta")
    def test_upload_drive(self, mock_upload):
        mock_upload.return_value = {"id": "n1", "name": "rg.pdf"}
        url = reverse("upload_drive", args=[self.cliente.pk])

        def post(**fields):
            return self.client.post(url, fields)

        pdf = SimpleUploadedFile("rg.pdf", b"x", content_type="application/pdf")
        ok = post(folder_id="f", arquivo=pdf)
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(mock_upload.call_args.kwargs["folder_id"], "f")
        self.assertEqual(mock_upload.call_args.kwargs["content"], b"x")

        sem_pasta = post(arquivo=SimpleUploadedFile("a.pdf", b"x"))
        self.assertEqual(sem_pasta.status_code, 400)
        self.assertEqual(post(folder_id="f").status_code, 400)
        exe = post(folder_id="f", arquivo=SimpleUploadedFile("a.exe", b"x"))
        self.assertEqual(exe.status_code, 400)
        with override_settings(DRIVE_MAX_FILE_SIZE_MB=0):
            grande = post(folder_id="f", arquivo=SimpleUploadedFile("a.pdf", b"x"))
        self.assertEqual(grande.status_code, 400)
        self.assertEqual(mock_upload.call_count, 1)

    @patch("documentos.views.services.baixar_documento", return_value=b"PDFDATA")
    def test_download_documento(self, _mock_baixar):
        doc = DocumentoCliente.objects.create(
            cliente=self.cliente,
            categoria=DocumentoCliente.CATEGORIA_DOCUMENTO,
            nome="rg.pdf",
            drive_file_id="f-1",
            mime_type="application/pdf",
        )
        url = reverse("download_documento", args=[self.cliente.pk, doc.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"PDFDATA")
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn('filename="rg.pdf"', response["Content-Disposition"])
        self.assertEqual(self.client.post(url).status_code, 405)


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class DriveImportViewsTests(TestCase):
    def setUp(self):
        _login_admin(self)

    @patch("documentos.views.importacao.descobrir_clientes_novos")
    def test_descobrir_clientes(self, mock_descobrir):
        mock_descobrir.return_value = [{"pasta_id": "p", "nome": "Fulano"}]
        url = reverse("descobrir_clientes_drive")
        response = self.client.get(url)
        self.assertEqual(response.json()["dados"]["candidatos"][0]["nome"], "Fulano")
        self.assertEqual(self.client.post(url).status_code, 405)
        mock_descobrir.side_effect = GoogleAuthorizationRequired("x")
        self.assertEqual(self.client.get(url).status_code, 401)

    @patch("documentos.views.importacao.criar_clientes_a_partir_de_pastas")
    def test_confirmar_clientes_novos(self, mock_criar):
        url = reverse("confirmar_clientes_novos_drive")
        mock_criar.return_value = [_cliente("Importado")]
        ok = self.client.post(
            url,
            data=json.dumps({"pastas": [{"id": "p"}]}),
            content_type="application/json",
        )
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertEqual(ok.json()["dados"]["clientes_criados"][0]["nome"], "Importado")
        invalido = self.client.post(
            url, data=json.dumps({"pastas": "x"}), content_type="application/json"
        )
        self.assertEqual(invalido.status_code, 400)
        self.assertEqual(self.client.get(url).status_code, 405)
