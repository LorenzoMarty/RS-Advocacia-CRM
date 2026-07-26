from concurrent.futures import ThreadPoolExecutor
from datetime import date

from django.core.cache import cache
from django.db import connections
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

# TTL curto do cache de /api/inicializacao/: absorve os refreshes repetidos de
# tela (todo mount de rota recarrega o boot da SPA) sem atrasar a propagação
# de escritas reais além do razoável.
CACHE_TTL_INICIALIZACAO_SEGUNDOS = 15

FRONTEND_ACCESS_PERMISSIONS = (
    "financeiro.view_lancamento",
    "financeiro.add_lancamento",
    "financeiro.change_lancamento",
    "usuarios.view_usuario",
    "usuarios.add_usuario",
    "usuarios.change_usuario",
    "ai.view_configuracaoia",
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


def _executar_em_paralelo(tarefas):
    """Roda cada tarefa (sem args) numa thread própria, com sua própria conexão
    de banco, e devolve {chave: resultado} na ordem de conclusão. Cada tarefa
    precisa fechar sua conexão ao terminar (feito aqui) para não vazar
    conexões do pool entre chamadas."""

    def _rodar(tarefa):
        try:
            return tarefa()
        finally:
            connections.close_all()

    resultados = {}
    with ThreadPoolExecutor(max_workers=max(len(tarefas), 1)) as executor:
        futuros = {
            executor.submit(_rodar, tarefa): chave for chave, tarefa in tarefas.items()
        }
        for futuro in futuros:
            resultados[futuros[futuro]] = futuro.result()
    return resultados


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

    usuario_atual = _current_usuario(request)
    cache_key = f"inicializacao:{request.session.get('usuario_id') or 'anon'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return resposta_sucesso(cached)

    acessos = {
        permission: user_has_permission(request, permission)
        for permission in FRONTEND_ACCESS_PERMISSIONS
    }
    pode_ver_usuarios = acessos["usuarios.view_usuario"]
    pode_ver_timeentry = user_has_permission(request, "productivity.view_timeentry")
    pode_ver_metas = user_has_permission(request, "productivity.view_productivitygoal")
    pode_ver_prospects = user_has_permission(request, "prospeccao.view_prospect")
    pode_ver_lancamentos = acessos["financeiro.view_lancamento"]
    eh_admin = _is_admin(request, usuario_atual)

    tarefas = {
        "clientes": lambda: [
            serialize_cliente(cliente)
            for cliente in Cliente.objects.all()[:LIMITE_BOOTSTRAP_COLECAO]
        ],
        "processos": lambda: [
            serialize_processo(processo)
            for processo in Processo.objects.select_related("cliente").all()[
                :LIMITE_BOOTSTRAP_COLECAO
            ]
        ],
        "eventos": lambda: [
            serialize_evento(evento)
            for evento in Evento.objects.exclude(tipo_evento__icontains="prazo")
            .select_related("cliente", "processo", "responsavel")
            .all()
        ],
        "peticoes": lambda: [
            serialize_peticao(peticao)
            for peticao in Peticao.objects.select_related("cliente", "processo").all()
        ],
        "prazos": lambda: [
            serialize_prazo(prazo)
            for prazo in Prazo.objects.select_related("processo__cliente").all()
        ],
        "usuarios_atribuiveis": lambda: [
            {"id": str(pk), "nome": nome}
            for pk, nome in Usuario.objects.order_by("nome").values_list(
                "pk", "nome"
            )
        ],
    }

    if pode_ver_usuarios:
        tarefas["usuarios"] = lambda: serialize_usuarios(
            Usuario.objects.order_by("nome")[:LIMITE_BOOTSTRAP_COLECAO]
        )

    if usuario_atual and pode_ver_timeentry:

        def _time_entries():
            time_entries = TimeEntry.objects.select_related("user")
            if not eh_admin:
                time_entries = time_entries.filter(user=usuario_atual)
            return _time_entries_response(time_entries)

        tarefas["time_entries"] = _time_entries

    if usuario_atual and pode_ver_metas:
        tarefas["productivity_goals"] = lambda: _goals_response(
            request, usuario_atual
        )

    if pode_ver_prospects:
        tarefas["prospects"] = lambda: [
            serialize_prospect(prospect)
            for prospect in Prospect.objects.select_related(
                "responsavel_interno", "cliente_convertido"
            ).all()
        ]

    if pode_ver_lancamentos:
        tarefas["lancamentos"] = lambda: [
            serialize_lancamento(lancamento)
            for lancamento in Lancamento.objects.select_related(
                "cliente_relacionado", "caso_relacionado"
            ).all()
        ]

    if eh_admin:
        tarefas["auditoria"] = lambda: [
            serialize_registro(registro)
            for registro in RegistroAuditoria.objects.all()[:50]
        ]

    data = _executar_em_paralelo(tarefas)
    data["acessos"] = acessos

    cache.set(cache_key, data, CACHE_TTL_INICIALIZACAO_SEGUNDOS)
    return resposta_sucesso(data)


@ensure_csrf_cookie
def csrf_token(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    return resposta_sucesso(
        {"csrf_token": get_token(request)}, mensagem="Token CSRF definido."
    )
