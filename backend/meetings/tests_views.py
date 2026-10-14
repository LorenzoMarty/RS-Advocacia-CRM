"""Error branches, method guards and Drive-backed flows of ``meetings.views``."""

import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from ai.models import ConfiguracaoIA
from clientes.models import Cliente
from integrations.google.exceptions import GoogleApiError, GoogleAuthorizationRequired
from meetings.models import Gravacao, Reuniao
from meetings.tests import TemporaryMediaTestCase
from usuarios.models import Usuario


@override_settings(CELERY_BROKER_URL="memory://", MEETINGS_PROCESSING_MODE="celery")
class MeetingViewsBranchTests(TemporaryMediaTestCase):
    def setUp(self):
        user = get_user_model().objects.create_superuser(
            username="admin@example.com", email="admin@example.com", password="secret"
        )
        self.client.force_login(user)
        self.usuario = Usuario.objects.create(
            nome="Admin", email="admin@example.com", cargo="Administrador"
        )
        self.cliente = Cliente.objects.create(
            nome="Cliente",
            email="cliente@example.com",
            telefone="11999999999",
            cpf="12345678901",
        )
        self.reuniao = Reuniao.objects.create(titulo="Reuniao", cliente=self.cliente)
        config = ConfiguracaoIA()
        config.set_api_key("sk-test-key")
        config.save()

    def post_json(self, name, args, payload):
        return self.client.post(
            reverse(name, args=args),
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_metodo_nao_permitido_em_todas_as_rotas(self):
        gravacao = Gravacao.objects.create(reuniao=self.reuniao, nome_original="a.webm")
        casos = [
            ("post", "listar_reunioes", []),
            ("get", "criar_reuniao", []),
            ("get", "editar_reuniao", [self.reuniao.pk]),
            ("get", "excluir_reuniao", [self.reuniao.pk]),
            ("get", "finalizar_reuniao", [self.reuniao.pk]),
            ("post", "detalhes_reuniao", [self.reuniao.pk]),
            ("post", "detalhes_gravacao", [gravacao.pk]),
            ("get", "editar_gravacao", [gravacao.pk]),
            ("get", "excluir_gravacao", [gravacao.pk]),
            ("get", "enviar_gravacao", [self.reuniao.pk]),
            ("get", "criar_sessao_upload_gravacao", [self.reuniao.pk]),
            ("get", "confirmar_gravacao", [self.reuniao.pk]),
        ]
        for method, name, args in casos:
            response = getattr(self.client, method)(reverse(name, args=args))
            self.assertEqual(response.status_code, 405, name)

    def test_listar_e_detalhar_reunioes(self):
        lista = self.client.get(reverse("listar_reunioes"))
        detalhe = self.client.get(reverse("detalhes_reuniao", args=[self.reuniao.pk]))

        self.assertEqual(lista.json()["dados"]["paginacao"]["total"], 1)
        self.assertEqual(detalhe.json()["dados"]["reuniao"]["cliente_nome"], "Cliente")
        self.assertEqual(
            self.client.get(reverse("detalhes_reuniao", args=[999999])).status_code, 404
        )

    def test_serializa_transcricao_na_ordem_das_gravacoes(self):
        Gravacao.objects.create(reuniao=self.reuniao, ordem=1, transcricao="segunda")
        Gravacao.objects.create(reuniao=self.reuniao, ordem=0, transcricao="primeira")

        dados = self.client.get(
            reverse("detalhes_reuniao", args=[self.reuniao.pk])
        ).json()["dados"]["reuniao"]

        self.assertEqual(dados["transcricao"], "primeira\n\nsegunda")

    def test_criar_reuniao_aceita_aliases_e_valida_formulario(self):
        ok = self.post_json(
            "criar_reuniao",
            [],
            {
                "clientId": self.cliente.pk,
                "title": "Nova",
                "meetingAt": "2026-06-23T09:00:00-03:00",
            },
        )
        invalido = self.post_json("criar_reuniao", [], {})
        corpo_ruim = self.client.post(
            reverse("criar_reuniao"), data="[1]", content_type="application/json"
        )

        self.assertEqual(ok.status_code, 201, ok.json())
        self.assertEqual(ok.json()["dados"]["reuniao"]["titulo"], "Nova")
        self.assertEqual(invalido.status_code, 400)
        self.assertEqual(corpo_ruim.status_code, 400)

    def test_editar_reuniao_invalida_e_inexistente(self):
        url = reverse("editar_reuniao", args=[self.reuniao.pk])
        invalido = self.client.put(
            url, data=json.dumps({"titulo": ""}), content_type="application/json"
        )
        corpo_ruim = self.client.put(url, data="nao-json", content_type="application/json")
        inexistente = self.client.put(
            reverse("editar_reuniao", args=[999999]),
            data="{}",
            content_type="application/json",
        )

        self.assertEqual(invalido.status_code, 400)
        self.assertEqual(corpo_ruim.status_code, 400)
        self.assertEqual(inexistente.status_code, 404)

    @patch("meetings.views.services.excluir_audio_drive")
    def test_excluir_reuniao_apaga_audio_do_drive_e_tolera_falha_no_arquivo(
        self, excluir_drive
    ):
        gravacao = Gravacao.objects.create(
            reuniao=self.reuniao, drive_file_id="drive-1", nome_original="a.webm"
        )
        gravacao.arquivo_audio.save("a.webm", SimpleUploadedFile("a.webm", b"x"), save=True)

        with patch(
            "django.db.models.fields.files.FieldFile.delete", side_effect=OSError("boom")
        ):
            response = self.client.delete(
                reverse("excluir_reuniao", args=[self.reuniao.pk])
            )

        self.assertEqual(response.status_code, 200)
        excluir_drive.assert_called_once()
        self.assertFalse(Reuniao.objects.filter(pk=self.reuniao.pk).exists())
        self.assertEqual(
            self.client.delete(
                reverse("excluir_reuniao", args=[self.reuniao.pk])
            ).status_code,
            404,
        )

    def test_gravacao_detalhe_e_edicao(self):
        gravacao = Gravacao.objects.create(reuniao=self.reuniao, nome_original="a.webm")
        url_editar = reverse("editar_gravacao", args=[gravacao.pk])

        detalhe = self.client.get(reverse("detalhes_gravacao", args=[gravacao.pk]))
        sem_campos = self.client.patch(
            url_editar, data=json.dumps({"x": 1}), content_type="application/json"
        )
        resumo = self.client.patch(
            url_editar,
            data=json.dumps({"summary": "  novo  "}),
            content_type="application/json",
        )
        corpo_ruim = self.client.patch(url_editar, data="[", content_type="application/json")

        self.assertEqual(detalhe.status_code, 200)
        self.assertEqual(sem_campos.status_code, 400)
        self.assertEqual(corpo_ruim.status_code, 400)
        gravacao.refresh_from_db()
        self.assertEqual(resumo.status_code, 200)
        self.assertEqual(gravacao.resumo, "novo")
        self.assertEqual(
            self.client.get(reverse("detalhes_gravacao", args=[999999])).status_code, 404
        )

    @patch("meetings.views.services.finalizar_reuniao")
    def test_finalizar_reuniao_sucesso_e_erros(self, finalizar):
        url = reverse("finalizar_reuniao", args=[self.reuniao.pk])

        finalizar.return_value = {"audios_apagados": 2}
        ok = self.client.post(url)
        finalizar.side_effect = ValueError("Sem gravações concluídas.")
        valor = self.client.post(url)
        finalizar.side_effect = GoogleAuthorizationRequired("reconectar")
        google = self.client.post(url)

        self.assertEqual(ok.status_code, 200, ok.json())
        self.assertIn("2 áudio(s)", ok.json()["mensagem"])
        self.assertEqual(valor.status_code, 400)
        self.assertEqual(google.status_code, 401)
        self.assertEqual(
            self.client.post(reverse("finalizar_reuniao", args=[999999])).status_code, 404
        )

    def test_rotas_com_drive_sem_usuario_de_dominio_retornam_401(self):
        Usuario.objects.all().delete()

        finalizar = self.client.post(reverse("finalizar_reuniao", args=[self.reuniao.pk]))
        sessao = self.post_json(
            "criar_sessao_upload_gravacao",
            [self.reuniao.pk],
            {"nome_arquivo": "a.webm", "mime_type": "audio/webm", "tamanho_bytes": 10},
        )
        confirmar = self.post_json(
            "confirmar_gravacao", [self.reuniao.pk], {"drive_file_id": "x"}
        )

        self.assertEqual(finalizar.status_code, 401)
        self.assertEqual(sessao.status_code, 401)
        self.assertEqual(confirmar.status_code, 401)

    def test_upload_sem_arquivo_e_arquivo_grande_demais(self):
        url = reverse("enviar_gravacao", args=[self.reuniao.pk])
        sem_arquivo = self.client.post(url)
        with override_settings(MEETINGS_MAX_AUDIO_SIZE_MB=0):
            grande = self.client.post(
                url,
                {"audio": SimpleUploadedFile("a.webm", b"x", content_type="audio/webm")},
            )

        self.assertEqual(sem_arquivo.status_code, 400)
        self.assertIn("Envie um arquivo", sem_arquivo.json()["erros"]["audio"][0])
        self.assertEqual(grande.status_code, 400)
        self.assertIn("no máximo", grande.json()["erros"]["audio"][0])
        self.assertFalse(Gravacao.objects.exists())

    @patch("meetings.views.processar_gravacao")
    @override_settings(CELERY_BROKER_URL="", MEETINGS_PROCESSING_MODE="inline")
    def test_upload_inline_que_falha_devolve_502(self, processar):
        processar.side_effect = RuntimeError("openai fora do ar")

        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": SimpleUploadedFile("a.webm", b"x", content_type="audio/webm")},
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn("openai fora do ar", response.json()["erros"]["erro"][0])

    @override_settings(MEETINGS_PROCESSING_MODE="invalido")
    def test_modo_de_processamento_invalido_retorna_503(self):
        response = self.client.post(reverse("enviar_gravacao", args=[self.reuniao.pk]))

        self.assertEqual(response.status_code, 503)
        self.assertIn("processamento", response.json()["erros"])

    @patch("meetings.views.processar_gravacao.delay", side_effect=ConnectionError("redis"))
    def test_falha_de_fila_marca_gravacao_como_falhou(self, _delay):
        response = self.client.post(
            reverse("enviar_gravacao", args=[self.reuniao.pk]),
            {"audio": SimpleUploadedFile("a.webm", b"x", content_type="audio/webm")},
        )

        self.assertEqual(response.status_code, 503)
        gravacao = Gravacao.objects.get()
        self.assertEqual(gravacao.status, Gravacao.Status.FALHOU)
        self.assertIn("redis", gravacao.erro_processamento)

    @patch("meetings.views.services.criar_sessao_upload")
    def test_sessao_upload_valida_declaracao_e_trata_erro_do_google(self, criar):
        args = [self.reuniao.pk]
        invalido = self.post_json(
            "criar_sessao_upload_gravacao",
            args,
            {
                "nome_arquivo": "a.exe",
                "mime_type": "application/x-msdownload",
                "tamanho_bytes": "abc",
            },
        )
        valido = {"nome_arquivo": "a.webm", "mime_type": "audio/webm", "tamanho_bytes": 10}
        criar.return_value = {"upload_url": "https://drive.example/u"}
        ok = self.post_json("criar_sessao_upload_gravacao", args, valido)
        criar.side_effect = GoogleApiError("503")
        google = self.post_json("criar_sessao_upload_gravacao", args, valido)

        self.assertEqual(invalido.status_code, 400)
        self.assertEqual(ok.status_code, 200, ok.json())
        self.assertEqual(ok.json()["dados"]["upload_url"], "https://drive.example/u")
        self.assertEqual(google.status_code, 502)

    @patch("meetings.views.processar_gravacao.delay")
    @patch("meetings.views.services.confirmar_upload")
    def test_confirmar_gravacao_enfileira_e_trata_erros(self, confirmar, delay):
        args = [self.reuniao.pk]
        sem_id = self.post_json("confirmar_gravacao", args, {})
        gravacao = Gravacao.objects.create(reuniao=self.reuniao, nome_original="a.webm")
        confirmar.return_value = gravacao
        ok = self.post_json(
            "confirmar_gravacao", args, {"drive_file_id": "d1", "ordem": "-4"}
        )
        confirmar.side_effect = ValueError("Arquivo não encontrado no Drive.")
        valor = self.post_json("confirmar_gravacao", args, {"drive_file_id": "d1"})
        confirmar.side_effect = GoogleAuthorizationRequired("reconectar")
        google = self.post_json("confirmar_gravacao", args, {"drive_file_id": "d1"})

        self.assertEqual(sem_id.status_code, 400)
        self.assertEqual(ok.status_code, 202, ok.json())
        self.assertEqual(confirmar.call_args_list[0].kwargs["ordem"], 0)
        delay.assert_called_once_with(gravacao.pk)
        self.assertEqual(valor.status_code, 400)
        self.assertEqual(google.status_code, 401)
