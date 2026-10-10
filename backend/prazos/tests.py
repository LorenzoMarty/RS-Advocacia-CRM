import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from prazos.models import Prazo
from processos.models import Processo
from usuarios.models import Usuario


@override_settings(SECURE_SSL_REDIRECT=False)
class PrazosViewsTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada",
            email="advogada@example.com",
            cargo="Administrador",
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email,
            email=self.usuario.email,
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session["usuario_nome"] = self.usuario.nome
        session.save()
        self.cliente = Cliente.objects.create(
            nome="Cliente",
            email="cliente@example.com",
            telefone="11999999999",
            cpf="123.456.789-00",
            tipo_cliente="esporadico",
        )
        self.processo = Processo.objects.create(
            numero_processo="0001234-56.2026.8.26.0001",
            cliente=self.cliente,
            descricao="Processo",
            vara="1a Vara",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )

    def payload(self):
        return {
            "titulo": "0001234-56.2026.8.26.0001 - Advogada",
            "descricao": "Protocolar contestacao",
            "data_limite": "2026-06-23",
            "processo": self.processo.pk,
            "responsavel": self.usuario.pk,
            "status": "Pendente",
            "prioridade": "Alta",
            "observacoes": "",
            "concluido": False,
        }

    def test_criar_prazo_nao_cria_evento(self):
        response = self.client.post(
            reverse("criar_prazo"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Prazo.objects.count(), 1)
        self.assertEqual(Evento.objects.count(), 0)
        self.assertEqual(response.json()["dados"]["prazo"]["data_limite"], "2026-06-23")

    def test_criar_prazo_com_descricao_vazia(self):
        payload = self.payload()
        payload["descricao"] = ""

        response = self.client.post(
            reverse("criar_prazo"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Prazo.objects.get().descricao, "")

    def test_atualizar_timer_prazo(self):
        prazo = Prazo.objects.create(
            titulo="Prazo",
            descricao="Descricao",
            data_limite="2026-06-23",
            processo=self.processo,
            responsavel=self.usuario,
            status="Pendente",
            prioridade="Alta",
            criado_por=self.usuario.nome,
        )

        response = self.client.patch(
            reverse("atualizar_timer_prazo", args=[prazo.pk]),
            data=json.dumps(
                {"tempo_decorrido_segundos": 120, "timer_iniciado_em": None}
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        prazo.refresh_from_db()
        self.assertEqual(prazo.tempo_decorrido_segundos, 120)

    def test_iniciar_timer_prazo_move_para_em_andamento(self):
        prazo = self._prazo(status="Pendente")
        started_at = timezone.now().isoformat()

        response = self.client.patch(
            reverse("atualizar_timer_prazo", args=[prazo.pk]),
            data=json.dumps(
                {
                    "tempo_decorrido_segundos": 0,
                    "timer_iniciado_em": started_at,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        prazo.refresh_from_db()
        self.assertEqual(prazo.status, "Em andamento")
        self.assertIsNotNone(prazo.timer_iniciado_em)

    def test_timer_prazo_nunca_reduz_tempo_ja_acumulado(self):
        started_at = timezone.now() - timedelta(minutes=10)
        prazo = self._prazo(
            tempo_decorrido_segundos=300,
            timer_iniciado_em=started_at,
        )

        response = self.client.patch(
            reverse("atualizar_timer_prazo", args=[prazo.pk]),
            data=json.dumps(
                {
                    "tempo_decorrido_segundos": 120,
                    "timer_iniciado_em": None,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        prazo.refresh_from_db()
        self.assertGreaterEqual(prazo.tempo_decorrido_segundos, 600)
        self.assertIsNone(prazo.timer_iniciado_em)

    def test_prazo_pode_voltar_para_pendente(self):
        prazo = Prazo.objects.create(
            titulo="Prazo",
            descricao="Descricao",
            data_limite="2026-06-23",
            processo=self.processo,
            responsavel=self.usuario,
            status="Protocolado",
            prioridade="Alta",
            concluido=True,
            criado_por=self.usuario.nome,
        )
        payload = self.payload()
        payload["status"] = "Pendente"
        payload["concluido"] = False

        response = self.client.put(
            reverse("editar_prazo", args=[prazo.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        prazo.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(prazo.status, "Pendente")
        self.assertFalse(prazo.concluido)

    def _prazo(self, **overrides):
        defaults = {
            "titulo": "Protocolar contestacao",
            "descricao": "Descricao",
            "data_limite": "2026-06-23",
            "processo": self.processo,
            "responsavel": self.usuario,
            "status": "Pendente",
            "prioridade": "Alta",
            "criado_por": self.usuario.nome,
        }
        defaults.update(overrides)
        return Prazo.objects.create(**defaults)

    @patch("prazos.views.documentos_services")
    def test_documento_prazo_cria_doc_na_pasta_processo(self, mock_services):
        prazo = self._prazo()
        mock_services.pasta_processo_id.return_value = "pasta-processo"
        mock_services.criar_documento_branco.return_value = {
            "id": "doc-1",
            "webViewLink": "https://docs.google.com/doc-1",
        }

        response = self.client.post(reverse("documento_prazo", args=[prazo.pk]))

        self.assertEqual(response.status_code, 201, response.json())
        _, kwargs = mock_services.criar_documento_branco.call_args
        self.assertEqual(kwargs["parent_id"], "pasta-processo")
        self.assertEqual(kwargs["nome"], "Protocolar contestacao")
        prazo.refresh_from_db()
        self.assertEqual(prazo.drive_file_id, "doc-1")
        self.assertEqual(prazo.link_drive, "https://docs.google.com/doc-1")

    @patch("prazos.views.documentos_services")
    def test_upload_documento_prazo_preenche_slot(self, mock_services):
        prazo = self._prazo()
        mock_services.pasta_processo_id.return_value = "pasta-processo"
        mock_services.upload_para_pasta.return_value = {
            "id": "file-1",
            "webViewLink": "https://drive.google.com/file-1",
        }
        arquivo = SimpleUploadedFile(
            "peca.pdf", b"%PDF-1.4 conteudo", content_type="application/pdf"
        )

        response = self.client.post(
            reverse("upload_documento_prazo", args=[prazo.pk]),
            data={"arquivo": arquivo},
        )

        self.assertEqual(response.status_code, 201, response.json())
        mock_services.upload_para_pasta.assert_called_once()
        prazo.refresh_from_db()
        self.assertEqual(prazo.drive_file_id, "file-1")
        self.assertEqual(prazo.link_drive, "https://drive.google.com/file-1")

    @patch("prazos.views.documentos_services")
    def test_upload_documento_prazo_rejeita_formato(self, mock_services):
        prazo = self._prazo()
        arquivo = SimpleUploadedFile(
            "malware.exe", b"binario", content_type="application/octet-stream"
        )

        response = self.client.post(
            reverse("upload_documento_prazo", args=[prazo.pk]),
            data={"arquivo": arquivo},
        )

        self.assertEqual(response.status_code, 400, response.json())
        mock_services.upload_para_pasta.assert_not_called()

    @patch("prazos.views.documentos_services")
    def test_documento_prazo_remove_e_apaga(self, mock_services):
        prazo = self._prazo(
            drive_file_id="doc-1", link_drive="https://docs.google.com/doc-1"
        )

        response = self.client.delete(
            reverse("documento_prazo", args=[prazo.pk]) + "?apagar=1"
        )

        self.assertEqual(response.status_code, 200, response.json())
        mock_services.excluir_arquivo.assert_called_once_with(self.usuario, "doc-1")
        prazo.refresh_from_db()
        self.assertEqual(prazo.drive_file_id, "")
        self.assertEqual(prazo.link_drive, "")


class AtualizarTimerServiceTests(TestCase):
    def setUp(self):
        cliente = Cliente.objects.create(
            nome="C", email="c@example.com", telefone="1", cpf="1", tipo_cliente="esporadico"
        )
        processo = Processo.objects.create(
            numero_processo="1", cliente=cliente, descricao="d", vara="v",
            area_juridica="a", status="Ativo",
        )
        self.prazo = Prazo.objects.create(
            titulo="P", data_limite="2026-06-23", processo=processo, status="Pendente"
        )

    def test_start_moves_pending_to_em_andamento(self):
        from prazos import services

        services.atualizar_timer(
            self.prazo, {"timer_iniciado_em": "2026-06-23T10:00:00+00:00"}
        )
        self.prazo.refresh_from_db()
        self.assertEqual(self.prazo.status, "Em andamento")

    def test_start_does_not_touch_concluded_prazo(self):
        from prazos import services

        self.prazo.concluido = True
        self.prazo.save()
        services.atualizar_timer(
            self.prazo, {"timer_iniciado_em": "2026-06-23T10:00:00+00:00"}
        )
        self.prazo.refresh_from_db()
        self.assertEqual(self.prazo.status, "Pendente")

    def test_invalid_input_raises_and_saves_nothing(self):
        from prazos import services

        for payload, campo in [
            ({"tempo_decorrido_segundos": "abc"}, "tempo_decorrido_segundos"),
            ({"tempo_decorrido_segundos": -1}, "tempo_decorrido_segundos"),
            ({"timer_iniciado_em": "nope"}, "timer_iniciado_em"),
            ({"timer_iniciado_em": 123}, "timer_iniciado_em"),
        ]:
            with self.subTest(payload=payload):
                with self.assertRaises(services.TimerInvalido) as ctx:
                    services.atualizar_timer(self.prazo, payload)
                self.assertEqual(ctx.exception.campo, campo)
        self.prazo.refresh_from_db()
        self.assertEqual(self.prazo.tempo_decorrido_segundos, 0)
        self.assertEqual(self.prazo.status, "Pendente")

    def test_naive_timer_start_is_stored_timezone_aware(self):
        from prazos import services

        services.atualizar_timer(self.prazo, {"timer_iniciado_em": "2026-06-23T10:00:00"})
        self.assertTrue(timezone.is_aware(self.prazo.timer_iniciado_em))
        self.assertGreater(services.segundos_decorridos(self.prazo), 0)

    def test_tempo_sozinho_com_timer_rodando_nao_conta_o_trecho_em_curso_duas_vezes(self):
        from prazos import services

        self.prazo.tempo_decorrido_segundos = 100
        self.prazo.timer_iniciado_em = timezone.now() - timedelta(seconds=60)
        self.prazo.save()

        services.atualizar_timer(self.prazo, {"tempo_decorrido_segundos": 0})
        self.prazo.refresh_from_db()
        self.assertEqual(self.prazo.tempo_decorrido_segundos, 100)
        self.assertAlmostEqual(services.segundos_decorridos(self.prazo), 160, delta=3)

    def test_tempo_sozinho_maior_que_o_atual_ajusta_o_total_com_timer_rodando(self):
        from prazos import services

        self.prazo.tempo_decorrido_segundos = 100
        self.prazo.timer_iniciado_em = timezone.now() - timedelta(seconds=60)
        self.prazo.save()

        services.atualizar_timer(self.prazo, {"tempo_decorrido_segundos": 200})
        self.prazo.refresh_from_db()
        self.assertAlmostEqual(self.prazo.tempo_decorrido_segundos, 140, delta=3)
        self.assertAlmostEqual(services.segundos_decorridos(self.prazo), 200, delta=3)

    def test_pausar_ainda_confirma_o_trecho_em_curso(self):
        from prazos import services

        self.prazo.tempo_decorrido_segundos = 100
        self.prazo.timer_iniciado_em = timezone.now() - timedelta(seconds=60)
        self.prazo.save()

        services.atualizar_timer(
            self.prazo, {"tempo_decorrido_segundos": 0, "timer_iniciado_em": None}
        )
        self.prazo.refresh_from_db()
        self.assertAlmostEqual(self.prazo.tempo_decorrido_segundos, 160, delta=3)
        self.assertIsNone(self.prazo.timer_iniciado_em)


    def test_parar_timer_so_com_timer_nulo_consolida_o_trecho_em_curso(self):
        from prazos import services

        self.prazo.tempo_decorrido_segundos = 100
        self.prazo.timer_iniciado_em = timezone.now() - timedelta(seconds=60)
        self.prazo.save()

        services.atualizar_timer(self.prazo, {"timer_iniciado_em": None})
        self.prazo.refresh_from_db()
        self.assertIsNone(self.prazo.timer_iniciado_em)
        self.assertAlmostEqual(self.prazo.tempo_decorrido_segundos, 160, delta=3)

    def test_reiniciar_timer_sem_tempo_consolida_o_trecho_anterior(self):
        from prazos import services

        self.prazo.tempo_decorrido_segundos = 100
        self.prazo.timer_iniciado_em = timezone.now() - timedelta(seconds=60)
        self.prazo.save()

        novo_inicio = timezone.now().isoformat()
        services.atualizar_timer(self.prazo, {"timer_iniciado_em": novo_inicio})
        self.prazo.refresh_from_db()
        self.assertAlmostEqual(self.prazo.tempo_decorrido_segundos, 160, delta=3)
        self.assertIsNotNone(self.prazo.timer_iniciado_em)

    def test_reenviar_o_mesmo_inicio_nao_consolida_nem_conta_em_dobro(self):
        from prazos import services

        inicio = timezone.now() - timedelta(seconds=60)
        self.prazo.tempo_decorrido_segundos = 100
        self.prazo.timer_iniciado_em = inicio
        self.prazo.save()

        services.atualizar_timer(self.prazo, {"timer_iniciado_em": inicio.isoformat()})
        self.prazo.refresh_from_db()
        self.assertEqual(self.prazo.tempo_decorrido_segundos, 100)
        self.assertAlmostEqual(services.segundos_decorridos(self.prazo), 160, delta=3)

    def test_iniciar_timer_parado_nao_altera_o_acumulado(self):
        from prazos import services

        self.prazo.tempo_decorrido_segundos = 100
        self.prazo.save()
        services.atualizar_timer(
            self.prazo, {"timer_iniciado_em": timezone.now().isoformat()}
        )
        self.prazo.refresh_from_db()
        self.assertEqual(self.prazo.tempo_decorrido_segundos, 100)
