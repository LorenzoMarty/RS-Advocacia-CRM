import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from financeiro.models import Lancamento


class FinanceiroAdminViewsTests(TestCase):
    """Usuário com todas as permissões (superuser) — fluxo completo."""

    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username="admin@example.com",
            email="admin@example.com",
        )
        self.client.force_login(self.user)

    def payload(self, **overrides):
        data = {
            "descricao": "Honorários contrato X",
            "tipo": "receita",
            "categoria": "Honorários",
            "valor": "1500.00",
            "data_vencimento": "2026-06-30",
            "status": "Pendente",
            "observacoes": "",
        }
        data.update(overrides)
        return data

    def test_criar_lancamento(self):
        response = self.client.post(
            reverse("criar_lancamento"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Lancamento.objects.count(), 1)

    def test_valor_negativo_rejeitado(self):
        response = self.client.post(
            reverse("criar_lancamento"),
            data=json.dumps(self.payload(valor="-10.00")),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400, response.json())
        self.assertIn("valor", response.json()["erros"])

    def test_pago_sem_data_rejeitado(self):
        response = self.client.post(
            reverse("criar_lancamento"),
            data=json.dumps(self.payload(status="Pago")),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400, response.json())
        self.assertIn("data_pagamento", response.json()["erros"])

    def test_marcar_pago_exige_data(self):
        lancamento = Lancamento.objects.create(
            descricao="Consulta",
            tipo="receita",
            categoria="Consulta",
            valor="300.00",
            data_vencimento="2026-06-30",
            status="Pendente",
        )
        response = self.client.post(
            reverse("marcar_pago", args=[lancamento.pk]),
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400, response.json())

        response = self.client.post(
            reverse("marcar_pago", args=[lancamento.pk]),
            data=json.dumps({"data_pagamento": "2026-06-15"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.json())
        lancamento.refresh_from_db()
        self.assertEqual(lancamento.status, "Pago")

    def test_atraso_derivado(self):
        ontem = timezone.localdate() - timedelta(days=1)
        lancamento = Lancamento.objects.create(
            descricao="Atrasado",
            tipo="receita",
            categoria="Honorários",
            valor="500.00",
            data_vencimento=ontem,
            status="Pendente",
        )
        self.assertTrue(lancamento.atrasado)
        self.assertEqual(lancamento.status_exibicao, "Atrasado")

    def test_filtro_por_tipo(self):
        Lancamento.objects.create(
            descricao="Receita",
            tipo="receita",
            categoria="Honorários",
            valor="100.00",
            data_vencimento="2026-06-30",
            status="Pendente",
        )
        Lancamento.objects.create(
            descricao="Despesa",
            tipo="despesa",
            categoria="Software",
            valor="50.00",
            data_vencimento="2026-06-30",
            status="Pendente",
        )
        response = self.client.get(reverse("listar_lancamentos"), {"tipo": "despesa"})
        dados = response.json()["dados"]
        self.assertEqual(dados["total"], 1)
        self.assertEqual(dados["lancamentos"][0]["tipo"], "despesa")

    def test_paginacao_usa_contrato_offset_limit_compartilhado(self):
        for i in range(3):
            Lancamento.objects.create(
                descricao=f"Lancamento {i}",
                tipo="receita",
                categoria="Honorários",
                valor="10.00",
                data_vencimento="2026-06-30",
                status="Pendente",
            )
        response = self.client.get(
            reverse("listar_lancamentos"), {"limit": "2", "offset": "1"}
        )
        dados = response.json()["dados"]
        self.assertEqual(len(dados["lancamentos"]), 2)
        self.assertEqual(
            dados["paginacao"],
            {"offset": 1, "limit": 2, "total": 3, "tem_mais": False},
        )


class FinanceiroPermissaoTests(TestCase):
    """Usuário comum (sem permissões financeiro) → 403."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="comum@example.com",
            password="secret123",
        )
        # Concede permissões de outro app, mas nenhuma de financeiro.
        self.user.user_permissions.add(Permission.objects.get(codename="view_cliente"))
        self.client.force_login(self.user)

    def test_listar_negado(self):
        response = self.client.get(reverse("listar_lancamentos"))
        self.assertEqual(response.status_code, 403)

    def test_criar_negado(self):
        response = self.client.post(
            reverse("criar_lancamento"),
            data=json.dumps({"descricao": "x"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_dashboard_negado(self):
        response = self.client.get(reverse("dashboard_financeiro"))
        self.assertEqual(response.status_code, 403)

class FinanceiroFluxoTests(TestCase):
    """Ciclo de vida de um lançamento e o dashboard agregado."""

    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username="fin@example.com", email="fin@example.com"
        )
        self.client.force_login(self.user)
        self.hoje = timezone.localdate()

    def _lancamento(self, **extra):
        dados = {
            "descricao": "L",
            "tipo": "receita",
            "categoria": "Honorários",
            "valor": "100.00",
            "data_vencimento": self.hoje + timedelta(days=5),
            "status": "Pendente",
        }
        dados.update(extra)
        return Lancamento.objects.create(**dados)

    def _json(self, method, url, body=None):
        return getattr(self.client, method)(
            url, data=json.dumps(body or {}), content_type="application/json"
        )

    def test_marcar_pago_exige_data_e_grava(self):
        lanc = self._lancamento()
        url = reverse("marcar_pago", args=[lanc.pk])
        self.assertEqual(self._json("post", url, {}).status_code, 400)
        response = self._json("post", url, {"data_pagamento": str(self.hoje)})
        self.assertEqual(response.status_code, 200, response.content)
        lanc.refresh_from_db()
        self.assertEqual(lanc.status, "Pago")
        self.assertEqual(lanc.data_pagamento, self.hoje)

    def test_cancelar_limpa_data_pagamento(self):
        lanc = self._lancamento(status="Pago", data_pagamento=self.hoje)
        response = self._json("post", reverse("cancelar_lancamento", args=[lanc.pk]))
        self.assertEqual(response.status_code, 200, response.content)
        lanc.refresh_from_db()
        self.assertEqual(lanc.status, "Cancelado")
        self.assertIsNone(lanc.data_pagamento)

    def test_editar_detalhes_e_excluir(self):
        lanc = self._lancamento()
        detalhes = self.client.get(reverse("detalhes_lancamento", args=[lanc.pk]))
        self.assertEqual(detalhes.json()["dados"]["lancamento"]["id"], str(lanc.pk))

        body = {
            "descricao": "Editado",
            "tipo": "receita",
            "categoria": "Honorários",
            "valor": "250.00",
            "data_vencimento": str(self.hoje),
            "status": "Pendente",
        }
        editar = self._json("put", reverse("editar_lancamento", args=[lanc.pk]), body)
        self.assertEqual(editar.status_code, 200, editar.content)
        lanc.refresh_from_db()
        self.assertEqual(lanc.descricao, "Editado")

        excluir = self.client.delete(reverse("excluir_lancamento", args=[lanc.pk]))
        self.assertEqual(excluir.status_code, 200)
        self.assertFalse(Lancamento.objects.filter(pk=lanc.pk).exists())

    def test_dashboard_agrega_e_ignora_cancelados(self):
        self._lancamento(valor="100.00", status="Pago", data_pagamento=self.hoje)
        self._lancamento(valor="40.00", tipo="despesa", categoria="Custas",
                         status="Pago", data_pagamento=self.hoje)
        self._lancamento(valor="30.00", data_vencimento=self.hoje - timedelta(days=2))
        self._lancamento(valor="999.00", status="Cancelado")
        dados = self.client.get(reverse("dashboard_financeiro")).json()["dados"]
        self.assertEqual(dados["recebido_mes"], "100.00")
        self.assertEqual(dados["despesas_mes"], "40.00")
        self.assertEqual(dados["pendente"], "30.00")
        self.assertEqual(dados["atrasado"], "30.00")
        self.assertEqual(dados["saldo_estimado"], "90.00")
        self.assertEqual(dados["despesa_por_categoria"][0]["categoria"], "Custas")

    def test_categorias_e_metodo_errado(self):
        dados = self.client.get(reverse("categorias_financeiro")).json()["dados"]
        self.assertTrue(dados["receita"] and dados["despesa"])
        self.assertEqual(self.client.post(reverse("categorias_financeiro")).status_code, 405)
