import tempfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from clientes.models import Cliente
from meetings.models import Gravacao, Reuniao
from processos.models import Processo


class TemporaryMediaTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.media_directory = tempfile.TemporaryDirectory()
        cls.media_override = override_settings(MEDIA_ROOT=cls.media_directory.name)
        cls.media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls.media_override.disable()
        cls.media_directory.cleanup()
        super().tearDownClass()


class MeetingAPITests(TemporaryMediaTestCase):
    def setUp(self):
        user = get_user_model().objects.create_superuser(username="admin", password="secret")
        self.client.force_login(user)
        self.cliente = Cliente.objects.create(
            nome="Cliente",
            email="cliente@example.com",
            telefone="11999999999",
            cpf="12345678901",
        )
        self.processo = Processo.objects.create(
            numero_processo="0001",
            cliente=self.cliente,
            descricao="",
            vara="1a Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel="Advogada",
        )
        self.reuniao = Reuniao.objects.create(
            titulo="Reuniao inicial",
            cliente=self.cliente,
            processo=self.processo,
        )

    @patch("meetings.views.processar_gravacao.delay")
    def test_upload_enfileira_gravacao_sem_processar_na_request(self, delay):
        audio = SimpleUploadedFile("reuniao.webm", b"audio", content_type="audio/webm")

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("enviar_gravacao", args=[self.reuniao.pk]),
                {"audio": audio},
            )

        self.assertEqual(response.status_code, 202, response.json())
        gravacao = Gravacao.objects.get()
        self.assertEqual(gravacao.status, Gravacao.Status.ENVIADA)
        delay.assert_called_once_with(gravacao.pk)

    def test_rejeita_extensao_nao_suportada(self):
        audio = SimpleUploadedFile("reuniao.txt", b"audio", content_type="text/plain")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": audio},
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Gravacao.objects.exists())


class MeetingTaskTests(TemporaryMediaTestCase):
    def setUp(self):
        cliente = Cliente.objects.create(
            nome="Cliente",
            email="cliente@example.com",
            telefone="11999999999",
            cpf="12345678901",
        )
        reuniao = Reuniao.objects.create(titulo="Reuniao", cliente=cliente)
        self.gravacao = Gravacao.objects.create(
            reuniao=reuniao,
            arquivo_audio=SimpleUploadedFile("reuniao.webm", b"audio"),
            nome_original="reuniao.webm",
            mime_type="audio/webm",
        )

    @patch("meetings.tasks.summarize_transcript", return_value="Resumo")
    @patch("meetings.tasks.transcribe_recording", return_value="Transcricao")
    def test_processamento_persiste_transcricao_e_resumo(self, _transcribe, _summarize):
        from meetings.tasks import processar_gravacao

        processar_gravacao(self.gravacao.pk)

        self.gravacao.refresh_from_db()
        self.assertEqual(self.gravacao.status, Gravacao.Status.CONCLUIDA)
        self.assertEqual(self.gravacao.transcricao, "Transcricao")
        self.assertEqual(self.gravacao.resumo, "Resumo")
