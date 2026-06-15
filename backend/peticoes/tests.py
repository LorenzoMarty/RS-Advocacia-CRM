import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from clientes.models import Cliente
from peticoes.models import Peticao
from processos.models import Processo
from usuarios.models import Usuario


class PeticoesViewsTests(TestCase):
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
            numero_processo="1000000-00.2026.8.26.0000",
            cliente=self.cliente,
            descricao="Processo de teste",
            vara="1a Vara Civel",
            area_juridica="Civel",
            status="Ativo",
            advogado_responsavel=self.usuario.nome,
        )

    def payload(self):
        return {
            "cliente": self.cliente.pk,
            "processo": self.processo.pk,
            "tipo": Peticao.TIPO_CONTESTACAO,
            "adverso": "Empresa adversa",
            "responsavel_acao": self.usuario.nome,
            "link_drive": "https://drive.google.com/file/d/exemplo",
            "motivo_pendente": "Aguardando documentos",
            "status": Peticao.STATUS_PENDENTE,
        }

    def test_criar_peticao(self):
        response = self.client.post(
            reverse("criar_peticao"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Peticao.objects.count(), 1)
        self.assertEqual(
            response.json()["dados"]["peticao"]["adverso"], "Empresa adversa"
        )
        self.assertEqual(
            response.json()["dados"]["peticao"]["tipo"], Peticao.TIPO_CONTESTACAO
        )
        self.assertEqual(
            response.json()["dados"]["peticao"]["processo_id"], str(self.processo.pk)
        )

    def test_pendente_nao_exige_motivo(self):
        payload = self.payload()
        payload["motivo_pendente"] = ""

        response = self.client.post(
            reverse("criar_peticao"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Peticao.objects.count(), 1)
        self.assertEqual(Peticao.objects.get().status, Peticao.STATUS_PENDENTE)

    def test_peticao_pode_voltar_para_pendente_sem_motivo(self):
        peticao = Peticao.objects.create(
            cliente=self.cliente,
            processo=self.processo,
            adverso="Empresa adversa",
            responsavel_acao=self.usuario.nome,
            status=Peticao.STATUS_PROTOCOLADO,
        )
        payload = self.payload()
        payload["motivo_pendente"] = ""
        payload["status"] = Peticao.STATUS_PENDENTE

        response = self.client.put(
            reverse("editar_peticao", args=[peticao.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        peticao.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(peticao.status, Peticao.STATUS_PENDENTE)
        self.assertEqual(peticao.motivo_pendente, "")

    def _peticao(self, **overrides):
        defaults = {
            "cliente": self.cliente,
            "processo": self.processo,
            "tipo": Peticao.TIPO_CONTESTACAO,
            "adverso": "Empresa adversa",
            "responsavel_acao": self.usuario.nome,
            "status": Peticao.STATUS_PENDENTE,
        }
        defaults.update(overrides)
        return Peticao.objects.create(**defaults)

    @patch("peticoes.views.documentos_services")
    def test_documento_peticao_cria_doc_em_branco(self, mock_services):
        peticao = self._peticao()
        mock_services.pasta_peticoes_processo.return_value = "pasta-peticoes"
        mock_services.criar_documento_branco.return_value = {
            "id": "doc-1",
            "webViewLink": "https://docs.google.com/doc-1",
        }

        response = self.client.post(reverse("documento_peticao", args=[peticao.pk]))

        self.assertEqual(response.status_code, 201, response.json())
        mock_services.criar_documento_branco.assert_called_once()
        _, kwargs = mock_services.criar_documento_branco.call_args
        self.assertEqual(kwargs["parent_id"], "pasta-peticoes")
        self.assertEqual(kwargs["nome"], "Contestação - Empresa adversa")
        peticao.refresh_from_db()
        self.assertEqual(peticao.drive_file_id, "doc-1")
        self.assertEqual(peticao.link_drive, "https://docs.google.com/doc-1")

    @patch("peticoes.views.documentos_services")
    def test_documento_peticao_remove_e_apaga_no_drive(self, mock_services):
        peticao = self._peticao(
            drive_file_id="doc-1", link_drive="https://docs.google.com/doc-1"
        )

        response = self.client.delete(
            reverse("documento_peticao", args=[peticao.pk]) + "?apagar=1"
        )

        self.assertEqual(response.status_code, 200, response.json())
        mock_services.excluir_arquivo.assert_called_once_with(self.usuario, "doc-1")
        peticao.refresh_from_db()
        self.assertEqual(peticao.drive_file_id, "")
        self.assertEqual(peticao.link_drive, "")

    @patch("peticoes.views.documentos_services")
    def test_documento_peticao_desvincula_sem_apagar(self, mock_services):
        peticao = self._peticao(
            drive_file_id="doc-1", link_drive="https://docs.google.com/doc-1"
        )

        response = self.client.delete(reverse("documento_peticao", args=[peticao.pk]))

        self.assertEqual(response.status_code, 200, response.json())
        mock_services.excluir_arquivo.assert_not_called()
        peticao.refresh_from_db()
        self.assertEqual(peticao.drive_file_id, "")

    def test_area_juridica_derivada_do_processo(self):
        peticao = self._peticao()
        response = self.client.get(reverse("detalhes_peticao", args=[peticao.pk]))
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(
            response.json()["dados"]["peticao"]["area_juridica"],
            self.processo.area_juridica,
        )

    def test_processo_obrigatorio_ao_criar(self):
        payload = self.payload()
        payload.pop("processo")
        response = self.client.post(
            reverse("criar_peticao"),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Peticao.objects.count(), 0)

    @patch("peticoes.views.documentos_services")
    def test_editar_move_doc_ao_trocar_processo(self, mock_services):
        peticao = self._peticao(
            drive_file_id="doc-1", link_drive="https://docs.google.com/doc-1"
        )
        outro_processo = Processo.objects.create(
            numero_processo="2000000-00.2026.8.26.0000",
            cliente=self.cliente,
            descricao="Outro processo",
            vara="2a Vara Civel",
            area_juridica="Trabalhista",
            status="Ativo",
            advogado_responsavel=self.usuario.nome,
        )
        payload = self.payload()
        payload["processo"] = outro_processo.pk

        response = self.client.put(
            reverse("editar_peticao", args=[peticao.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        mock_services.mover_documento_peticao.assert_called_once()
        _, kwargs = mock_services.mover_documento_peticao.call_args
        self.assertEqual(kwargs["file_id"], "doc-1")
        self.assertEqual(kwargs["processo"], outro_processo)
