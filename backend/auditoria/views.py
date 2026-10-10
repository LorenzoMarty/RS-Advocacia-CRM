from datetime import datetime

from django.db.models import Q
from django.http import HttpRequest

from agenda.models import Evento
from auditoria import overview as overview_mod
from auditoria import painel
from auditoria.models import RegistroAuditoria
from clientes.models import Cliente
from core.identity import current_usuario, is_admin
from core.pagination import paginar
from core.permissions import app_permissions_required
from core.utils import (
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo
from productivity.models import ProductivityGoal, TimeEntry
from auditoria.serializers import serialize_registro








def _exigir_admin(request: HttpRequest):
    """Return an error response if the caller is not an admin, else None."""
    usuario_atual = current_usuario(request)
    if not is_admin(request, usuario_atual):
        return resposta_erro(
            {"permissao": ["Apenas administradores acessam a auditoria."]}, status=403
        )
    return None


def _parse_date(value):
    """'YYYY-MM-DD' -> date, ou None se inválido."""
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


@app_permissions_required("processos.view_processo", "prazos.view_prazo")
def listar_autores(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    erro_admin = _exigir_admin(request)
    if erro_admin is not None:
        return erro_admin

    nomes = (
        RegistroAuditoria.objects.exclude(autor_nome="")
        .order_by("autor_nome")
        .values_list("autor_nome", flat=True)
        .distinct()
    )

    return resposta_sucesso({"autores": list(nomes)})


@app_permissions_required("processos.view_processo", "prazos.view_prazo")
def listar_auditoria(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    erro_admin = _exigir_admin(request)
    if erro_admin is not None:
        return erro_admin

    registros = RegistroAuditoria.objects.all()

    entidade_tipo = request.GET.get("entidade_tipo")
    if entidade_tipo:
        registros = registros.filter(entidade_tipo=entidade_tipo)

    entidade_id = request.GET.get("entidade_id")
    if entidade_id:
        registros = registros.filter(entidade_id=str(entidade_id))

    acao = request.GET.get("acao")
    if acao:
        registros = registros.filter(acao=acao)

    autor_nome = request.GET.get("autor_nome")
    if autor_nome:
        registros = registros.filter(autor_nome__icontains=autor_nome)

    desde = _parse_date(request.GET.get("desde"))
    if desde:
        registros = registros.filter(criado_em__date__gte=desde)

    ate = _parse_date(request.GET.get("ate"))
    if ate:
        registros = registros.filter(criado_em__date__lte=ate)

    q = (request.GET.get("q") or "").strip()
    if q:
        registros = registros.filter(
            Q(resumo__icontains=q)
            | Q(entidade_rotulo__icontains=q)
            | Q(autor_nome__icontains=q)
            | Q(processo_rotulo__icontains=q)
        )

    pagina, paginacao = paginar(registros, request)

    return resposta_sucesso(
        {
            "registros": [serialize_registro(registro) for registro in pagina],
            "paginacao": paginacao,
        }
    )


PERIODO_PADRAO = 7


def _periodo(request: HttpRequest) -> int:
    """Horizonte (em dias) para as ações prioritárias; 0 = sem corte."""
    try:
        periodo = int(request.GET.get("periodo", PERIODO_PADRAO))
    except (TypeError, ValueError):
        return PERIODO_PADRAO
    return max(0, periodo)


@app_permissions_required("processos.view_processo", "prazos.view_prazo")
def painel_auditoria(request: HttpRequest):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    erro_admin = _exigir_admin(request)
    if erro_admin is not None:
        return erro_admin

    processos = list(Processo.objects.select_related("cliente", "advogado_responsavel"))
    prazos = list(Prazo.objects.filter(concluido=False).select_related("processo", "responsavel"))
    clientes = list(Cliente.objects.all())
    running_timers = TimeEntry.objects.filter(status=TimeEntry.STATUS_RUNNING).count()

    dados = painel.build_panel(
        processos, prazos, clientes, running_timers, _periodo(request)
    )
    return resposta_sucesso(dados)


@app_permissions_required("processos.view_processo", "prazos.view_prazo")
def visao_geral(request: HttpRequest):
    """Macro operational overview: all work domains in one payload."""
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    erro_admin = _exigir_admin(request)
    if erro_admin is not None:
        return erro_admin

    processos = list(Processo.objects.select_related("cliente", "advogado_responsavel").all())
    todos_prazos = list(Prazo.objects.select_related("processo", "responsavel").all())
    clientes = list(Cliente.objects.all())
    eventos = list(
        Evento.objects.exclude(tipo_evento__icontains="prazo")
        .select_related("cliente", "processo", "responsavel")
        .all()
    )
    peticoes = list(Peticao.objects.all())
    time_entries = list(
        TimeEntry.objects.select_related("user").all()
    )
    productivity_goals = list(ProductivityGoal.objects.all())
    running_timers = sum(1 for e in time_entries if e.status == TimeEntry.STATUS_RUNNING)

    periodo = _periodo(request)
    prazos_abertos = [p for p in todos_prazos if not p.concluido]
    panel_dados = painel.build_panel(processos, prazos_abertos, clientes, running_timers, periodo)
    overview_dados = overview_mod.build_overview(
        processos, todos_prazos, eventos, peticoes, time_entries, productivity_goals
    )

    return resposta_sucesso({**panel_dados, **overview_dados})
