import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from clientes.models import Cliente
from integrations.google.exceptions import (
    GoogleApiError,
    GoogleAuthorizationRequired,
)
from meetings import services
from meetings.models import Gravacao, Reuniao
from usuarios.models import Usuario

ROOT = "root-folder-id"

PROCESSING_SETTINGS = {
    "OPENAI_API_KEY": "test-key",
    "CELERY_BROKER_URL": "memory://",
    "MEETINGS_PROCESSING_MODE": "celery",
    "GOOGLE_DRIVE_ROOT_FOLDER_ID": ROOT,
}


def _cliente(nome="Cliente"):
    return Cliente.objects.create(
        nome=nome,
        email="cliente@example.com",
        telefone="11999999999",
        cpf="12345678901",
    )


def _ensure_folder_fake(_service, name, _parent_id):
    return f"id-{name}"


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID=ROOT)
class GravacaoServicesTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="adv@example.com", cargo="Administrador"
        )
        self.cliente = _cliente()
        self.reuniao = Reuniao.objects.create(titulo="Reuniao", cliente=self.cliente)

    @patch("meetings.services.drive_service")
    @patch("meetings.services.drive")
    def test_pasta_de_reuniao_com_cliente(self, mock_drive, _mock_service):
        mock_drive.ensure_folder.side_effect = _ensure_folder_fake

        pasta = services.pasta_gravacoes_reuniao(self.usuario, self.reuniao)

        self.assertEqual(pasta, "id-Reuniões")
        chamadas = [call.args[1] for call in mock_drive.ensure_folder.call_args_list]
        self.assertEqual(chamadas, ["Cliente", "Reuniões"])

    @patch("meetings.services.drive_service")
    @patch("meetings.services.drive")
    def test_pasta_de_reuniao_sem_cliente(self, mock_drive, _mock_service):
        mock_drive.ensure_folder.side_effect = _ensure_folder_fake
        reuniao = Reuniao.objects.create(titulo="Avulsa")

        pasta = services.pasta_gravacoes_reuniao(self.usuario, reuniao)

        self.assertEqual(pasta, "id-Reuniões avulsas")

    @patch("meetings.services.credentials_for_usuario")
    @patch("meetings.services.drive_service")
    @patch("meetings.services.drive")
    def test_criar_sessao_upload_retorna_url(
        self, mock_drive, _mock_service, _mock_credentials
    ):
        mock_drive.ensure_folder.side_effect = _ensure_folder_fake
        mock_drive.create_resumable_upload_session.return_value = "https://upload/x"

        sessao = services.criar_sessao_upload(
            self.usuario,
            self.reuniao,
            nome="reuniao.webm",
            mime_type="audio/webm",
            tamanho_bytes=1000,
        )

        self.assertEqual(sessao["upload_url"], "https://upload/x")
        self.assertEqual(sessao["pasta_id"], "id-Reuniões")

    @patch("meetings.services.drive_service")
    @patch("meetings.services.drive")
    def test_confirmar_upload_cria_gravacao(self, mock_drive, _mock_service):
        mock_drive.ensure_folder.side_effect = _ensure_folder_fake
        mock_drive.get_file.return_value = {
            "id": "file-1",
            "name": "reuniao.webm",
            "mimeType": "audio/webm",
            "size": "1000",
            "parents": ["id-Reuniões"],
        }

        gravacao = services.confirmar_upload(
            self.usuario,
            self.reuniao,
            drive_file_id="file-1",
            nome_original="reuniao.webm",
            mime_type="audio/webm",
        )

        self.assertEqual(gravacao.drive_file_id, "file-1")
        self.assertEqual(gravacao.enviada_por, self.usuario)
        self.assertEqual(gravacao.tamanho_bytes, 1000)
        self.assertEqual(gravacao.status, Gravacao.Status.ENVIADA)

    @patch("meetings.services.drive_service")
    @patch("meetings.services.drive")
    def test_confirmar_upload_rejeita_pasta_errada(self, mock_drive, _mock_service):
        mock_drive.ensure_folder.side_effect = _ensure_folder_fake
        mock_drive.get_file.return_value = {
            "id": "file-1",
            "size": "1000",
            "parents": ["outra-pasta"],
        }

        with self.assertRaises(ValueError):
            services.confirmar_upload(
                self.usuario,
                self.reuniao,
                drive_file_id="file-1",
                nome_original="reuniao.webm",
                mime_type="audio/webm",
            )
        self.assertFalse(Gravacao.objects.exists())

    @override_settings(MEETINGS_MAX_AUDIO_SIZE_MB=0)
    @patch("meetings.services.drive_service")
    @patch("meetings.services.drive")
    def test_confirmar_upload_rejeita_e_apaga_arquivo_grande(
        self, mock_drive, _mock_service
    ):
        mock_drive.ensure_folder.side_effect = _ensure_folder_fake
        mock_drive.get_file.return_value = {
            "id": "file-1",
            "size": "10",
            "parents": ["id-Reuniões"],
        }

        with self.assertRaises(ValueError):
            services.confirmar_upload(
                self.usuario,
                self.reuniao,
                drive_file_id="file-1",
                nome_original="reuniao.webm",
                mime_type="audio/webm",
            )
        mock_drive.delete_file.assert_called_once()
        self.assertFalse(Gravacao.objects.exists())

    @patch("meetings.services.drive_service")
    @patch("meetings.services.drive")
    def test_excluir_audio_drive_nao_propaga_falha(self, mock_drive, _mock_service):
        mock_drive.delete_file.side_effect = GoogleApiError("drive fora")
        gravacao = Gravacao.objects.create(
            reuniao=self.reuniao,
            drive_file_id="file-1",
            enviada_por=self.usuario,
            nome_original="reuniao.webm",
        )

        services.excluir_audio_drive(gravacao)  # must not raise

        mock_drive.delete_file.assert_called_once()


@override_settings(**PROCESSING_SETTINGS)
class GravacaoDriveViewsTests(TestCase):
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
        self.reuniao = Reuniao.objects.create(titulo="Reuniao", cliente=self.cliente)

    def _post_json(self, url_name, payload):
        return self.client.post(
            reverse(url_name, args=[self.reuniao.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

    @patch("meetings.views.services.criar_sessao_upload")
    def test_sessao_upload_retorna_url(self, mock_criar):
        mock_criar.return_value = {"upload_url": "https://upload/x", "pasta_id": "p1"}

        response = self._post_json(
            "criar_sessao_upload_gravacao",
            {
                "nome_arquivo": "reuniao.webm",
                "mime_type": "audio/webm",
                "tamanho_bytes": 1000,
            },
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["dados"]["upload_url"], "https://upload/x")

    def test_sessao_upload_rejeita_formato_invalido(self):
        response = self._post_json(
            "criar_sessao_upload_gravacao",
            {
                "nome_arquivo": "reuniao.txt",
                "mime_type": "text/plain",
                "tamanho_bytes": 1000,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("audio", response.json()["erros"])

    def test_sessao_upload_rejeita_tamanho_excedente(self):
        response = self._post_json(
            "criar_sessao_upload_gravacao",
            {
                "nome_arquivo": "reuniao.webm",
                "mime_type": "audio/webm",
                "tamanho_bytes": 26 * 1024 * 1024,
            },
        )

        self.assertEqual(response.status_code, 400)

    @patch("meetings.views.services.criar_sessao_upload")
    def test_sessao_upload_401_quando_google_desconectado(self, mock_criar):
        mock_criar.side_effect = GoogleAuthorizationRequired(
            "Conta Google nao conectada."
        )

        response = self._post_json(
            "criar_sessao_upload_gravacao",
            {
                "nome_arquivo": "reuniao.webm",
                "mime_type": "audio/webm",
                "tamanho_bytes": 1000,
            },
        )

        self.assertEqual(response.status_code, 401)

    @patch("meetings.views.processar_gravacao.delay")
    @patch("meetings.views.services.confirmar_upload")
    def test_confirmar_cria_gravacao_e_enfileira(self, mock_confirmar, mock_delay):
        gravacao = Gravacao.objects.create(
            reuniao=self.reuniao,
            drive_file_id="file-1",
            enviada_por=self.usuario,
            nome_original="reuniao.webm",
            mime_type="audio/webm",
            tamanho_bytes=1000,
        )
        mock_confirmar.return_value = gravacao

        response = self._post_json(
            "confirmar_gravacao",
            {
                "drive_file_id": "file-1",
                "nome_original": "reuniao.webm",
                "mime_type": "audio/webm",
            },
        )

        self.assertEqual(response.status_code, 202, response.json())
        self.assertEqual(
            response.json()["dados"]["gravacao"]["drive_file_id"], "file-1"
        )
        mock_delay.assert_called_once_with(gravacao.pk)

    def test_confirmar_exige_drive_file_id(self):
        response = self._post_json("confirmar_gravacao", {"drive_file_id": ""})

        self.assertEqual(response.status_code, 400)

    @patch("meetings.views.services.confirmar_upload")
    def test_confirmar_400_em_validacao(self, mock_confirmar):
        mock_confirmar.side_effect = ValueError("O arquivo enviado nao esta na pasta.")

        response = self._post_json(
            "confirmar_gravacao",
            {"drive_file_id": "file-1"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("audio", response.json()["erros"])

    @patch("meetings.views.services.excluir_audio_drive")
    def test_excluir_gravacao_drive_remove_arquivo(self, mock_excluir):
        gravacao = Gravacao.objects.create(
            reuniao=self.reuniao,
            drive_file_id="file-1",
            enviada_por=self.usuario,
            nome_original="reuniao.webm",
        )

        response = self.client.delete(reverse("excluir_gravacao", args=[gravacao.pk]))

        self.assertEqual(response.status_code, 200, response.json())
        mock_excluir.assert_called_once()
        self.assertFalse(Gravacao.objects.filter(pk=gravacao.pk).exists())


class GravacaoDriveTaskTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="adv@example.com", cargo="Administrador"
        )
        cliente = _cliente()
        reuniao = Reuniao.objects.create(titulo="Reuniao", cliente=cliente)
        self.gravacao = Gravacao.objects.create(
            reuniao=reuniao,
            drive_file_id="file-1",
            enviada_por=self.usuario,
            nome_original="reuniao.webm",
            mime_type="audio/webm",
            tamanho_bytes=1000,
        )

    @patch("meetings.tasks.summarize_transcript", return_value="Resumo")
    @patch("meetings.tasks.transcribe_audio", return_value="Transcricao")
    @patch("meetings.tasks.baixar_audio_drive", return_value=b"audio-bytes")
    def test_processa_gravacao_via_drive(self, _baixar, mock_transcribe, _summarize):
        from meetings.tasks import processar_gravacao

        processar_gravacao(self.gravacao.pk)

        self.gravacao.refresh_from_db()
        self.assertEqual(self.gravacao.status, Gravacao.Status.CONCLUIDA)
        self.assertEqual(self.gravacao.transcricao, "Transcricao")
        self.assertEqual(self.gravacao.resumo, "Resumo")
        self.assertEqual(mock_transcribe.call_args.kwargs["filename"], "reuniao.webm")

    @patch(
        "meetings.tasks.baixar_audio_drive",
        side_effect=GoogleAuthorizationRequired("desconectado"),
    )
    def test_google_desconectado_falha_com_mensagem(self, _baixar):
        from meetings.tasks import MENSAGEM_GOOGLE_DESCONECTADO, processar_gravacao

        with self.assertRaises(GoogleAuthorizationRequired):
            processar_gravacao(self.gravacao.pk)

        self.gravacao.refresh_from_db()
        self.assertEqual(self.gravacao.status, Gravacao.Status.FALHOU)
        self.assertEqual(self.gravacao.erro_processamento, MENSAGEM_GOOGLE_DESCONECTADO)

    @patch(
        "meetings.tasks.baixar_audio_drive",
        side_effect=GoogleApiError("drive instavel"),
    )
    def test_erro_drive_em_chamada_direta_marca_falha(self, _baixar):
        from meetings.tasks import processar_gravacao

        with self.assertRaises(GoogleApiError):
            processar_gravacao(self.gravacao.pk)

        self.gravacao.refresh_from_db()
        self.assertEqual(self.gravacao.status, Gravacao.Status.FALHOU)
