import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse

from clientes.models import Cliente
from prospeccao.models import InteracaoProspect, Prospect
from usuarios.models import Usuario


class ProspeccaoViewsTests(TestCase):
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

    def payload(self):
        return {
            "nome": "Cliente Potencial",
            "telefone": "11999999999",
            "email": "potencial@example.com",
            "origem_contato": "Indicação",
            "tipo_demanda_juridica": "Trabalhista",
            "descricao_caso": "Rescisão indireta",
            "responsavel_interno": self.usuario.pk,
            "status_prospeccao": "Em contato",
            "prioridade": "Alta",
            "proxima_acao": "Ligar amanhã",
            "observacoes": "",
        }

    def test_criar_prospect(self):
        response = self.client.post(
            reverse("criar_prospect"),
            data=json.dumps(self.payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(Prospect.objects.count(), 1)
        dados = response.json()["dados"]["prospect"]
        self.assertEqual(dados["status_prospeccao"], "Em contato")
        self.assertEqual(dados["responsavel_nome"], "Advogada")

    def test_editar_prospect_muda_status(self):
        prospect = Prospect.objects.create(
            nome="Lead",
            status_prospeccao="Novo",
            prioridade="Media",
            responsavel_interno=self.usuario,
        )
        payload = self.payload()
        payload["status_prospeccao"] = "Em contato"

        response = self.client.put(
            reverse("editar_prospect", args=[prospect.pk]),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        prospect.refresh_from_db()
        self.assertEqual(prospect.status_prospeccao, "Em contato")

    def test_criar_interacao_atualiza_ultimo_contato(self):
        prospect = Prospect.objects.create(
            nome="Lead",
            status_prospeccao="Novo",
            prioridade="Media",
            responsavel_interno=self.usuario,
        )

        response = self.client.post(
            reverse("criar_interacao", args=[prospect.pk]),
            data=json.dumps({"tipo": "ligacao", "descricao": "Primeiro contato"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(InteracaoProspect.objects.count(), 1)
        prospect.refresh_from_db()
        self.assertIsNotNone(prospect.data_ultimo_contato)

    def test_converter_cria_cliente(self):
        prospect = Prospect.objects.create(
            nome="Lead Convert",
            email="lead@example.com",
            telefone="11988887777",
            status_prospeccao="Proposta enviada",
            prioridade="Alta",
            responsavel_interno=self.usuario,
        )

        response = self.client.post(
            reverse("converter_prospect", args=[prospect.pk]),
            data=json.dumps({"cpf": "52998224725", "tipo_cliente": "esporadico"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(Cliente.objects.count(), 1)
        prospect.refresh_from_db()
        self.assertIsNotNone(prospect.cliente_convertido_id)
        self.assertEqual(prospect.status_prospeccao, "Convertido")

    def test_converter_vincula_cliente_existente(self):
        cliente = Cliente.objects.create(
            nome="Existente",
            email="existente@example.com",
            telefone="11900000000",
            cpf="12345678901",
            tipo_cliente="esporadico",
        )
        prospect = Prospect.objects.create(
            nome="Lead Link",
            status_prospeccao="Proposta enviada",
            prioridade="Alta",
            responsavel_interno=self.usuario,
        )

        response = self.client.post(
            reverse("converter_prospect", args=[prospect.pk]),
            data=json.dumps({"cliente_id": cliente.pk}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(Cliente.objects.count(), 1)
        prospect.refresh_from_db()
        self.assertEqual(prospect.cliente_convertido_id, cliente.pk)

    def test_bloqueia_dupla_conversao(self):
        cliente = Cliente.objects.create(
            nome="Existente",
            email="existente@example.com",
            telefone="11900000000",
            cpf="12345678901",
            tipo_cliente="esporadico",
        )
        prospect = Prospect.objects.create(
            nome="Lead Done",
            status_prospeccao="Convertido",
            prioridade="Alta",
            responsavel_interno=self.usuario,
            cliente_convertido=cliente,
        )

        response = self.client.post(
            reverse("converter_prospect", args=[prospect.pk]),
            data=json.dumps({"cliente_id": cliente.pk}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409, response.json())


class ProspeccaoFluxoTests(TestCase):
    """Listagem, filtros, interações e casos de erro da conversão."""

    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Advogada", email="adv@example.com", cargo="Administrador"
        )
        self.outro = Usuario.objects.create(
            nome="Estagiario", email="est@example.com", cargo="Estagiário"
        )
        auth_user = get_user_model().objects.create_superuser(
            username=self.usuario.email, email=self.usuario.email
        )
        self.client.force_login(auth_user)
        session = self.client.session
        session["usuario_id"] = self.usuario.pk
        session.save()

    def _prospect(self, nome="Lead", **extra):
        dados = {
            "nome": nome,
            "status_prospeccao": "Em contato",
            "prioridade": "Media",
            "responsavel_interno": self.usuario,
        }
        dados.update(extra)
        return Prospect.objects.create(**dados)

    def _post(self, name, args, body):
        return self.client.post(
            reverse(name, args=args),
            data=json.dumps(body),
            content_type="application/json",
        )

    def test_listar_aplica_filtros_de_status_responsavel_e_busca(self):
        alvo = self._prospect(
            "Maria Silva", email="maria@x.com", status_prospeccao="Perdido"
        )
        joao = self._prospect("Joao", responsavel_interno=self.outro)
        pedro = self._prospect("Pedro", telefone="11955554444")

        def ids(**params):
            response = self.client.get(reverse("listar_prospects"), params)
            self.assertEqual(response.status_code, 200, response.content)
            return {p["id"] for p in response.json()["dados"]["prospects"]}

        self.assertEqual(ids(), {str(p.pk) for p in (alvo, joao, pedro)})
        self.assertEqual(ids(status="Perdido"), {str(alvo.pk)})
        self.assertEqual(ids(responsavel=self.outro.pk), {str(joao.pk)})
        self.assertEqual(ids(q="maria@"), {str(alvo.pk)})
        self.assertEqual(ids(q="5555"), {str(pedro.pk)})
        self.assertEqual(ids(q="inexistente"), set())

    def test_metodo_errado_retorna_405(self):
        prospect = self._prospect()
        casos = [
            ("post", reverse("listar_prospects")),
            ("get", reverse("criar_prospect")),
            ("post", reverse("detalhes_prospect", args=[prospect.pk])),
            ("get", reverse("editar_prospect", args=[prospect.pk])),
            ("get", reverse("excluir_prospect", args=[prospect.pk])),
            ("post", reverse("listar_interacoes", args=[prospect.pk])),
            ("get", reverse("criar_interacao", args=[prospect.pk])),
            ("get", reverse("converter_prospect", args=[prospect.pk])),
        ]
        for metodo, url in casos:
            with self.subTest(metodo=metodo, url=url):
                self.assertEqual(getattr(self.client, metodo)(url).status_code, 405)

    def test_detalhes_inclui_interacoes_e_404_para_inexistente(self):
        prospect = self._prospect()
        InteracaoProspect.objects.create(
            prospect=prospect, tipo="ligacao", descricao="oi", usuario=self.usuario
        )
        resposta = self.client.get(reverse("detalhes_prospect", args=[prospect.pk]))
        dados = resposta.json()["dados"]["prospect"]
        self.assertEqual(len(dados["interacoes"]), 1)
        self.assertEqual(dados["total_interacoes"], 1)
        inexistente = self.client.get(reverse("detalhes_prospect", args=[99999]))
        self.assertEqual(inexistente.status_code, 404)

    def test_criar_aceita_alias_responsavel_id_e_rejeita_invalido(self):
        body = {
            "nome": "Via alias",
            "telefone": "11999999999",
            "status_prospeccao": "Em contato",
            "prioridade": "Alta",
            "responsavel_id": self.outro.pk,
        }
        ok = self._post("criar_prospect", [], body)
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(
            ok.json()["dados"]["prospect"]["responsavel_nome"], "Estagiario"
        )

        invalido = self._post(
            "criar_prospect", [], {**body, "nome": "", "telefone": "123"}
        )
        self.assertEqual(invalido.status_code, 400)
        self.assertIn("telefone", invalido.json()["erros"])

        quebrado = self.client.post(
            reverse("criar_prospect"), data="nao-json", content_type="application/json"
        )
        self.assertEqual(quebrado.status_code, 400)

    def test_editar_erros_e_excluir(self):
        prospect = self._prospect()
        url = reverse("editar_prospect", args=[prospect.pk])
        invalido = self.client.put(
            url, data=json.dumps({"nome": ""}), content_type="application/json"
        )
        self.assertEqual(invalido.status_code, 400)
        quebrado = self.client.put(url, data="x", content_type="application/json")
        self.assertEqual(quebrado.status_code, 400)

        excluir_url = reverse("excluir_prospect", args=[prospect.pk])
        self.assertEqual(self.client.delete(excluir_url).status_code, 200)
        self.assertFalse(Prospect.objects.filter(pk=prospect.pk).exists())
        self.assertEqual(self.client.delete(excluir_url).status_code, 404)

    def test_listar_interacoes(self):
        prospect = self._prospect()
        InteracaoProspect.objects.create(
            prospect=prospect, tipo="email", descricao="a", usuario=self.usuario
        )
        response = self.client.get(reverse("listar_interacoes", args=[prospect.pk]))
        self.assertEqual(len(response.json()["dados"]["interacoes"]), 1)
        inexistente = self.client.get(reverse("listar_interacoes", args=[99999]))
        self.assertEqual(inexistente.status_code, 404)

    def test_criar_interacao_usa_usuario_atual_e_valida(self):
        prospect = self._prospect()
        ok = self._post(
            "criar_interacao", [prospect.pk], {"tipo": "whatsapp", "descricao": "msg"}
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(InteracaoProspect.objects.get().usuario_id, self.usuario.pk)

        explicito = self._post(
            "criar_interacao",
            [prospect.pk],
            {"tipo": "email", "descricao": "x", "usuario": self.outro.pk},
        )
        self.assertEqual(explicito.status_code, 201)
        self.assertEqual(
            InteracaoProspect.objects.latest("pk").usuario_id, self.outro.pk
        )

        invalido = self._post("criar_interacao", [prospect.pk], {"tipo": "telepatia"})
        self.assertEqual(invalido.status_code, 400)
        quebrado = self.client.post(
            reverse("criar_interacao", args=[prospect.pk]),
            data="x",
            content_type="application/json",
        )
        self.assertEqual(quebrado.status_code, 400)

    def test_converter_erros(self):
        prospect = self._prospect()
        url = reverse("converter_prospect", args=[prospect.pk])
        inexistente = self._post(
            "converter_prospect", [prospect.pk], {"cliente_id": 99999}
        )
        self.assertEqual(inexistente.status_code, 404)
        invalido = self._post("converter_prospect", [prospect.pk], {"cpf": "000"})
        self.assertEqual(invalido.status_code, 400)
        quebrado = self.client.post(url, data="x", content_type="application/json")
        self.assertEqual(quebrado.status_code, 400)
        prospect.refresh_from_db()
        self.assertIsNone(prospect.cliente_convertido_id)
        self.assertEqual(Cliente.objects.count(), 0)

    def test_converter_sem_permissao_de_criar_cliente_retorna_403(self):
        restrito = get_user_model().objects.create_user(
            username="restrito", password="x"
        )
        restrito.user_permissions.add(
            Permission.objects.get(codename="change_prospect")
        )
        self.client.force_login(restrito)
        prospect = self._prospect()
        response = self._post(
            "converter_prospect", [prospect.pk], {"cpf": "52998224725"}
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Cliente.objects.count(), 0)

        # vincular cliente existente não exige add_cliente
        cliente = Cliente.objects.create(
            nome="Existente",
            email="e@x.com",
            telefone="11900000000",
            cpf="12345678901",
            tipo_cliente="esporadico",
        )
        ok = self._post(
            "converter_prospect", [prospect.pk], {"cliente_id": cliente.pk}
        )
        self.assertEqual(ok.status_code, 200, ok.content)
