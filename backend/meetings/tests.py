import json
import tempfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from clientes.models import Cliente
from meetings.models import Gravacao, Reuniao


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
        self.reuniao = Reuniao.objects.create(
            titulo="Reuniao inicial",
            cliente=self.cliente,
        )

    @override_settings(
        OPENAI_API_KEY="test-key",
        CELERY_BROKER_URL="memory://",
        MEETINGS_PROCESSING_MODE="celery",
    )
    @patch("meetings.views.processar_gravacao.delay")
    def test_upload_enfileira_gravacao_sem_processar_na_request(self, delay):
        audio = SimpleUploadedFile("reuniao.webm", b"audio", content_type="audio/webm")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": audio},
        )

        self.assertEqual(response.status_code, 202, response.json())
        gravacao = Gravacao.objects.get()
        self.assertEqual(gravacao.status, Gravacao.Status.ENVIADA)
        delay.assert_called_once_with(gravacao.pk)

    @override_settings(
        OPENAI_API_KEY="test-key",
        CELERY_BROKER_URL="",
        MEETINGS_PROCESSING_MODE="inline",
    )
    @patch("meetings.views.processar_gravacao")
    def test_upload_processa_inline_sem_redis(self, processar):
        def concluir(gravacao_id):
            Gravacao.objects.filter(pk=gravacao_id).update(
                status=Gravacao.Status.CONCLUIDA,
                transcricao="Transcricao",
                resumo="Resumo",
            )

        processar.side_effect = concluir
        audio = SimpleUploadedFile("reuniao.webm", b"audio", content_type="audio/webm")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": audio},
        )

        gravacao = Gravacao.objects.get()
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(gravacao.status, Gravacao.Status.CONCLUIDA)
        self.assertEqual(response.json()["dados"]["gravacao"]["resumo"], "Resumo")
        processar.assert_called_once_with(gravacao.pk)

    @override_settings(
        OPENAI_API_KEY="test-key",
        CELERY_BROKER_URL="",
        MEETINGS_PROCESSING_MODE="inline",
    )
    @patch("meetings.views.processar_gravacao")
    def test_upload_aceita_primeiro_arquivo_mesmo_sem_campo_audio(self, processar):
        def concluir(gravacao_id):
            Gravacao.objects.filter(pk=gravacao_id).update(status=Gravacao.Status.CONCLUIDA)

        processar.side_effect = concluir
        audio = SimpleUploadedFile("reuniao.webm", b"audio", content_type="audio/webm")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"file": audio},
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Gravacao.objects.get().nome_original, "reuniao.webm")

    @override_settings(
        OPENAI_API_KEY="test-key",
        CELERY_BROKER_URL="",
        MEETINGS_PROCESSING_MODE="inline",
    )
    @patch("meetings.views.processar_gravacao")
    def test_upload_aceita_blob_sem_extensao_com_mime_audio(self, processar):
        def concluir(gravacao_id):
            Gravacao.objects.filter(pk=gravacao_id).update(status=Gravacao.Status.CONCLUIDA)

        processar.side_effect = concluir
        audio = SimpleUploadedFile("blob", b"audio", content_type="audio/webm")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": audio},
        )

        gravacao = Gravacao.objects.get()
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(gravacao.nome_original, "reuniao.webm")

    @override_settings(
        OPENAI_API_KEY="",
        CELERY_BROKER_URL="memory://",
        MEETINGS_PROCESSING_MODE="celery",
    )
    def test_upload_exige_openai_api_key(self):
        audio = SimpleUploadedFile("reuniao.webm", b"audio", content_type="audio/webm")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": audio},
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("openai", response.json()["erros"])
        self.assertFalse(Gravacao.objects.exists())

    @override_settings(
        OPENAI_API_KEY="test-key",
        CELERY_BROKER_URL="",
        MEETINGS_PROCESSING_MODE="celery",
    )
    def test_upload_exige_fila_configurada(self):
        audio = SimpleUploadedFile("reuniao.webm", b"audio", content_type="audio/webm")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": audio},
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("fila", response.json()["erros"])
        self.assertFalse(Gravacao.objects.exists())

    @override_settings(
        OPENAI_API_KEY="test-key",
        CELERY_BROKER_URL="redis://localhost:6379/0",
        MEETINGS_PROCESSING_MODE="celery",
    )
    @patch("meetings.views.processar_gravacao.delay", side_effect=RuntimeError("redis down"))
    def test_upload_falha_clara_quando_nao_consegue_enfileirar(self, _delay):
        audio = SimpleUploadedFile("reuniao.webm", b"audio", content_type="audio/webm")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": audio},
        )

        gravacao = Gravacao.objects.get()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(gravacao.status, Gravacao.Status.FALHOU)
        self.assertIn("fila", response.json()["erros"])

    @override_settings(
        OPENAI_API_KEY="test-key",
        CELERY_BROKER_URL="memory://",
        MEETINGS_PROCESSING_MODE="celery",
    )
    def test_rejeita_extensao_nao_suportada(self):
        audio = SimpleUploadedFile("reuniao.txt", b"audio", content_type="text/plain")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": audio},
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Gravacao.objects.exists())

    def test_edita_reuniao(self):
        response = self.client.put(
            reverse("editar_reuniao", args=[self.reuniao.pk]),
            data=json.dumps({
                "titulo": "Reuniao atualizada",
                "data_reuniao": None,
                "cliente": self.cliente.pk,
            }),
            content_type="application/json",
        )

        self.reuniao.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(self.reuniao.titulo, "Reuniao atualizada")
        self.assertNotIn("pauta", response.json()["dados"]["reuniao"])

    def test_exclui_reuniao_com_gravacoes(self):
        Gravacao.objects.create(
            reuniao=self.reuniao,
            arquivo_audio=SimpleUploadedFile("reuniao.webm", b"audio"),
            nome_original="reuniao.webm",
            mime_type="audio/webm",
        )

        response = self.client.delete(reverse("excluir_reuniao", args=[self.reuniao.pk]))

        self.assertEqual(response.status_code, 200, response.json())
        self.assertFalse(Reuniao.objects.filter(pk=self.reuniao.pk).exists())
        self.assertFalse(Gravacao.objects.exists())

    def test_edita_transcricao_gravacao(self):
        gravacao = Gravacao.objects.create(
            reuniao=self.reuniao,
            arquivo_audio=SimpleUploadedFile("reuniao.webm", b"audio"),
            nome_original="reuniao.webm",
            mime_type="audio/webm",
            transcricao="Transcricao original",
        )

        response = self.client.patch(
            reverse("editar_gravacao", args=[gravacao.pk]),
            data=json.dumps({"transcricao": "Transcricao revisada"}),
            content_type="application/json",
        )

        gravacao.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(gravacao.transcricao, "Transcricao revisada")
        self.assertEqual(response.json()["dados"]["gravacao"]["transcricao"], "Transcricao revisada")

    def test_exclui_gravacao(self):
        gravacao = Gravacao.objects.create(
            reuniao=self.reuniao,
            arquivo_audio=SimpleUploadedFile("reuniao.webm", b"audio"),
            nome_original="reuniao.webm",
            mime_type="audio/webm",
        )

        response = self.client.delete(reverse("excluir_gravacao", args=[gravacao.pk]))

        self.assertEqual(response.status_code, 200, response.json())
        self.assertFalse(Gravacao.objects.filter(pk=gravacao.pk).exists())


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
