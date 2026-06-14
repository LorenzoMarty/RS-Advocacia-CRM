import random
from datetime import datetime, time, timedelta
from decimal import Decimal
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import login
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from financeiro.models import (
    STATUS_PAGO,
    STATUS_PENDENTE,
    TIPO_DESPESA,
    TIPO_RECEITA,
    Lancamento,
)
from meetings.models import Gravacao, Reuniao
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo
from productivity.models import ProductivityGoal, TimeEntry
from prospeccao.models import InteracaoProspect, Prospect
from usuarios.models import Usuario

DEMO_EMAIL = "renata@rsadvocacia.demo"


def demo_enabled() -> bool:
    return bool(getattr(settings, "DEMO_DATA_ENABLED", False))


def _demo_date(offset=0):
    return timezone.localdate() + timedelta(days=offset)


def _demo_datetime(offset, hour, minute=0):
    value = datetime.combine(_demo_date(offset), time(hour, minute))
    return timezone.make_aware(value, timezone.get_current_timezone())


def _ensure_usuario(nome, email, cargo_label):
    # Reusa o sistema de cargos real (usuarios.views): cria/sincroniza o auth user
    # e aplica o grupo/permissões corretos do cargo (Administrador=tudo,
    # Advogado/Estagiário=subconjunto). Evita escalonar privilégio. Import tardio
    # para não criar ciclo de import no carregamento do módulo.
    from usuarios.views import _sync_usuario_auth

    usuario, _ = Usuario.objects.update_or_create(
        email=email,
        defaults={"nome": nome, "cargo": cargo_label, "picture": ""},
    )
    auth_user = _sync_usuario_auth(usuario)
    return usuario, auth_user


def _ensure_clients():
    bruno, _ = Cliente.objects.update_or_create(
        email="bruno.lima@email.demo",
        defaults={
            "nome": "Bruno Lima",
            "telefone": "(11) 98888-1200",
            "cpf": "12345678909",
            "tipo_cliente": "mensalista",
            "obs": "Cliente com acompanhamento ativo em demanda cível e prazos fatais nesta semana.",
        },
    )
    almeida, _ = Cliente.objects.update_or_create(
        email="juridico@almeidacomercio.demo",
        defaults={
            "nome": "Almeida Comercio LTDA",
            "telefone": "(11) 3777-4400",
            "cpf": "12345678000190",
            "tipo_cliente": "mensalista",
            "obs": "Contrato mensal para consultivo empresarial e contencioso trabalhista.",
        },
    )
    ana, _ = Cliente.objects.update_or_create(
        email="ana.ribeiro@email.demo",
        defaults={
            "nome": "Ana Ribeiro",
            "telefone": "(21) 97777-8844",
            "cpf": "98765432100",
            "tipo_cliente": "esporadico",
            "obs": "Atendimento pontual em ação indenizatória.",
        },
    )
    return bruno, almeida, ana


def _ensure_processes(clients):
    bruno, almeida, ana = clients
    processo_bruno, _ = Processo.objects.update_or_create(
        numero_processo="1000002-20.2026.8.26.0100",
        defaults={
            "cliente": bruno,
            "descricao": "Ação de obrigação de fazer com pedido de tutela de urgência.",
            "vara": "12ª Vara Cível de São Paulo",
            "area_juridica": "Civel",
            "status": "Em andamento",
            "advogado_responsavel": "Mariana Souza",
        },
    )
    processo_almeida, _ = Processo.objects.update_or_create(
        numero_processo="0002451-77.2026.5.02.0031",
        defaults={
            "cliente": almeida,
            "descricao": "Reclamação trabalhista com audiência inicial designada.",
            "vara": "31ª Vara do Trabalho de São Paulo",
            "area_juridica": "Trabalhista",
            "status": "Aguardando despacho",
            "advogado_responsavel": "Renata Sampaio",
        },
    )
    processo_ana, _ = Processo.objects.update_or_create(
        numero_processo="0801123-45.2026.8.19.0001",
        defaults={
            "cliente": ana,
            "descricao": "Ação indenizatória por danos materiais e morais.",
            "vara": "5ª Vara Cível do Rio de Janeiro",
            "area_juridica": "Civel",
            "status": "Ativo",
            "advogado_responsavel": "Mariana Souza",
        },
    )
    return processo_bruno, processo_almeida, processo_ana


def _ensure_events(processes, usuarios_por_nome):
    # Evento.responsavel é FK para Usuario (padronizado por id); usar a instância.
    processo_bruno, processo_almeida, processo_ana = processes
    Evento.objects.update_or_create(
        titulo="Audiência de conciliação",
        processo=processo_bruno,
        defaults={
            "descricao": "Audiência virtual. Conferir documentos e proposta antes do horário.",
            "data_inicio": _demo_datetime(0, 9, 30),
            "data_fim": _demo_datetime(0, 10, 30),
            "tipo_evento": "Audiencia",
            "status": "Agendado",
            "prioridade": "Alta",
            "cliente": processo_bruno.cliente,
            "responsavel": usuarios_por_nome.get("Mariana Souza"),
            "criado_por": "Renata Sampaio",
            "local": "Videoconferência",
            "observacoes": "Enviar link ao cliente 30 minutos antes.",
            "lembrete_em": _demo_datetime(0, 9, 0),
            "concluido": False,
        },
    )
    Evento.objects.update_or_create(
        titulo="Reunião de alinhamento trabalhista",
        processo=processo_almeida,
        defaults={
            "descricao": "Revisar documentos de jornada e estratégia para audiência.",
            "data_inicio": _demo_datetime(1, 14, 0),
            "data_fim": _demo_datetime(1, 15, 0),
            "tipo_evento": "Reuniao",
            "status": "Agendado",
            "prioridade": "Media",
            "cliente": processo_almeida.cliente,
            "responsavel": usuarios_por_nome.get("Renata Sampaio"),
            "criado_por": "Lorenzo dos Reis",
            "local": "Escritorio",
            "observacoes": "Separar contrato social e controles de ponto.",
            "lembrete_em": _demo_datetime(1, 13, 30),
            "concluido": False,
        },
    )
    Evento.objects.update_or_create(
        titulo="Conferir documentos do cliente",
        processo=processo_ana,
        defaults={
            "descricao": "Checklist de provas antes do protocolo.",
            "data_inicio": _demo_datetime(0, 16, 0),
            "data_fim": _demo_datetime(0, 16, 30),
            "tipo_evento": "Tarefa interna",
            "status": "Pendente",
            "prioridade": "Media",
            "cliente": processo_ana.cliente,
            "responsavel": usuarios_por_nome.get("Lorenzo dos Reis"),
            "criado_por": "Mariana Souza",
            "local": "",
            "observacoes": "Validar notas fiscais e comprovantes.",
            "lembrete_em": None,
            "concluido": False,
        },
    )


def _ensure_deadlines(processes):
    processo_bruno, processo_almeida, processo_ana = processes
    Prazo.objects.update_or_create(
        titulo="1000002-20.2026.8.26.0100 - Bruno Lima",
        processo=processo_bruno,
        defaults={
            "descricao": "Preparar contestação e documentos para protocolo.",
            "data_limite": _demo_date(0),
            "responsavel": "Mariana Souza",
            "status": "Pendente",
            "prioridade": "Alta",
            "observacoes": "Conferir procuração e comprovantes anexos.",
            "concluido": False,
            "tempo_decorrido_segundos": 2700,
            "timer_iniciado_em": None,
            "criado_por": "Renata Sampaio",
        },
    )
    Prazo.objects.update_or_create(
        titulo="0002451-77.2026.5.02.0031 - Almeida Comercio LTDA",
        processo=processo_almeida,
        defaults={
            "descricao": "Manifestação sobre documentos juntados pela parte reclamante.",
            "data_limite": _demo_date(1),
            "responsavel": "Renata Sampaio",
            "status": "Em andamento",
            "prioridade": "Alta",
            "observacoes": "Revisar holerites e controles de ponto.",
            "concluido": False,
            "tempo_decorrido_segundos": 5400,
            "timer_iniciado_em": None,
            "criado_por": "Lorenzo dos Reis",
        },
    )
    Prazo.objects.update_or_create(
        titulo="0801123-45.2026.8.19.0001 - Ana Ribeiro",
        processo=processo_ana,
        defaults={
            "descricao": "Protocolar petição inicial revisada.",
            "data_limite": _demo_date(7),
            "responsavel": "Mariana Souza",
            "status": "Protocolar",
            "prioridade": "Media",
            "observacoes": "Aguardar assinatura final.",
            "concluido": False,
            "tempo_decorrido_segundos": 0,
            "timer_iniciado_em": None,
            "criado_por": "Renata Sampaio",
        },
    )


def _ensure_petitions(clients, processes):
    bruno, almeida, ana = clients
    processo_bruno, processo_almeida, processo_ana = processes
    Peticao.objects.update_or_create(
        cliente=bruno,
        adverso="Companhia Alfa S/A",
        defaults={
            "processo": processo_bruno,
            "tipo": Peticao.TIPO_CONTESTACAO,
            "responsavel_acao": "Mariana Souza",
            "link_drive": "https://drive.google.com/",
            "motivo_pendente": "Aguardando confirmação de documentos complementares.",
            "area_juridica": "Civel",
            "status": Peticao.STATUS_PENDENTE,
            "criado_por": "Renata Sampaio",
        },
    )
    Peticao.objects.update_or_create(
        cliente=almeida,
        adverso="Joao Pereira",
        defaults={
            "processo": processo_almeida,
            "tipo": Peticao.TIPO_CONTESTACAO,
            "responsavel_acao": "Renata Sampaio",
            "link_drive": "https://drive.google.com/",
            "motivo_pendente": "",
            "area_juridica": "Trabalhista",
            "status": Peticao.STATUS_EM_ANDAMENTO,
            "criado_por": "Lorenzo dos Reis",
        },
    )
    Peticao.objects.update_or_create(
        cliente=ana,
        adverso="Beta Seguradora",
        defaults={
            "processo": processo_ana,
            "tipo": Peticao.TIPO_PETICAO,
            "responsavel_acao": "Mariana Souza",
            "link_drive": "",
            "motivo_pendente": "",
            "area_juridica": "Civel",
            "status": Peticao.STATUS_PROTOCOLAR,
            "criado_por": "Renata Sampaio",
        },
    )


def _ensure_meetings(clients):
    bruno, _almeida, _ana = clients
    resumo_concausas = "\n".join(
        [
            "## Resumo executivo",
            "Reunião formativa para alinhar estudo jurídico sobre concausas e nexo causal.",
            "",
            "## Participantes",
            "- Rose",
            "- Iruã",
            "- Equipe jurídica interna",
            "",
            "## Próximas ações",
            "- Solicitar anotações completas a Rose e Iruã.",
            "- Preparar resumo jurídico para a próxima aula.",
            "- Confirmar data do próximo encontro formativo.",
        ]
    )
    # Reunião concluída e já finalizada como documento na pasta "Reuniões" do
    # cliente (documento_* preenchidos = gate de exclusão de áudio satisfeito).
    reuniao, _ = Reuniao.objects.update_or_create(
        titulo="Estudo interno sobre concausas",
        defaults={
            "data_reuniao": _demo_datetime(0, 11, 0),
            "cliente": None,
            "criado_por": "Renata Sampaio",
            "resumo": resumo_concausas,
            "documento_drive_id": "demo-doc-concausas",
            "documento_link": "https://docs.google.com/document/d/demo-doc-concausas/view",
            "documento_gerado_em": _demo_datetime(0, 10, 25),
        },
    )
    Gravacao.objects.update_or_create(
        reuniao=reuniao,
        nome_original="reuniao-concausas-demo.webm",
        defaults={
            "ordem": 0,
            "arquivo_audio": "meetings/demo/reuniao-concausas-demo.webm",
            "mime_type": "audio/webm",
            "tamanho_bytes": 1843200,
            "status": Gravacao.Status.CONCLUIDA,
            "transcricao": (
                "Rose e Iruã comentaram as anotações sobre concausas preexistente, "
                "concomitante e superveniente. A equipe alinhou a necessidade de "
                "revisar enunciados e súmulas para consolidar o material de estudo."
            ),
            "resumo": resumo_concausas,
            "provedor": "demo",
            "modelo_transcricao": "Demo transcript",
            "modelo_resumo": "Demo summary",
            "erro_processamento": "",
            "processada_em": _demo_datetime(0, 10, 18),
        },
    )
    # Reunião com gravação ainda em processamento (sem documento gerado) — mostra
    # o estado "transcrevendo" na lista de reuniões.
    reuniao_bruno, _ = Reuniao.objects.update_or_create(
        titulo="Alinhamento de audiência - Bruno Lima",
        defaults={
            "data_reuniao": _demo_datetime(1, 15, 0),
            "cliente": bruno,
            "criado_por": "Mariana Souza",
            "resumo": "",
        },
    )
    Gravacao.objects.update_or_create(
        reuniao=reuniao_bruno,
        nome_original="alinhamento-bruno-demo.webm",
        defaults={
            "ordem": 0,
            "drive_file_id": "demo-audio-bruno",
            "mime_type": "audio/webm",
            "tamanho_bytes": 2457600,
            "status": Gravacao.Status.TRANSCRIBINDO,
            "transcricao": "",
            "resumo": "",
            "provedor": "demo",
            "erro_processamento": "",
        },
    )


def _ensure_prospects(usuarios_por_nome):
    mariana = usuarios_por_nome.get("Mariana Souza")
    renata = usuarios_por_nome.get("Renata Sampaio")
    carla, _ = Prospect.objects.update_or_create(
        email="carla.nogueira@email.demo",
        defaults={
            "nome": "Carla Nogueira",
            "telefone": "(11) 98123-4567",
            "origem_contato": "Indicação",
            "tipo_demanda_juridica": "Trabalhista",
            "descricao_caso": "Rescisão indireta com verbas atrasadas.",
            "responsavel_interno": mariana,
            "status_prospeccao": "Em contato",
            "prioridade": "Alta",
            "proxima_acao": "Enviar proposta de honorários",
            "data_ultimo_contato": _demo_date(0),
        },
    )
    InteracaoProspect.objects.update_or_create(
        prospect=carla,
        descricao="Primeiro contato. Cliente interessada.",
        defaults={
            "tipo": "ligacao",
            "data": _demo_datetime(0, 9, 0),
            "usuario": mariana,
        },
    )
    Prospect.objects.update_or_create(
        email="pedro.antunes@email.demo",
        defaults={
            "nome": "Pedro Antunes",
            "telefone": "(11) 97654-3210",
            "origem_contato": "Site",
            "tipo_demanda_juridica": "Cível",
            "descricao_caso": "Ação indenizatória por danos morais.",
            "responsavel_interno": renata,
            "status_prospeccao": "Novo",
            "prioridade": "Media",
            "proxima_acao": "Agendar reunião inicial",
        },
    )


def _ensure_finance(clients, processes):
    bruno, almeida, ana = clients
    processo_bruno, processo_almeida, processo_ana = processes
    Lancamento.objects.update_or_create(
        descricao="Honorários iniciais - Bruno Lima",
        defaults={
            "tipo": TIPO_RECEITA,
            "categoria": "Honorários",
            "valor": Decimal("3500.00"),
            "data_vencimento": _demo_date(7),
            "status": STATUS_PENDENTE,
            "cliente_relacionado": bruno,
            "caso_relacionado": processo_bruno,
        },
    )
    Lancamento.objects.update_or_create(
        descricao="Mensalidade - Almeida Comercio LTDA",
        defaults={
            "tipo": TIPO_RECEITA,
            "categoria": "Mensalidade",
            "valor": Decimal("2000.00"),
            "data_vencimento": _demo_date(-3),
            "data_pagamento": _demo_date(-3),
            "status": STATUS_PAGO,
            "cliente_relacionado": almeida,
            "caso_relacionado": processo_almeida,
        },
    )
    # Pendente e vencido -> aparece como "Atrasado" (status_exibicao).
    Lancamento.objects.update_or_create(
        descricao="Custas processuais - Ana Ribeiro",
        defaults={
            "tipo": TIPO_DESPESA,
            "categoria": "Custas processuais",
            "valor": Decimal("350.00"),
            "data_vencimento": _demo_date(-2),
            "status": STATUS_PENDENTE,
            "cliente_relacionado": ana,
            "caso_relacionado": processo_ana,
        },
    )
    Lancamento.objects.update_or_create(
        descricao="Assinatura sistema jurídico",
        defaults={
            "tipo": TIPO_DESPESA,
            "categoria": "Software",
            "valor": Decimal("240.00"),
            "data_vencimento": _demo_date(0),
            "data_pagamento": _demo_date(0),
            "status": STATUS_PAGO,
        },
    )


def _ensure_productivity(usuarios_por_nome):
    renata = usuarios_por_nome.get("Renata Sampaio")
    mariana = usuarios_por_nome.get("Mariana Souza")
    lorenzo = usuarios_por_nome.get("Lorenzo dos Reis")
    metas = (
        (renata, Decimal("6"), Decimal("30")),
        (mariana, Decimal("7"), Decimal("35")),
        (lorenzo, Decimal("5"), Decimal("25")),
    )
    for usuario, daily, weekly in metas:
        if usuario:
            ProductivityGoal.objects.update_or_create(
                user=usuario,
                defaults={"daily_hours": daily, "weekly_hours": weekly},
            )

    # task_id aponta para Prazo/Peticao reais para o nome da tarefa resolver na UI.
    prazo_bruno = Prazo.objects.filter(
        titulo="1000002-20.2026.8.26.0100 - Bruno Lima"
    ).first()
    prazo_ana = Prazo.objects.filter(
        titulo="0801123-45.2026.8.19.0001 - Ana Ribeiro"
    ).first()
    peticao_bruno = Peticao.objects.filter(adverso="Companhia Alfa S/A").first()

    entradas = []
    if mariana and prazo_bruno:
        entradas.append(
            (mariana, TimeEntry.TASK_PRAZO, str(prazo_bruno.pk),
             _demo_datetime(-1, 9, 0), _demo_datetime(-1, 11, 0), 7200)
        )
    if mariana and peticao_bruno:
        entradas.append(
            (mariana, TimeEntry.TASK_PETICAO, str(peticao_bruno.pk),
             _demo_datetime(-1, 14, 0), _demo_datetime(-1, 15, 30), 5400)
        )
    if lorenzo and prazo_ana:
        entradas.append(
            (lorenzo, TimeEntry.TASK_PRAZO, str(prazo_ana.pk),
             _demo_datetime(0, 10, 0), _demo_datetime(0, 11, 0), 3600)
        )
    for usuario, task_type, task_id, started, ended, total in entradas:
        TimeEntry.objects.update_or_create(
            user=usuario,
            task_type=task_type,
            task_id=task_id,
            started_at=started,
            defaults={
                "ended_at": ended,
                "total_seconds": total,
                "status": TimeEntry.STATUS_STOPPED,
            },
        )


def seed_demo_data():
    """Insere/atualiza todos os dados demo. Idempotente. NÃO checa a flag —
    use ensure_demo_data() para o caminho gated por DEMO_DATA_ENABLED, ou o
    management command `seed_demo` para inserir uma vez manualmente."""
    # Cria os cargos padrão (Administrador/Advogado/Estagiário) com as permissões
    # corretas antes de vincular os usuários demo.
    from usuarios.views import _ensure_default_cargos

    _ensure_default_cargos()

    demo_usuario, demo_auth_user = _ensure_usuario(
        "Renata Sampaio", DEMO_EMAIL, "Administrador"
    )
    mariana_usuario, _ = _ensure_usuario(
        "Mariana Souza", "mariana@rsadvocacia.demo", "Advogado"
    )
    lorenzo_usuario, _ = _ensure_usuario(
        "Lorenzo dos Reis", "lorenzo@rsadvocacia.demo", "Estagiário"
    )
    usuarios_por_nome = {
        "Renata Sampaio": demo_usuario,
        "Mariana Souza": mariana_usuario,
        "Lorenzo dos Reis": lorenzo_usuario,
    }

    clients = _ensure_clients()
    processes = _ensure_processes(clients)
    _ensure_events(processes, usuarios_por_nome)
    _ensure_deadlines(processes)
    _ensure_petitions(clients, processes)
    _ensure_meetings(clients)
    _ensure_prospects(usuarios_por_nome)
    _ensure_finance(clients, processes)
    _ensure_productivity(usuarios_por_nome)
    return demo_usuario, demo_auth_user


def ensure_demo_data():
    if not demo_enabled():
        return None, None
    return seed_demo_data()


def ensure_demo_session(request):
    demo_usuario, demo_auth_user = ensure_demo_data()
    if demo_usuario is None or demo_auth_user is None:
        return None

    login(request, demo_auth_user, backend="django.contrib.auth.backends.ModelBackend")
    request.session["usuario_id"] = demo_usuario.pk
    request.session["usuario_nome"] = demo_usuario.nome
    request.session["usuario_email"] = demo_usuario.email
    return demo_usuario


# --- Geração aditiva (apenas create(), nunca apaga/atualiza) -----------------
# Usada pelo command `seed_demo --bulk N` para "encher" o banco com registros
# demo novos e distintos, sem colidir nem mexer no que já existe.

_BULK_NOMES = [
    "Carlos", "Fernanda", "Rafael", "Juliana", "Bruno", "Patrícia", "Thiago",
    "Aline", "Marcelo", "Camila", "Eduardo", "Beatriz", "Rodrigo", "Larissa",
    "Gustavo", "Vanessa", "Felipe", "Tatiane", "André", "Priscila",
]
_BULK_SOBRENOMES = [
    "Oliveira", "Santos", "Souza", "Pereira", "Lima", "Carvalho", "Ferreira",
    "Almeida", "Costa", "Gomes", "Ribeiro", "Martins", "Rocha", "Barbosa",
]
_BULK_AREAS = ["Civel", "Trabalhista", "Tributário", "Empresarial", "Família", "Penal"]
_BULK_VARAS = [
    "1ª Vara Cível de São Paulo", "3ª Vara do Trabalho de Campinas",
    "2ª Vara da Fazenda Pública", "5ª Vara Cível do Rio de Janeiro",
    "4ª Vara de Família e Sucessões",
]
_BULK_TIPO_EVENTO = ["Audiencia", "Reuniao", "Tarefa interna", "Prazo"]
_BULK_PRIORIDADES = ["Alta", "Media", "Baixa"]
_BULK_ORIGENS = ["Indicação", "Site", "Instagram", "Google", "Cliente antigo"]
_BULK_DEMANDAS = ["Trabalhista", "Cível", "Consumidor", "Família", "Tributário"]
_BULK_CAT_RECEITA = ["Honorários", "Consulta", "Êxito", "Mensalidade", "Acordo"]
_BULK_CAT_DESPESA = ["Custas processuais", "Escritório", "Software", "Marketing"]


def bulk_demo_data(quantidade: int = 10) -> dict:
    """Insere `quantidade` lotes de dados demo NOVOS (cliente + processo + eventos
    + prazo + prospect + lançamento), via create() puro. Não toca em registros
    existentes nem usa update_or_create — seguro para rodar num banco já populado."""
    usuarios = list(Usuario.objects.all())
    criados = {
        "clientes": 0, "processos": 0, "eventos": 0,
        "prazos": 0, "prospects": 0, "lancamentos": 0,
    }

    for _ in range(max(0, quantidade)):
        suf = uuid4().hex[:6]
        nome = f"{random.choice(_BULK_NOMES)} {random.choice(_BULK_SOBRENOMES)}"
        responsavel = random.choice(usuarios) if usuarios else None
        resp_nome = responsavel.nome if responsavel else "Equipe RS"

        cliente = Cliente.objects.create(
            nome=nome,
            email=f"{suf}@demo.local",
            telefone=f"(11) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
            cpf=f"{random.randint(100, 999)}.{random.randint(100, 999)}."
            f"{random.randint(100, 999)}-{random.randint(10, 99)}",
            tipo_cliente=random.choice(["esporadico", "mensalista"]),
            obs="Cliente demo gerado em lote.",
        )
        criados["clientes"] += 1

        processo = Processo.objects.create(
            numero_processo=(
                f"{random.randint(1000000, 9999999)}-"
                f"{random.randint(10, 99)}.2026.8.26.{random.randint(1000, 9999)}"
            ),
            cliente=cliente,
            descricao="Processo demo gerado em lote.",
            vara=random.choice(_BULK_VARAS),
            area_juridica=random.choice(_BULK_AREAS),
            status=random.choice(["Em andamento", "Aguardando despacho", "Ativo"]),
            advogado_responsavel=resp_nome,
        )
        criados["processos"] += 1

        for _ev in range(random.randint(1, 3)):
            offset = random.randint(-5, 10)
            hora = random.randint(8, 17)
            Evento.objects.create(
                titulo=f"{random.choice(_BULK_TIPO_EVENTO)} - {nome}",
                descricao="Evento demo gerado em lote.",
                data_inicio=_demo_datetime(offset, hora, 0),
                data_fim=_demo_datetime(offset, hora + 1, 0),
                tipo_evento=random.choice(_BULK_TIPO_EVENTO),
                status=random.choice(["Agendado", "Pendente", "Confirmado"]),
                prioridade=random.choice(_BULK_PRIORIDADES),
                cliente=cliente,
                processo=processo,
                responsavel=responsavel,
                criado_por=resp_nome,
                local=random.choice(["Escritório", "Videoconferência", "Fórum", ""]),
                observacoes="",
                lembrete_em=None,
                concluido=random.choice([True, False]),
            )
            criados["eventos"] += 1

        Prazo.objects.create(
            titulo=f"{processo.numero_processo} - {nome}",
            descricao="Prazo demo gerado em lote.",
            data_limite=_demo_date(random.randint(-3, 14)),
            responsavel=resp_nome,
            status=random.choice(["Pendente", "Em andamento", "Protocolar"]),
            prioridade=random.choice(_BULK_PRIORIDADES),
            observacoes="",
            concluido=False,
            tempo_decorrido_segundos=random.choice([0, 1800, 3600, 5400]),
            timer_iniciado_em=None,
            criado_por=resp_nome,
            processo=processo,
        )
        criados["prazos"] += 1

        prospect_nome = f"{random.choice(_BULK_NOMES)} {random.choice(_BULK_SOBRENOMES)}"
        Prospect.objects.create(
            nome=prospect_nome,
            telefone=f"(11) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
            email=f"prospect.{suf}@demo.local",
            origem_contato=random.choice(_BULK_ORIGENS),
            tipo_demanda_juridica=random.choice(_BULK_DEMANDAS),
            descricao_caso="Prospect demo gerado em lote.",
            responsavel_interno=responsavel,
            status_prospeccao=random.choice(
                ["Novo", "Em contato", "Proposta enviada", "Aguardando retorno"]
            ),
            prioridade=random.choice(_BULK_PRIORIDADES),
            proxima_acao=random.choice(
                ["Ligar", "Enviar proposta", "Agendar reunião", "Aguardar retorno"]
            ),
            data_ultimo_contato=_demo_date(random.randint(-10, 0)),
        )
        criados["prospects"] += 1

        receita = random.choice([True, False])
        pago = random.choice([True, False])
        venc = _demo_date(random.randint(-10, 20))
        Lancamento.objects.create(
            descricao=(
                f"{'Honorários' if receita else 'Despesa'} - {nome}"
            ),
            tipo=TIPO_RECEITA if receita else TIPO_DESPESA,
            categoria=random.choice(
                _BULK_CAT_RECEITA if receita else _BULK_CAT_DESPESA
            ),
            valor=Decimal(random.randint(150, 8000)),
            data_vencimento=venc,
            data_pagamento=venc if pago else None,
            status=STATUS_PAGO if pago else STATUS_PENDENTE,
            cliente_relacionado=cliente,
            caso_relacionado=processo,
            observacoes="",
        )
        criados["lancamentos"] += 1

    return criados
