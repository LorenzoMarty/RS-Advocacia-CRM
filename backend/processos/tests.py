import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse

from clientes.models import Cliente
from documentos.models import RenomeacaoPastaPendente
from processos.forms import ProcessoForm
from processos.models import Processo
from usuarios.models import Usuario


def _payload_valido(cliente, responsavel):
    return {
        "numero_processo": "0001234-55.2024.8.26.0100",
        "cliente": cliente.pk,
        "descricao": "Ação de cobrança",
        "vara": "1ª Vara Cível",
        "area_juridica": "Cível",
        "status": "Ativo",
        "advogado_responsavel": responsavel.pk,
    }


class ProcessoFormTests(TestCase):
    def setUp(self):
        self.cliente = Cliente.objects.create(
            nome="Cliente Teste",
            cpf="12345678901",
            tipo_cliente="esporadico",
            telefone="11999999999",
            email="cliente@example.com",
            obs="",
        )
        self.usuario = Usuario.objects.create(
            nome="Dra. Ana", email="ana@example.com", cargo="Advogado"
        )

    def test_form_valido(self):
        form = ProcessoForm(_payload_valido(self.cliente, self.usuario))
        self.assertTrue(form.is_valid(), form.errors)

    def test_form_rejeita_responsavel_inexistente(self):
        payload = _payload_valido(self.cliente, self.usuario)
        payload["advogado_responsavel"] = self.usuario.pk + 1000
        form = ProcessoForm(payload)
        self.assertFalse(form.is_valid())
        self.assertIn("advogado_responsavel", form.errors)

    def test_form_exige_numero_processo(self):
        payload = _payload_valido(self.cliente, self.usuario)
        payload["numero_processo"] = ""
        form = ProcessoForm(payload)
        self.assertFalse(form.is_valid())
        self.assertIn("numero_processo", form.errors)


class ProcessoApiTests(TestCase):
    def setUp(self):
        self.cliente = Cliente.objects.create(
            nome="Cliente API",
            cpf="98765432100",
            tipo_cliente="mensalista",
            telefone="11888888888",
            email="api@example.com",
            obs="",
        )
        self.usuario = Usuario.objects.create(
            nome="Dra. Ana", email="ana@example.com", cargo="Advogado"
        )
        self.user = get_user_model().objects.create_user(
            username="proc-user", password="secret123"
        )

    def _grant(self, *codenames):
        for codename in codenames:
            self.user.user_permissions.add(
                Permission.objects.get(
                    content_type__app_label="processos", codename=codename
                )
            )

    def test_listar_exige_autenticacao(self):
        self.assertEqual(self.client.get(reverse("listar_processos")).status_code, 401)

    def test_listar_403_sem_permissao(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse("listar_processos")).status_code, 403)

    def test_criar_com_permissao(self):
        self._grant("add_processo")
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("criar_processo"),
            data=json.dumps(_payload_valido(self.cliente, self.usuario)),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        payload = response.json()
        self.assertTrue(payload["sucesso"])
        self.assertEqual(Processo.objects.count(), 1)

    def test_criar_sem_permissao_403(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("criar_processo"),
            data=json.dumps(_payload_valido(self.cliente, self.usuario)),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_editar_atualiza_campo(self):
        self._grant("change_processo")
        processo = Processo.objects.create(
            numero_processo="0001",
            cliente=self.cliente,
            descricao="",
            vara="1ª Vara Cível",
            area_juridica="Cível",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )
        self.client.force_login(self.user)
        payload = _payload_valido(self.cliente, self.usuario)
        payload["status"] = "Concluído"
        response = self.client.put(
            reverse("editar_processo", args=[processo.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        processo.refresh_from_db()
        self.assertEqual(processo.status, "Concluído")

    def test_excluir_remove_registro(self):
        self._grant("delete_processo")
        processo = Processo.objects.create(
            numero_processo="0002",
            cliente=self.cliente,
            descricao="",
            vara="1ª Vara Cível",
            area_juridica="Cível",
            status="Ativo",
            advogado_responsavel=self.usuario,
        )
        self.client.force_login(self.user)
        response = self.client.delete(reverse("excluir_processo", args=[processo.pk]))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Processo.objects.count(), 0)

    def _processo(self, numero="0003", **extra):
        return Processo.objects.create(
            numero_processo=numero,
            cliente=self.cliente,
            descricao="",
            vara="1ª Vara Cível",
            area_juridica="Cível",
            status="Ativo",
            advogado_responsavel=self.usuario,
            **extra,
        )

    def test_listar_filtra_por_busca_e_serializa(self):
        self._grant("view_processo")
        alvo = self._processo("ALVO-1")
        self._processo("OUTRO-2")
        self.client.force_login(self.user)
        response = self.client.get(reverse("listar_processos"), {"q": "ALVO"})
        self.assertEqual(response.status_code, 200, response.content)
        dados = response.json()["dados"]
        self.assertEqual([p["id"] for p in dados["processos"]], [str(alvo.pk)])
        self.assertEqual(dados["processos"][0]["cliente_nome"], self.cliente.nome)
        self.assertEqual(dados["busca"], "ALVO")

    def test_detalhes_retorna_processo_ou_404(self):
        self._grant("view_processo")
        processo = self._processo()
        self.client.force_login(self.user)
        ok = self.client.get(reverse("detalhes_processo", args=[processo.pk]))
        self.assertEqual(ok.json()["dados"]["processo"]["numero_processo"], "0003")
        self.assertEqual(
            self.client.get(reverse("detalhes_processo", args=[99999])).status_code,
            404,
        )

    def test_metodo_errado_retorna_405(self):
        self._grant("view_processo")
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(reverse("listar_processos")).status_code, 405)

    def test_editar_registra_rename_pendente_e_sobrevive_a_falha_do_broker(self):
        self._grant("change_processo")
        processo = self._processo()
        self.client.force_login(self.user)
        payload = _payload_valido(self.cliente, self.usuario)
        payload["numero_processo"] = "0003-EDITADO"
        with patch(
            "documentos.tasks.aplicar_renomeacao.delay",
            side_effect=ConnectionError("broker down"),
        ) as delay, self.assertLogs("core.utils", level="ERROR"):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.put(
                    reverse("editar_processo", args=[processo.pk]),
                    data=json.dumps(payload),
                    content_type="application/json",
                )
        self.assertEqual(response.status_code, 200, response.content)
        delay.assert_called_once()
        processo.refresh_from_db()
        self.assertEqual(processo.numero_processo, "0003-EDITADO")
        # the intent survives for the periodic drain
        pendencia = RenomeacaoPastaPendente.objects.get()
        self.assertEqual(
            (pendencia.tipo, pendencia.objeto_id),
            (RenomeacaoPastaPendente.TIPO_PROCESSO, processo.pk),
        )

    def test_editar_sem_mudar_o_nome_da_pasta_nao_registra_rename(self):
        self._grant("change_processo")
        processo = self._processo()
        self.client.force_login(self.user)
        payload = _payload_valido(self.cliente, self.usuario)
        payload["numero_processo"] = processo.numero_processo
        payload["area_juridica"] = processo.area_juridica
        payload["status"] = "Concluído"
        response = self.client.put(
            reverse("editar_processo", args=[processo.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(RenomeacaoPastaPendente.objects.exists())

    def test_editar_e_excluir_geram_auditoria(self):
        from auditoria.models import RegistroAuditoria

        self._grant("change_processo", "delete_processo")
        processo = self._processo()
        self.client.force_login(self.user)
        payload = _payload_valido(self.cliente, self.usuario)
        payload["status"] = "Concluído"
        self.client.put(
            reverse("editar_processo", args=[processo.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.client.delete(reverse("excluir_processo", args=[processo.pk]))
        acoes = list(
            RegistroAuditoria.objects.filter(
                entidade_tipo=RegistroAuditoria.ENTIDADE_PROCESSO
            ).values_list("acao", flat=True)
        )
        self.assertIn(RegistroAuditoria.ACAO_ATUALIZADO, acoes)
        self.assertIn(RegistroAuditoria.ACAO_EXCLUIDO, acoes)
