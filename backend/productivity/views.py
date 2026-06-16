from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core.permissions import app_permissions_required
from core.utils import (
    ler_corpo_json,
    metodo_nao_permitido,
    resposta_erro,
    resposta_sucesso,
)
from peticoes.models import Peticao
from prazos.models import Prazo
from productivity.models import ProductivityGoal, TimeEntry
from usuarios.models import Usuario

DEFAULT_DAILY_HOURS = Decimal("6")
DEFAULT_WEEKLY_HOURS = Decimal("30")


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


def _elapsed_seconds(entry: TimeEntry, now=None) -> int:
    total_seconds = int(entry.total_seconds or 0)
    if entry.status != TimeEntry.STATUS_RUNNING:
        return total_seconds

    now = now or timezone.now()
    base = entry.resumed_at or entry.started_at
    if not base:
        return total_seconds

    return total_seconds + max(0, int((now - base).total_seconds()))


def _save_elapsed(entry: TimeEntry, now=None) -> int:
    elapsed_seconds = max(int(entry.total_seconds or 0), _elapsed_seconds(entry, now=now))
    entry.total_seconds = elapsed_seconds
    return elapsed_seconds


def _is_pending_task_status(status: str) -> bool:
    return (status or "").strip().casefold() in {"pendente", "a fazer"}


def _promote_task_to_running(task_type: str, task_id: str):
    if task_type == TimeEntry.TASK_PRAZO:
        updated = Prazo.objects.filter(
            pk=task_id,
            concluido=False,
            status__in=["Pendente", "A fazer"],
        ).update(status="Em andamento")
        if not updated:
            prazo = Prazo.objects.filter(pk=task_id, concluido=False).first()
            if prazo and _is_pending_task_status(prazo.status):
                prazo.status = "Em andamento"
                prazo.save(update_fields=["status", "atualizado_em"])
        return

    if task_type in {TimeEntry.TASK_PETICAO, TimeEntry.TASK_CONTESTACAO}:
        Peticao.objects.filter(
            pk=task_id,
            status=Peticao.STATUS_PENDENTE,
        ).update(status=Peticao.STATUS_EM_ANDAMENTO)


def _decimal_hours(value) -> float:
    return float(value or 0)


def _task_details(entries):
    prazo_ids = [
        entry.task_id for entry in entries if entry.task_type == TimeEntry.TASK_PRAZO
    ]
    peticao_ids = [
        entry.task_id
        for entry in entries
        if entry.task_type in {TimeEntry.TASK_PETICAO, TimeEntry.TASK_CONTESTACAO}
    ]

    prazos = {
        str(prazo.pk): prazo
        for prazo in Prazo.objects.select_related("processo__cliente").filter(
            pk__in=prazo_ids
        )
    }
    peticoes = {
        str(peticao.pk): peticao
        for peticao in Peticao.objects.select_related("cliente", "processo").filter(
            pk__in=peticao_ids
        )
    }

    details = {}
    for entry in entries:
        if entry.task_type == TimeEntry.TASK_PRAZO:
            prazo = prazos.get(str(entry.task_id))
            if prazo:
                details[entry.pk] = {
                    "task_name": prazo.titulo,
                    "process_id": str(prazo.processo_id) if prazo.processo_id else "",
                    "process_number": (
                        prazo.processo.numero_processo if prazo.processo_id else ""
                    ),
                }
            continue

        peticao = peticoes.get(str(entry.task_id))
        if peticao:
            details[entry.pk] = {
                "task_name": peticao.adverso,
                "process_id": str(peticao.processo_id) if peticao.processo_id else "",
                "process_number": (
                    peticao.processo.numero_processo if peticao.processo_id else ""
                ),
            }

    return details


def serialize_time_entry(entry: TimeEntry, details=None, now=None):
    details = details or {}
    task_details = details.get(entry.pk, {})
    return {
        "id": str(entry.pk),
        "pk": entry.pk,
        "user_id": str(entry.user_id),
        "user_name": entry.user.nome if entry.user_id else "",
        "task_id": str(entry.task_id),
        "task_type": entry.task_type,
        "task_name": task_details.get("task_name", ""),
        "process_id": task_details.get("process_id", ""),
        "process_number": task_details.get("process_number", ""),
        "started_at": entry.started_at.isoformat() if entry.started_at else None,
        "paused_at": entry.paused_at.isoformat() if entry.paused_at else None,
        "resumed_at": entry.resumed_at.isoformat() if entry.resumed_at else None,
        "ended_at": entry.ended_at.isoformat() if entry.ended_at else None,
        "total_seconds": entry.total_seconds,
        "elapsed_seconds": _elapsed_seconds(entry, now=now),
        "status": entry.status,
    }


def serialize_productivity_goal(goal: ProductivityGoal | None, usuario: Usuario):
    return {
        "id": str(goal.pk) if goal else "",
        "user_id": str(usuario.pk),
        "daily_hours": _decimal_hours(
            goal.daily_hours if goal else DEFAULT_DAILY_HOURS
        ),
        "weekly_hours": _decimal_hours(
            goal.weekly_hours if goal else DEFAULT_WEEKLY_HOURS
        ),
        "configured": bool(goal),
    }


def _visible_time_entries(request, usuario: Usuario):
    queryset = TimeEntry.objects.select_related("user").all()
    if not _is_admin(request, usuario):
        queryset = queryset.filter(user=usuario)
    elif request.GET.get("user_id"):
        queryset = queryset.filter(user_id=request.GET["user_id"])
    return queryset


def _time_entries_response(entries):
    entries = list(entries)
    now = timezone.now()
    details = _task_details(entries)
    return [serialize_time_entry(entry, details=details, now=now) for entry in entries]


def _goals_response(request, usuario: Usuario):
    if _is_admin(request, usuario):
        usuarios = list(Usuario.objects.order_by("nome"))
    else:
        usuarios = [usuario]

    goals_by_user_id = {
        goal.user_id: goal
        for goal in ProductivityGoal.objects.filter(user__in=usuarios)
    }
    return [
        serialize_productivity_goal(goals_by_user_id.get(item.pk), item)
        for item in usuarios
    ]


# ---------------------------------------------------------------------------
# Resumo agregado (dashboard de produtividade)
# ---------------------------------------------------------------------------


def _aware(dt):
    """Garante datetime timezone-aware na timezone atual."""
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _parse_iso_date(value):
    """'YYYY-MM-DD' -> date, ou None se inválido."""
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _period_bounds(request, now=None):
    """Retorna (inicio, fim, inicio_anterior, fim_anterior, periodo).

    week  = semana corrente (segunda 00:00 -> agora)
    month = mês corrente (dia 1 00:00 -> agora)
    custom= inicio/fim (datas, dia inteiro)
    O período anterior tem a mesma duração, imediatamente antes do início.
    """
    now = now or timezone.now()
    periodo = (request.GET.get("periodo") or "week").strip().lower()

    if periodo == "custom":
        inicio_date = _parse_iso_date(request.GET.get("inicio"))
        fim_date = _parse_iso_date(request.GET.get("fim"))
        if inicio_date and fim_date and fim_date >= inicio_date:
            inicio = _aware(datetime.combine(inicio_date, time.min))
            fim = _aware(datetime.combine(fim_date, time.max))
        else:
            periodo = "week"

    if periodo == "month":
        inicio = _aware(datetime.combine(now.date().replace(day=1), time.min))
        fim = now
    elif periodo == "week":
        local_now = timezone.localtime(now)
        monday = local_now.date() - timedelta(days=local_now.weekday())
        inicio = _aware(datetime.combine(monday, time.min))
        fim = now

    duracao = fim - inicio
    fim_anterior = inicio
    inicio_anterior = inicio - duracao
    return inicio, fim, inicio_anterior, fim_anterior, periodo


def _entry_reference_dt(entry):
    """Data que posiciona a entrada num período: fim, senão início."""
    return entry.ended_at or entry.started_at


def _entries_in_range(entries, inicio, fim):
    resultado = []
    for entry in entries:
        ref = _entry_reference_dt(entry)
        if ref and inicio <= ref <= fim:
            resultado.append(entry)
    return resultado


def _aggregate_resumo(entries, details, now):
    """Agrega uma lista de entradas já filtradas por período."""
    por_usuario = {}
    por_tarefa = {}
    por_processo = {}
    por_tipo = {}
    por_dia = {}
    total = 0

    for entry in entries:
        seconds = _elapsed_seconds(entry, now=now)
        total += seconds
        task_details = details.get(entry.pk, {})

        # por usuário
        u = por_usuario.setdefault(
            str(entry.user_id),
            {
                "user_id": str(entry.user_id),
                "user_name": entry.user.nome if entry.user_id else "",
                "segundos": 0,
                "entradas": 0,
            },
        )
        u["segundos"] += seconds
        u["entradas"] += 1

        # por tipo
        t = por_tipo.setdefault(
            entry.task_type,
            {"task_type": entry.task_type, "segundos": 0, "entradas": 0},
        )
        t["segundos"] += seconds
        t["entradas"] += 1

        # por tarefa
        task_key = f"{entry.task_type}:{entry.task_id}"
        tk = por_tarefa.setdefault(
            task_key,
            {
                "task_id": str(entry.task_id),
                "task_type": entry.task_type,
                "task_name": task_details.get("task_name", ""),
                "process_id": task_details.get("process_id", ""),
                "process_number": task_details.get("process_number", ""),
                "segundos": 0,
                "entradas": 0,
            },
        )
        tk["segundos"] += seconds
        tk["entradas"] += 1

        # por processo
        process_id = task_details.get("process_id", "")
        process_number = task_details.get("process_number", "")
        proc_key = process_id or "sem-processo"
        p = por_processo.setdefault(
            proc_key,
            {
                "process_id": process_id,
                "process_number": process_number or "Sem processo",
                "segundos": 0,
            },
        )
        p["segundos"] += seconds

        # por dia (data local da referência)
        ref = _entry_reference_dt(entry)
        dia = timezone.localtime(ref).date().isoformat()
        por_dia[dia] = por_dia.get(dia, 0) + seconds

    return {
        "tempo_total_segundos": total,
        "por_usuario": sorted(
            por_usuario.values(), key=lambda x: x["segundos"], reverse=True
        ),
        "por_tarefa": sorted(
            por_tarefa.values(), key=lambda x: x["segundos"], reverse=True
        ),
        "por_processo": sorted(
            por_processo.values(), key=lambda x: x["segundos"], reverse=True
        ),
        "por_tipo": sorted(
            por_tipo.values(), key=lambda x: x["segundos"], reverse=True
        ),
        "por_dia": [
            {"data": dia, "segundos": seg} for dia, seg in sorted(por_dia.items())
        ],
    }


@app_permissions_required("productivity.view_timeentry")
def resumo(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario = _current_usuario(request)
    if not usuario:
        return resposta_erro({"usuario": ["Usuário atual não encontrado."]}, status=403)

    now = timezone.now()
    inicio, fim, inicio_anterior, fim_anterior, periodo = _period_bounds(
        request, now=now
    )

    all_entries = list(_visible_time_entries(request, usuario))
    details = _task_details(all_entries)

    atuais = _entries_in_range(all_entries, inicio, fim)
    anteriores = _entries_in_range(all_entries, inicio_anterior, fim_anterior)

    resumo_atual = _aggregate_resumo(atuais, details, now)
    total_anterior = sum(_elapsed_seconds(e, now=now) for e in anteriores)
    total_atual = resumo_atual["tempo_total_segundos"]

    if total_anterior > 0:
        variacao = round((total_atual - total_anterior) / total_anterior * 100, 1)
    else:
        variacao = None  # sem base de comparação

    timers_ativos = [
        serialize_time_entry(entry, details=details, now=now)
        for entry in all_entries
        if entry.status in {TimeEntry.STATUS_RUNNING, TimeEntry.STATUS_PAUSED}
    ]

    return resposta_sucesso(
        {
            "periodo": periodo,
            "inicio": inicio.isoformat(),
            "fim": fim.isoformat(),
            "tempo_total_segundos": total_atual,
            "tempo_periodo_anterior_segundos": total_anterior,
            "variacao_percentual": variacao,
            "por_usuario": resumo_atual["por_usuario"],
            "por_tarefa": resumo_atual["por_tarefa"],
            "por_processo": resumo_atual["por_processo"],
            "por_tipo": resumo_atual["por_tipo"],
            "por_dia": resumo_atual["por_dia"],
            "timers_ativos": timers_ativos,
            "is_admin": _is_admin(request, usuario),
        }
    )


@app_permissions_required("productivity.view_timeentry")
def produtividade(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario = _current_usuario(request)
    if not usuario:
        return resposta_erro({"usuario": ["Usuário atual não encontrado."]}, status=403)

    entries = _visible_time_entries(request, usuario)
    return resposta_sucesso(
        {
            "time_entries": _time_entries_response(entries),
            "productivity_goals": _goals_response(request, usuario),
            "is_admin": _is_admin(request, usuario),
        }
    )


@app_permissions_required("productivity.add_timeentry")
def iniciar_timer(request):
    if request.method != "POST":
        return metodo_nao_permitido(["POST"])

    usuario = _current_usuario(request)
    if not usuario:
        return resposta_erro({"usuario": ["Usuário atual não encontrado."]}, status=403)

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    task_id = str(payload.get("task_id") or "").strip()
    task_type = str(payload.get("task_type") or "").strip()
    pause_existing = bool(payload.get("pause_existing"))

    if not task_id:
        return resposta_erro({"task_id": ["Informe a tarefa."]}, status=400)
    if task_type not in dict(TimeEntry.TASK_CHOICES):
        return resposta_erro({"task_type": ["Tipo de tarefa inválido."]}, status=400)

    running_entry = (
        TimeEntry.objects.select_related("user")
        .filter(
            user=usuario,
            status=TimeEntry.STATUS_RUNNING,
        )
        .first()
    )
    now = timezone.now()

    if running_entry and not (
        running_entry.task_id == task_id and running_entry.task_type == task_type
    ):
        if not pause_existing:
            details = _task_details([running_entry])
            return resposta_erro(
                {
                    "timer_ativo": ["Já existe um timer ativo."],
                    "active_entry": serialize_time_entry(
                        running_entry, details=details, now=now
                    ),
                },
                status=409,
            )

        _save_elapsed(running_entry, now=now)
        running_entry.paused_at = now
        running_entry.status = TimeEntry.STATUS_PAUSED
        running_entry.save(update_fields=["total_seconds", "paused_at", "status"])

    if (
        running_entry
        and running_entry.task_id == task_id
        and running_entry.task_type == task_type
    ):
        entry = running_entry
    else:
        entry = TimeEntry.objects.create(
            user=usuario,
            task_id=task_id,
            task_type=task_type,
            started_at=now,
            status=TimeEntry.STATUS_RUNNING,
        )

    _promote_task_to_running(task_type, task_id)
    entry = TimeEntry.objects.select_related("user").get(pk=entry.pk)
    return resposta_sucesso(
        {
            "time_entry": serialize_time_entry(
                entry, details=_task_details([entry]), now=now
            )
        },
        mensagem="Timer iniciado.",
        status=201,
    )


def _get_entry_for_action(request, entry_id):
    usuario = _current_usuario(request)
    if not usuario:
        return None, resposta_erro(
            {"usuario": ["Usuário atual não encontrado."]}, status=403
        )

    entry = get_object_or_404(TimeEntry.objects.select_related("user"), pk=entry_id)
    if entry.user_id != usuario.pk and not _is_admin(request, usuario):
        return None, resposta_erro(
            {"permissao": ["Você só pode alterar seus próprios timers."]}, status=403
        )
    return entry, None


@app_permissions_required("productivity.change_timeentry")
def pausar_timer(request, entry_id):
    if request.method not in {"PATCH", "PUT"}:
        return metodo_nao_permitido(["PATCH", "PUT"])

    entry, error_response = _get_entry_for_action(request, entry_id)
    if error_response:
        return error_response

    now = timezone.now()
    if entry.status == TimeEntry.STATUS_RUNNING:
        _save_elapsed(entry, now=now)
        entry.paused_at = now
        entry.status = TimeEntry.STATUS_PAUSED
        entry.save(update_fields=["total_seconds", "paused_at", "status"])

    return resposta_sucesso(
        {
            "time_entry": serialize_time_entry(
                entry, details=_task_details([entry]), now=now
            )
        },
        mensagem="Timer pausado.",
    )


@app_permissions_required("productivity.change_timeentry")
def retomar_timer(request, entry_id):
    if request.method not in {"PATCH", "PUT"}:
        return metodo_nao_permitido(["PATCH", "PUT"])

    entry, error_response = _get_entry_for_action(request, entry_id)
    if error_response:
        return error_response

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    now = timezone.now()
    running_entry = (
        TimeEntry.objects.select_related("user")
        .filter(
            user=entry.user,
            status=TimeEntry.STATUS_RUNNING,
        )
        .exclude(pk=entry.pk)
        .first()
    )

    if running_entry:
        if not payload.get("pause_existing"):
            details = _task_details([running_entry])
            return resposta_erro(
                {
                    "timer_ativo": ["Já existe um timer ativo."],
                    "active_entry": serialize_time_entry(
                        running_entry, details=details, now=now
                    ),
                },
                status=409,
            )
        _save_elapsed(running_entry, now=now)
        running_entry.paused_at = now
        running_entry.status = TimeEntry.STATUS_PAUSED
        running_entry.save(update_fields=["total_seconds", "paused_at", "status"])

    if entry.status == TimeEntry.STATUS_PAUSED:
        entry.resumed_at = now
        entry.status = TimeEntry.STATUS_RUNNING
        entry.save(update_fields=["resumed_at", "status"])
        _promote_task_to_running(entry.task_type, entry.task_id)

    return resposta_sucesso(
        {
            "time_entry": serialize_time_entry(
                entry, details=_task_details([entry]), now=now
            )
        },
        mensagem="Timer retomado.",
    )


@app_permissions_required("productivity.change_timeentry")
def encerrar_timer(request, entry_id):
    if request.method not in {"PATCH", "PUT"}:
        return metodo_nao_permitido(["PATCH", "PUT"])

    entry, error_response = _get_entry_for_action(request, entry_id)
    if error_response:
        return error_response

    now = timezone.now()
    if entry.status != TimeEntry.STATUS_STOPPED:
        _save_elapsed(entry, now=now)
        entry.ended_at = now
        entry.status = TimeEntry.STATUS_STOPPED
        entry.save(update_fields=["total_seconds", "ended_at", "status"])

    return resposta_sucesso(
        {
            "time_entry": serialize_time_entry(
                entry, details=_task_details([entry]), now=now
            )
        },
        mensagem="Timer encerrado.",
    )


@app_permissions_required("productivity.view_productivitygoal")
def listar_metas(request):
    if request.method != "GET":
        return metodo_nao_permitido(["GET"])

    usuario = _current_usuario(request)
    if not usuario:
        return resposta_erro({"usuario": ["Usuário atual não encontrado."]}, status=403)

    return resposta_sucesso({"productivity_goals": _goals_response(request, usuario)})


@app_permissions_required("productivity.change_productivitygoal")
def salvar_metas(request):
    if request.method not in {"PUT", "PATCH"}:
        return metodo_nao_permitido(["PUT", "PATCH"])

    usuario = _current_usuario(request)
    if not usuario or not _is_admin(request, usuario):
        return resposta_erro(
            {"permissao": ["Apenas administradores alteram metas."]}, status=403
        )

    try:
        payload = ler_corpo_json(request)
    except ValueError as exc:
        return resposta_erro(str(exc), status=400)

    goals_payload = payload.get("goals")
    if not isinstance(goals_payload, list):
        goals_payload = [payload]

    updated_goals = []
    for item in goals_payload:
        user_id = item.get("user_id")
        if payload.get("apply_all") and not user_id:
            usuarios = Usuario.objects.all()
        else:
            usuarios = Usuario.objects.filter(pk=user_id)

        for goal_user in usuarios:
            goal, _ = ProductivityGoal.objects.get_or_create(user=goal_user)
            if "daily_hours" in item:
                goal.daily_hours = Decimal(
                    str(item.get("daily_hours") or DEFAULT_DAILY_HOURS)
                )
            if "weekly_hours" in item:
                goal.weekly_hours = Decimal(
                    str(item.get("weekly_hours") or DEFAULT_WEEKLY_HOURS)
                )
            goal.save()
            updated_goals.append(goal)

    return resposta_sucesso(
        {"productivity_goals": _goals_response(request, usuario)},
        mensagem=f"{len(updated_goals)} meta(s) atualizada(s).",
    )
