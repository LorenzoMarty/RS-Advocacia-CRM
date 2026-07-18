from datetime import datetime

from django.contrib.auth.models import AnonymousUser, User
from django.db.models import Q
from django.http import HttpRequest

from agenda.models import Evento
from auditoria import overview as overview_mod
from auditoria import painel
from auditoria.models import RegistroAuditoria
from clientes.models import Cliente
from core.pagination import paginar
from core.permissions import app_permissions_required
from core.utils import (
    isoformat_ou_nulo,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from peticoes.models import Peticao
from prazos.models import Prazo
from processos.models import Processo
from productivity.models import ProductivityGoal, TimeEntry
from usuarios.models import Usuario


def _authenticated_user(request: HttpRequest) -> User | None:
    request_user = getattr(request, "user", None)
    if (
        request_user is None
        or isinstance(request_user, AnonymousUser)
        or not getattr(request_user, "is_authenticated", False)
    ):
        return None
    return request_user


def _current_usuario(request: HttpRequest) -> Usuario | None:
    usuario_id = request.session.get("usuario_id")
    if usuario_id:
        usuario = Usuario.objects.filter(pk=usuario_id).first()
        if usuario:
            return usuario

    auth_user = _authenticated_user(request)
    if not auth_user:
        return None

    for value in (auth_user.email, auth_user.username):
        if not value:
            continue
        usuario = Usuario.objects.filter(email=value).first()
        if usuario:
            return usuario

    return None


def _is_admin(request: HttpRequest, usuario: Usuario | None = None) -> bool:
    auth_user = _authenticated_user(request)
    if auth_user and (auth_user.is_staff or auth_user.is_superuser):
        return True
    if auth_user and auth_user.groups.filter(name="Administrador").exists():
        return True
    return usuario is not None and usuario.cargo == "Administrador"


def _exigir_admin(request: HttpRequest):
    """Return an error response if the caller is not an admin, else None."""
    usuario_atual = _current_usuario(request)
    if not _is_admin(request, usuario_atual):
        return resposta_erro(
            {"permissao": ["Apenas administradores acessam a auditoria."]}, status=403
        )
    return None


def serialize_registro(registro: RegistroAuditoria):
    processo_id = registro.processo_id or ""
    processo_rotulo = registro.processo_rotulo or ""

    if not processo_id:
        if registro.entidade_tipo == RegistroAuditoria.ENTIDADE_PROCESSO:
            processo_id = registro.entidade_id
            processo_rotulo = registro.entidade_rotulo
        elif registro.entidade_tipo == RegistroAuditoria.ENTIDADE_PRAZO:
            prazo = (
                Prazo.objects.select_related("processo", "responsavel")
                .filter(pk=registro.entidade_id)
                .first()
            )
            if prazo and prazo.processo_id:
                processo_id = str(prazo.processo_id)
                processo_rotulo = prazo.processo.numero_processo
        elif registro.entidade_tipo == RegistroAuditoria.ENTIDADE_PETICAO:
            peticao = (
                Peticao.objects.select_related("processo")
                .filter(pk=registro.entidade_id)
                .first()
            )
            if peticao and peticao.processo_id:
                processo_id = str(peticao.processo_id)
                processo_rotulo = peticao.processo.numero_processo

    return {
        "id": str(registro.pk),
        "pk": registro.pk,
        "acao": registro.acao,
        "entidade_tipo": registro.entidade_tipo,
        "entidade_id": registro.entidade_id,
        "entidade_rotulo": registro.entidade_rotulo,
        "autor_nome": registro.autor_nome,
        "resumo": registro.resumo,
        "alteracoes": registro.alteracoes,
        "processo_id": processo_id,
        "processo_numero": processo_rotulo,
        "criado_em": isoformat_ou_nulo(registro.criado_em),
    }


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
