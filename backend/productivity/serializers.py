from decimal import Decimal

from django.utils import timezone

from core.identity import is_admin
from peticoes.models import Peticao
from prazos.models import Prazo
from productivity.models import ProductivityGoal, TimeEntry
from usuarios.models import Usuario

DEFAULT_DAILY_HOURS = Decimal("6")
DEFAULT_WEEKLY_HOURS = Decimal("30")


def elapsed_seconds(entry: TimeEntry, now=None) -> int:
    total_seconds = int(entry.total_seconds or 0)
    if entry.status != TimeEntry.STATUS_RUNNING:
        return total_seconds

    now = now or timezone.now()
    base = entry.resumed_at or entry.started_at
    if not base:
        return total_seconds

    return total_seconds + max(0, int((now - base).total_seconds()))


def decimal_hours(value) -> float:
    return float(value or 0)


def task_details(entries):
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
        "elapsed_seconds": elapsed_seconds(entry, now=now),
        "status": entry.status,
    }


def serialize_productivity_goal(goal: ProductivityGoal | None, usuario: Usuario):
    return {
        "id": str(goal.pk) if goal else "",
        "user_id": str(usuario.pk),
        "daily_hours": decimal_hours(
            goal.daily_hours if goal else DEFAULT_DAILY_HOURS
        ),
        "weekly_hours": decimal_hours(
            goal.weekly_hours if goal else DEFAULT_WEEKLY_HOURS
        ),
        "configured": bool(goal),
    }


def time_entries_response(entries):
    entries = list(entries)
    now = timezone.now()
    details = task_details(entries)
    return [serialize_time_entry(entry, details=details, now=now) for entry in entries]


def goals_response(request, usuario: Usuario):
    if is_admin(request, usuario):
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
