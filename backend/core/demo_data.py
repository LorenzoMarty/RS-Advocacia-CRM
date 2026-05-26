from datetime import datetime, time, timedelta

from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import Group, Permission, User
from django.utils import timezone

from agenda.models import Evento
from clientes.models import Cliente
from meetings.models import Gravacao, Reuniao
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo
from usuarios.models import Usuario


DEMO_EMAIL = "renata@rsadvocacia.demo"


def demo_enabled() -> bool:
    return bool(getattr(settings, "DEMO_DATA_ENABLED", False))


def _demo_date(offset=0):
    return timezone.localdate() + timedelta(days=offset)


def _demo_datetime(offset, hour, minute=0):
    value = datetime.combine(_demo_date(offset), time(hour, minute))
    return timezone.make_aware(value, timezone.get_current_timezone())


def _ensure_group(name, permissions=None):
    group, _ = Group.objects.get_or_create(name=name)
    if permissions is None:
        permissions = Permission.objects.all()
    missing = permissions.exclude(pk__in=group.permissions.values_list("pk", flat=True))
    if missing.exists():
        group.permissions.add(*missing)
    return group


def _ensure_usuario(nome, email, cargo, group):
    usuario, _ = Usuario.objects.update_or_create(
        email=email,
        defaults={
            "nome": nome,
            "cargo": group.name if group else cargo,
            "picture": "",
        },
    )
    auth_user, created = User.objects.get_or_create(
        username=email,
        defaults={
            "email": email,
            "first_name": nome,
            "is_active": True,
        },
    )
    updates = []
    if auth_user.email != email:
        auth_user.email = email
        updates.append("email")
    if auth_user.first_name != nome:
        auth_user.first_name = nome
        updates.append("first_name")
    if not auth_user.is_active:
        auth_user.is_active = True
        updates.append("is_active")
    if created:
        auth_user.set_unusable_password()
        auth_user.save()
    elif updates:
        auth_user.save(update_fields=updates)
    if group:
        auth_user.groups.set([group])
    return usuario, auth_user


def _ensure_clients():
    bruno, _ = Cliente.objects.update_or_create(
        email="bruno.lima@email.demo",
        defaults={
            "nome": "Bruno Lima",
            "telefone": "(11) 98888-1200",
            "cpf": "12345678909",
            "tipo_cliente": "mensalista",
            "obs": "Cliente com acompanhamento ativo em demanda civel e prazos fatais nesta semana.",
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
            "obs": "Atendimento pontual em acao indenizatoria.",
        },
    )
    return bruno, almeida, ana


def _ensure_processes(clients):
    bruno, almeida, ana = clients
    processo_bruno, _ = Processo.objects.update_or_create(
        numero_processo="1000002-20.2026.8.26.0100",
        defaults={
            "cliente": bruno,
            "descricao": "Acao de obrigacao de fazer com pedido de tutela de urgencia.",
            "vara": "12a Vara Civel de Sao Paulo",
            "area_juridica": "Civel",
            "status": "Em andamento",
            "advogado_responsavel": "Mariana Souza",
        },
    )
    processo_almeida, _ = Processo.objects.update_or_create(
        numero_processo="0002451-77.2026.5.02.0031",
        defaults={
            "cliente": almeida,
            "descricao": "Reclamacao trabalhista com audiencia inicial designada.",
            "vara": "31a Vara do Trabalho de Sao Paulo",
            "area_juridica": "Trabalhista",
            "status": "Aguardando despacho",
            "advogado_responsavel": "Renata Sampaio",
        },
    )
    processo_ana, _ = Processo.objects.update_or_create(
        numero_processo="0801123-45.2026.8.19.0001",
        defaults={
            "cliente": ana,
            "descricao": "Acao indenizatoria por danos materiais e morais.",
            "vara": "5a Vara Civel do Rio de Janeiro",
            "area_juridica": "Civel",
            "status": "Ativo",
            "advogado_responsavel": "Mariana Souza",
        },
    )
    return processo_bruno, processo_almeida, processo_ana


def _ensure_events(processes):
    processo_bruno, processo_almeida, processo_ana = processes
    Evento.objects.update_or_create(
        titulo="Audiencia de conciliacao",
        processo=processo_bruno,
        defaults={
            "descricao": "Audiencia virtual. Conferir documentos e proposta antes do horario.",
            "data_inicio": _demo_datetime(0, 9, 30),
            "data_fim": _demo_datetime(0, 10, 30),
            "tipo_evento": "Audiencia",
            "status": "Agendado",
            "prioridade": "Alta",
            "cliente": processo_bruno.cliente,
            "responsavel": "Mariana Souza",
            "criado_por": "Renata Sampaio",
            "local": "Videoconferencia",
            "observacoes": "Enviar link ao cliente 30 minutos antes.",
            "lembrete_em": _demo_datetime(0, 9, 0),
            "concluido": False,
        },
    )
    Evento.objects.update_or_create(
        titulo="Reuniao de alinhamento trabalhista",
        processo=processo_almeida,
        defaults={
            "descricao": "Revisar documentos de jornada e estrategia para audiencia.",
            "data_inicio": _demo_datetime(1, 14, 0),
            "data_fim": _demo_datetime(1, 15, 0),
            "tipo_evento": "Reuniao",
            "status": "Agendado",
            "prioridade": "Media",
            "cliente": processo_almeida.cliente,
            "responsavel": "Renata Sampaio",
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
            "responsavel": "Lorenzo dos Reis",
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
            "descricao": "Preparar contestacao e documentos para protocolo.",
            "data_limite": _demo_date(0),
            "responsavel": "Mariana Souza",
            "status": "Pendente",
            "prioridade": "Alta",
            "observacoes": "Conferir procuracao e comprovantes anexos.",
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
            "descricao": "Manifestacao sobre documentos juntados pela parte reclamante.",
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
            "descricao": "Protocolar peticao inicial revisada.",
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


def _ensure_petitions(clients):
    bruno, almeida, ana = clients
    Peticao.objects.update_or_create(
        cliente=bruno,
        adverso="Companhia Alfa S/A",
        defaults={
            "tipo": Peticao.TIPO_CONTESTACAO,
            "responsavel_acao": "Mariana Souza",
            "link_drive": "https://drive.google.com/",
            "motivo_pendente": "Aguardando confirmacao de documentos complementares.",
            "area_juridica": "Civel",
            "status": Peticao.STATUS_PENDENTE,
            "criado_por": "Renata Sampaio",
        },
    )
    Peticao.objects.update_or_create(
        cliente=almeida,
        adverso="Joao Pereira",
        defaults={
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
    reuniao, _ = Reuniao.objects.update_or_create(
        titulo="Estudo interno sobre concausas",
        defaults={
            "data_reuniao": _demo_datetime(0, 11, 0),
            "cliente": None,
            "criado_por": "Renata Sampaio",
        },
    )
    Gravacao.objects.update_or_create(
        reuniao=reuniao,
        nome_original="reuniao-concausas-demo.webm",
        defaults={
            "arquivo_audio": "meetings/demo/reuniao-concausas-demo.webm",
            "mime_type": "audio/webm",
            "tamanho_bytes": 1843200,
            "status": Gravacao.Status.CONCLUIDA,
            "transcricao": (
                "Rose e Irua comentaram as anotacoes sobre concausas preexistente, "
                "concomitante e superveniente. A equipe alinhou a necessidade de "
                "revisar enunciados e sumulas para consolidar o material de estudo."
            ),
            "resumo": "\n".join(
                [
                    "## Resumo executivo",
                    "Reuniao formativa para alinhar estudo juridico sobre concausas e nexo causal.",
                    "",
                    "## Participantes",
                    "- Rose",
                    "- Irua",
                    "- Equipe juridica interna",
                    "",
                    "## Proximas acoes",
                    "- Solicitar anotacoes completas a Rose e Irua.",
                    "- Preparar resumo juridico para a proxima aula.",
                    "- Confirmar data do proximo encontro formativo.",
                ]
            ),
            "provedor": "demo",
            "modelo_transcricao": "Demo transcript",
            "modelo_resumo": "Demo summary",
            "erro_processamento": "",
            "processada_em": _demo_datetime(0, 10, 18),
        },
    )
    Reuniao.objects.update_or_create(
        titulo="Alinhamento de audiencia - Bruno Lima",
        defaults={
            "data_reuniao": _demo_datetime(1, 15, 0),
            "cliente": bruno,
            "criado_por": "Mariana Souza",
        },
    )


def ensure_demo_data():
    if not demo_enabled():
        return None, None

    admin_group = _ensure_group("Administrador")
    lawyer_group = _ensure_group("Advogado")
    assistant_group = _ensure_group("Assistente juridico")
    demo_usuario, demo_auth_user = _ensure_usuario(
        "Renata Sampaio",
        DEMO_EMAIL,
        "Administrador",
        admin_group,
    )
    _ensure_usuario("Mariana Souza", "mariana@rsadvocacia.demo", "Advogado", lawyer_group)
    _ensure_usuario(
        "Lorenzo dos Reis",
        "lorenzo@rsadvocacia.demo",
        "Assistente juridico",
        assistant_group,
    )

    clients = _ensure_clients()
    processes = _ensure_processes(clients)
    _ensure_events(processes)
    _ensure_deadlines(processes)
    _ensure_petitions(clients)
    _ensure_meetings(clients)
    return demo_usuario, demo_auth_user


def ensure_demo_session(request):
    demo_usuario, demo_auth_user = ensure_demo_data()
    if demo_usuario is None or demo_auth_user is None:
        return None

    login(request, demo_auth_user, backend="django.contrib.auth.backends.ModelBackend")
    request.session["usuario_id"] = demo_usuario.pk
    request.session["usuario_nome"] = demo_usuario.nome
    request.session["usuario_email"] = demo_usuario.email
    return demo_usuario
