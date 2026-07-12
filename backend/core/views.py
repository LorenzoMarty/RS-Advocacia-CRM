from datetime import date

from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie

from agenda.models import Evento
from agenda.views import serialize_evento
from auditoria.models import RegistroAuditoria
from auditoria.views import serialize_registro
from clientes.models import Cliente
from clientes.views import serialize_cliente
from core.permission_utils import user_has_permission
from core.permissions import app_permissions_required
from core.utils import metodo_nao_permitido, resposta_sucesso
from financeiro.models import Lancamento
from financeiro.views import serialize_lancamento
from peticoes.models import Peticao
from peticoes.views import serialize_peticao
from prazos.models import Prazo
from prazos.views import serialize_prazo
from processos.models import Processo
from processos.views import serialize_processo
from productivity.models import TimeEntry
from productivity.views import (
    _current_usuario,
    _goals_response,
    _is_admin,
    _time_entries_response,
)
from prospeccao.models import Prospect
from prospeccao.views import serialize_prospect
from usuarios.models import Usuario
from usuarios.views import serialize_usuarios

# Teto de segurança nas coleções mais propensas a crescer sem limite
# (clientes/processos/usuarios) devolvidas no boot da SPA — não é paginação
# real (a tela de listagem de cada entidade tem seu próprio endpoint paginado
# em .../views.py), só evita que o payload do boot cresça sem limite conforme
# o histórico do escritório aumenta.
LIMITE_BOOTSTRAP_COLECAO = 2000

FRONTEND_ACCESS_PERMISSIONS = (
    "financeiro.view_lancamento",
    "financeiro.add_lancamento",
    "financeiro.change_lancamento",
    "usuarios.view_usuario",
    "usuarios.add_usuario",
    "usuarios.change_usuario",
)


@app_permissions_required(
    "agenda.view_evento",
    "peticoes.view_peticao",
    "prazos.view_prazo",
    "clientes.view_cliente",
    "processos.view_processo",
)
def painel(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    hoje = date.today()
    eventos_hoje = (
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .filter(data_inicio__date=hoje)
        .select_related("cliente", "processo")
    )
    prazos_hoje = Prazo.objects.filter(data_limite=hoje).select_related(
        "processo__cliente"
    )
    proximos_eventos = (
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .filter(data_inicio__date__gte=hoje)
        .select_related("cliente", "processo")
        .order_by("data_inicio")[:5]
    )
    proximos_prazos = (
        Prazo.objects.filter(data_limite__gte=hoje)
        .select_related("processo__cliente")
        .order_by("data_limite")[:5]
    )

    return resposta_sucesso(
        {
            "eventos_hoje": [serialize_evento(evento) for evento in eventos_hoje],
            "prazos_hoje": [serialize_prazo(prazo) for prazo in prazos_hoje],
            "proximos_eventos": [
                serialize_evento(evento) for evento in proximos_eventos
            ],
            "proximos_prazos": [serialize_prazo(prazo) for prazo in proximos_prazos],
            "total_clientes": Cliente.objects.count(),
            "total_processos": Processo.objects.count(),
            "total_peticoes": Peticao.objects.count(),
            "total_prazos": Prazo.objects.count(),
        }
    )


@app_permissions_required(
    "agenda.view_evento",
    "peticoes.view_peticao",
    "prazos.view_prazo",
    "clientes.view_cliente",
    "processos.view_processo",
)
def inicializacao(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    clientes = Cliente.objects.all()[:LIMITE_BOOTSTRAP_COLECAO]
    processos = Processo.objects.select_related("cliente").all()[
        :LIMITE_BOOTSTRAP_COLECAO
    ]
    eventos = (
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .select_related("cliente", "processo", "responsavel")
        .all()
    )
    peticoes = Peticao.objects.select_related("cliente", "processo").all()
    prazos = Prazo.objects.select_related("processo__cliente").all()
    serialized_clientes = [serialize_cliente(cliente) for cliente in clientes]
    serialized_processos = [serialize_processo(processo) for processo in processos]
    serialized_eventos = [serialize_evento(evento) for evento in eventos]
    serialized_peticoes = [serialize_peticao(peticao) for peticao in peticoes]
    serialized_prazos = [serialize_prazo(prazo) for prazo in prazos]
    usuario_atual = _current_usuario(request)

    data = {
        "clientes": serialized_clientes,
        "processos": serialized_processos,
        "eventos": serialized_eventos,
        "peticoes": serialized_peticoes,
        "prazos": serialized_prazos,
        "acessos": {
            permission: user_has_permission(request, permission)
            for permission in FRONTEND_ACCESS_PERMISSIONS
        },
    }

    # Lista enxuta (id + nome) para popular selects de responsável mesmo para
    # quem não tem permissão de gerenciar usuários (view_usuario).
    data["usuarios_atribuiveis"] = [
        {"id": str(pk), "nome": nome}
        for pk, nome in Usuario.objects.order_by("nome").values_list("pk", "nome")
    ]

    if user_has_permission(request, "usuarios.view_usuario"):
        serialized_usuarios = serialize_usuarios(
            Usuario.objects.order_by("nome")[:LIMITE_BOOTSTRAP_COLECAO]
        )
        data["usuarios"] = serialized_usuarios

    if usuario_atual and user_has_permission(request, "productivity.view_timeentry"):
        time_entries = TimeEntry.objects.select_related("user")
        if not _is_admin(request, usuario_atual):
            time_entries = time_entries.filter(user=usuario_atual)
        data["time_entries"] = _time_entries_response(time_entries)

    if usuario_atual and user_has_permission(
        request, "productivity.view_productivitygoal"
    ):
        data["productivity_goals"] = _goals_response(request, usuario_atual)

    if user_has_permission(request, "prospeccao.view_prospect"):
        prospects = Prospect.objects.select_related(
            "responsavel_interno", "cliente_convertido"
        ).all()
        data["prospects"] = [serialize_prospect(prospect) for prospect in prospects]

    if user_has_permission(request, "financeiro.view_lancamento"):
        lancamentos = Lancamento.objects.select_related(
            "cliente_relacionado", "caso_relacionado"
        ).all()
        data["lancamentos"] = [
            serialize_lancamento(lancamento) for lancamento in lancamentos
        ]

    if _is_admin(request, usuario_atual):
        registros = RegistroAuditoria.objects.all()[:50]
        data["auditoria"] = [serialize_registro(registro) for registro in registros]

    return resposta_sucesso(data)


@ensure_csrf_cookie
def csrf_token(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    return resposta_sucesso(
        {"csrf_token": get_token(request)}, mensagem="Token CSRF definido."
    )
