"""Popula um banco local com dados 100% ficticios e cria uma sessao de desenvolvimento.

Serve para ver o app funcionando sem login Google, sem integracoes e sem dados
reais de cliente. Nada aqui roda em producao: o comando exige DEBUG=true e um
banco vazio.
"""

import datetime as dt

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.test import Client
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from financeiro.models import Lancamento
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo
from prospeccao.models import Prospect
from usuarios.models import Usuario

CLIENTES = [
    ("Marina Albuquerque", "mensalista", "", "Cliente desde 2024. Prefere contato por e-mail."),
    ("Construtora Horizonte Ltda", "mensalista", "Escritório Contábil Aurora", "Contrato de assessoria jurídica mensal."),
    ("Padaria Pão Dourado ME", "esporadico", "", ""),
    ("Carlos Eduardo Teixeira", "esporadico", "", "Indicação de cliente antigo."),
    ("Clínica Vida Plena", "mensalista", "Contabilidade Sul", "Assessoria trabalhista preventiva."),
    ("Transportes Rio Verde", "mensalista", "", ""),
    ("Beatriz Nogueira", "esporadico", "", ""),
    ("Agropecuária Campo Belo", "mensalista", "Escritório Contábil Aurora", "Demandas tributárias e contratos rurais."),
]

# (indice do cliente, descricao, vara, area, status, indice do responsavel)
PROCESSOS = [
    (0, "Ação de cobrança", "1ª Vara Cível de Santa Maria", "Cível", "Em andamento", 1),
    (1, "Rescisão contratual e perdas e danos", "2ª Vara Cível de Santa Maria", "Cível", "Em andamento", 0),
    (1, "Execução de título extrajudicial", "3ª Vara Cível de Santa Maria", "Empresarial", "Ativo", 0),
    (2, "Reclamação trabalhista (ex-funcionário)", "1ª Vara do Trabalho de Santa Maria", "Trabalhista", "Aguardando despacho", 1),
    (3, "Indenização por danos morais", "Juizado Especial Cível", "Cível", "Ativo", 2),
    (4, "Reclamação trabalhista — horas extras", "2ª Vara do Trabalho de Santa Maria", "Trabalhista", "Em andamento", 1),
    (5, "Mandado de segurança — ICMS", "Vara da Fazenda Pública", "Tributário", "Em andamento", 0),
    (6, "Divórcio consensual", "1ª Vara de Família", "Cível", "Concluído", 2),
    (7, "Anulação de auto de infração", "Vara da Fazenda Pública", "Tributário", "Ativo", 0),
    (7, "Revisão de contrato agrário", "2ª Vara Cível de Santa Maria", "Empresarial", "Aguardando despacho", 1),
]

# (titulo, dias a partir de hoje, status, prioridade, indice do processo)
PRAZOS = [
    ("Contestação — prazo final", 1, "Pendente", "Alta", 0),
    ("Recurso de apelação", 2, "Em andamento", "Alta", 1),
    ("Manifestação sobre laudo pericial", 3, "Em andamento", "Média", 5),
    ("Réplica à contestação", 5, "Pendente", "Média", 4),
    ("Embargos à execução", 6, "Protocolar", "Alta", 2),
    ("Juntada de documentos", 8, "Pendente", "Baixa", 3),
    ("Contrarrazões ao recurso", 9, "Em andamento", "Alta", 6),
    ("Cumprimento de sentença", 12, "Pendente", "Média", 8),
    ("Memoriais finais", 14, "Pendente", "Média", 9),
    ("Petição inicial protocolada", -6, "Protocolado", "Alta", 7),
    ("Recurso ordinário", -3, "Protocolado", "Alta", 5),
    ("Impugnação ao cálculo", 20, "Pendente", "Baixa", 1),
]

# (titulo, dias, hora inicio, hora fim, tipo, status, prioridade, indice do processo, local)
EVENTOS = [
    ("Reunião com cliente — estratégia", 1, 10, 11, "Reunião", "Agendado", "Média", 1, "Escritório (sala de reuniões)"),
    ("Audiência de instrução", 2, 9, 11, "Audiência", "Agendado", "Alta", 3, "Vara do Trabalho — Sala 1"),
    ("Reunião de acompanhamento", 3, 16, 17, "Reunião", "Confirmado", "Baixa", 5, "Videochamada"),
    ("Audiência una", 5, 13, 14, "Audiência", "Agendado", "Alta", 5, "Vara do Trabalho — Sala 2"),
    ("Reunião com a contabilidade parceira", 6, 15, 16, "Reunião", "Agendado", "Média", 1, "Escritório"),
    ("Audiência de justificação", 8, 10, 11, "Audiência", "Agendado", "Média", 4, "Juizado — Sala 4"),
    ("Reunião inicial — novo cliente", -2, 11, 12, "Reunião", "Compareceu", "Média", 6, "Escritório"),
]

# (tipo, adverso, status, indice do processo, indice do responsavel)
PETICOES = [
    ("Contestação", "Banco Exemplo S.A.", "Em andamento", 1, 1),
    ("Petição", "Comércio Alfa Ltda", "Pendente", 0, 0),
    ("Petição", "Indústria Beta S.A.", "Protocolar", 2, 0),
    ("Contestação", "Ex-funcionário", "Protocolado", 3, 1),
    ("Petição", "Estado — Fazenda", "Em andamento", 6, 0),
    ("Petição", "Seguradora Gama", "Pendente", 4, 2),
]

# (descricao, tipo, categoria, valor, dias, status, indice do cliente ou None)
LANCAMENTOS = [
    ("Honorários — contrato mensal", "receita", "Mensalidade", 4500, -150, "Pago", 1),
    ("Honorários — contrato mensal", "receita", "Mensalidade", 4500, -120, "Pago", 1),
    ("Honorários — contrato mensal", "receita", "Mensalidade", 4500, -90, "Pago", 1),
    ("Honorários — contrato mensal", "receita", "Mensalidade", 4500, -60, "Pago", 1),
    ("Honorários — contrato mensal", "receita", "Mensalidade", 4500, -30, "Pago", 1),
    ("Honorários — contrato mensal", "receita", "Mensalidade", 4500, 2, "Pendente", 1),
    ("Êxito — acordo trabalhista", "receita", "Êxito", 8200, -20, "Pago", 5),
    ("Consulta inicial", "receita", "Consulta", 350, -10, "Pago", 3),
    ("Honorários — assessoria preventiva", "receita", "Honorários", 2800, 10, "Pendente", 4),
    ("Acordo — cobrança", "receita", "Acordo", 5600, 18, "Pendente", 0),
    ("Custas processuais", "despesa", "Custas processuais", 640, -25, "Pago", None),
    ("Aluguel do escritório", "despesa", "Escritório", 2300, -28, "Pago", None),
    ("Software jurídico", "despesa", "Software", 390, -14, "Pago", None),
    ("Impostos do mês", "despesa", "Impostos", 1450, 6, "Pendente", None),
    ("Marketing digital", "despesa", "Marketing", 500, -45, "Pago", None),
]

# (nome, origem, demanda, status, prioridade, proxima acao)
PROSPECTS = [
    ("Fernanda Lima", "Indicação", "Direito de família", "Em contato", "Alta", "Enviar proposta de honorários"),
    ("Oficina Mecânica Torres", "Site", "Contrato de prestação de serviços", "Proposta enviada", "Media", "Cobrar retorno na sexta"),
    ("Ricardo Alves", "WhatsApp", "Ação trabalhista", "Aguardando retorno", "Media", "Aguardar documentos"),
    ("Mercado Bom Preço", "Redes sociais", "Consultoria tributária", "Em contato", "Baixa", "Agendar reunião"),
    ("Paulo Henrique Rocha", "Telefone", "Inventário", "Perdido", "Baixa", ""),
]


class Command(BaseCommand):
    help = (
        "Cria dados ficticios de demonstracao e uma sessao local de desenvolvimento "
        "(sem login Google). Exige DEBUG=true e um banco vazio."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo so roda com DEBUG=true (uso local).")
        if Usuario.objects.exists() or Cliente.objects.exists() or User.objects.exists():
            raise CommandError(
                "O banco nao esta vazio. Use um banco novo (por exemplo, "
                "DATABASE_URL=sqlite:///demo.db) para a demonstracao."
            )

        with transaction.atomic():
            usuarios = self._criar_dados()
            session_key = self._criar_sessao(usuarios[0])

        self.stdout.write(self.style.SUCCESS("Dados ficticios criados."))
        self.stdout.write(
            "Para entrar sem Google, defina o cookie abaixo no navegador "
            "(DevTools > Application > Cookies > localhost):\n"
            f"  sessionid = {session_key}"
        )

    def _criar_dados(self):
        hoje = timezone.localdate()
        agora = timezone.localtime()

        def dia(n):
            return hoje + dt.timedelta(days=n)

        def momento(n, hora):
            return timezone.make_aware(dt.datetime.combine(dia(n), dt.time(hora, 0)))

        usuarios = [
            Usuario.objects.create(nome="Helena Duarte", email="helena.duarte@exemplo.com.br", cargo="Administrador"),
            Usuario.objects.create(nome="Rafael Moura", email="rafael.moura@exemplo.com.br", cargo="Advogado"),
            Usuario.objects.create(nome="Júlia Prado", email="julia.prado@exemplo.com.br", cargo="Estagiário"),
        ]
        clientes = [
            Cliente.objects.create(
                nome=nome, email=f"contato{i + 1}@exemplo.com.br", telefone=f"(55) 99999-{1000 + i}",
                tipo_cliente=tipo, parceria=parceria, obs=obs,
            )
            for i, (nome, tipo, parceria, obs) in enumerate(CLIENTES)
        ]
        processos = [
            Processo.objects.create(
                numero_processo=f"500{1200 + i * 37:04d}-{10 + i}.2026.8.21.0001",
                cliente=clientes[ci], descricao=desc, vara=vara, area_juridica=area,
                status=status, advogado_responsavel=usuarios[resp],
            )
            for i, (ci, desc, vara, area, status, resp) in enumerate(PROCESSOS)
        ]
        for titulo, dias, status, prioridade, pi in PRAZOS:
            Prazo.objects.create(
                titulo=titulo, descricao="", data_limite=dia(dias), processo=processos[pi],
                responsavel=processos[pi].advogado_responsavel, status=status, prioridade=prioridade,
                concluido=(status == "Protocolado"), criado_por=usuarios[0].nome,
            )

        # Um compromisso "hoje", sempre no futuro proximo, para o painel nao nascer vazio.
        inicio_hoje = (agora + dt.timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
        Evento.objects.create(
            titulo="Audiência de conciliação", descricao="", data_inicio=inicio_hoje,
            data_fim=inicio_hoje + dt.timedelta(hours=1), tipo_evento="Audiência", status="Confirmado",
            prioridade="Alta", cliente=processos[0].cliente, processo=processos[0],
            responsavel=processos[0].advogado_responsavel, criado_por=usuarios[0].nome,
            local="Fórum de Santa Maria — Sala 3",
        )
        for titulo, dias, h1, h2, tipo, status, prioridade, pi, local in EVENTOS:
            Evento.objects.create(
                titulo=titulo, descricao="", data_inicio=momento(dias, h1), data_fim=momento(dias, h2),
                tipo_evento=tipo, status=status, prioridade=prioridade, cliente=processos[pi].cliente,
                processo=processos[pi], responsavel=processos[pi].advogado_responsavel,
                criado_por=usuarios[0].nome, local=local,
            )
        for tipo, adverso, status, pi, resp in PETICOES:
            Peticao.objects.create(
                cliente=processos[pi].cliente, processo=processos[pi], tipo=tipo, adverso=adverso,
                responsavel_acao=usuarios[resp].nome, status=status, criado_por=usuarios[0].nome,
            )
        for descricao, tipo, categoria, valor, dias, status, ci in LANCAMENTOS:
            Lancamento.objects.create(
                descricao=descricao, tipo=tipo, categoria=categoria, valor=valor,
                data_vencimento=dia(dias), data_pagamento=(dia(dias) if status == "Pago" else None),
                status=status, cliente_relacionado=(clientes[ci] if ci is not None else None),
            )
        for nome, origem, demanda, status, prioridade, proxima in PROSPECTS:
            Prospect.objects.create(
                nome=nome, telefone="(55) 98888-0000", email="", origem_contato=origem,
                tipo_demanda_juridica=demanda, status_prospeccao=status, prioridade=prioridade,
                proxima_acao=proxima, responsavel_interno=usuarios[1], data_ultimo_contato=dia(-3),
            )
        return usuarios

    def _criar_sessao(self, usuario):
        auth_user = User.objects.create_superuser(
            username="demo", email=usuario.email, password=None
        )
        auth_user.set_unusable_password()
        auth_user.save(update_fields=["password"])
        client = Client()
        client.force_login(auth_user)
        sessao = client.session
        sessao["usuario_id"] = usuario.pk
        sessao["usuario_nome"] = usuario.nome
        sessao["usuario_email"] = usuario.email
        sessao.save()
        return client.cookies["sessionid"].value
