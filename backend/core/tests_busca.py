from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo


class BuscaGlobalTests(TestCase):
    def setUp(self):
        self.cliente = Cliente.objects.create(
            nome="Construtora Horizonte",
            email="contato@horizonte.example",
            telefone="11999999999",
            tipo_cliente="esporadico",
        )
        self.processo = Processo.objects.create(
            numero_processo="5001200-10.2026.8.21.0001",
            cliente=self.cliente,
            descricao="Cobrança Horizonte",
            vara="1a Vara",
            area_juridica="Civel",
            status="Ativo",
        )
        Prazo.objects.create(
            titulo="Contestação Horizonte",
            data_limite="2026-12-01",
            processo=self.processo,
            status="Pendente",
        )
        agora = timezone.now()
        Evento.objects.create(
            titulo="Audiência Horizonte",
            data_inicio=agora,
            data_fim=agora,
            tipo_evento="Audiencia",
            status="Agendado",
            prioridade="Alta",
            criado_por="teste",
            local="Forum",
        )
        Peticao.objects.create(cliente=self.cliente, adverso="Banco Horizonte")

    def login_superuser(self):
        user = get_user_model().objects.create_superuser(username="admin", password="x")
        self.client.force_login(user)

    def buscar(self, q):
        return self.client.get(reverse("busca_global"), {"q": q})

    def test_exige_autenticacao_e_get(self):
        self.assertEqual(self.buscar("horizonte").status_code, 401)
        self.login_superuser()
        self.assertEqual(self.client.post(reverse("busca_global")).status_code, 405)

    def test_devolve_um_grupo_por_tipo(self):
        self.login_superuser()

        grupos = self.buscar("horizonte").json()["dados"]["grupos"]

        self.assertEqual(
            set(grupos), {"clientes", "processos", "prazos", "eventos", "peticoes"}
        )
        self.assertEqual(grupos["clientes"][0]["titulo"], "Construtora Horizonte")
        self.assertEqual(grupos["processos"][0]["id"], str(self.processo.pk))
        self.assertEqual(grupos["peticoes"][0]["meta"], "Banco Horizonte")

    def test_termo_curto_nao_consulta(self):
        self.login_superuser()

        self.assertEqual(self.buscar("h").json()["dados"]["grupos"], {})
        self.assertEqual(self.buscar("  ").json()["dados"]["grupos"], {})

    def test_limita_resultados_por_grupo(self):
        self.login_superuser()
        Cliente.objects.bulk_create(
            Cliente(nome=f"Horizonte {i}", email=f"h{i}@x.example", telefone="1", tipo_cliente="esporadico")
            for i in range(10)
        )

        grupos = self.buscar("horizonte").json()["dados"]["grupos"]

        self.assertEqual(len(grupos["clientes"]), 4)

    def test_respeita_permissoes_por_tipo(self):
        user = get_user_model().objects.create_user(username="leitor", password="x")
        user.user_permissions.add(Permission.objects.get(codename="view_cliente"))
        self.client.force_login(user)

        grupos = self.buscar("horizonte").json()["dados"]["grupos"]

        self.assertEqual(set(grupos), {"clientes"})

    def test_acha_registros_fora_da_primeira_pagina_do_estado(self):
        self.login_superuser()
        Cliente.objects.bulk_create(
            Cliente(nome=f"Cliente {i:04d}", email=f"c{i}@x.example", telefone="1", tipo_cliente="esporadico")
            for i in range(300)
        )
        Cliente.objects.create(
            nome="Zeferino Raro", email="z@x.example", telefone="1", tipo_cliente="esporadico"
        )

        grupos = self.buscar("zeferino").json()["dados"]["grupos"]

        self.assertEqual([c["titulo"] for c in grupos["clientes"]], ["Zeferino Raro"])

    def test_eventos_do_tipo_prazo_nao_aparecem(self):
        self.login_superuser()
        agora = timezone.now()
        Evento.objects.create(
            titulo="Vencimento Horizonte",
            data_inicio=agora,
            data_fim=agora,
            tipo_evento="Prazo fatal",
            status="Agendado",
            prioridade="Alta",
            criado_por="teste",
            local="",
        )

        grupos = self.buscar("horizonte").json()["dados"]["grupos"]

        self.assertEqual([e["titulo"] for e in grupos["eventos"]], ["Audiência Horizonte"])
