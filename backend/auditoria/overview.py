"""Macro office overview computation.

Pure functions that aggregate all work domains (processes, deadlines, events,
petitions, productivity) into a single admin-facing snapshot.  Designed to sit
beside ``painel.py`` — both are called from ``visao_geral`` and their results
are merged into one response.
"""

from datetime import timedelta

from django.utils import timezone

from auditoria import painel as painel_mod
from peticoes.models import Peticao


# ---------------------------------------------------------------------------
# Processos
# ---------------------------------------------------------------------------

def processos_por_status(processos):
    """Status distribution — reuses painel.status_distribution."""
    return painel_mod.status_distribution(processos)


def processos_parados_resumo(processos, now):
    """Count + top-N stale processes with days_stopped."""
    stale = painel_mod.stale_processes(processos, now)
    itens = []
    for processo in stale:
        moved = processo.data_ultima_movimentacao
        dias = (now - moved).days if moved else None
        itens.append(
            {
                "id": str(processo.pk),
                "numero": processo.numero_processo or "",
                "responsavel": processo.advogado_responsavel or "",
                "dias_parado": dias,
                "cliente_nome": (
                    processo.cliente.nome if processo.cliente_id else ""
                ),
            }
        )
    itens.sort(key=lambda x: x["dias_parado"] or 0, reverse=True)
    return {"count": len(itens), "itens": itens[:10]}


# ---------------------------------------------------------------------------
# Prazos
# ---------------------------------------------------------------------------

def prazos_resumo(todos_prazos, today):
    """Overdue/today/due_soon/done bucket counts over ALL prazos."""
    overdue = 0
    today_count = 0
    due_soon = 0
    done = 0
    for prazo in todos_prazos:
        if prazo.concluido:
            done += 1
            continue
        bucket = painel_mod.classify_deadline(prazo, today)
        if bucket == "overdue":
            overdue += 1
        elif bucket == "today":
            today_count += 1
        elif bucket in ("soon3", "soon7"):
            due_soon += 1
    return {
        "overdue": overdue,
        "today": today_count,
        "due_soon": due_soon,
        "done": done,
    }


# ---------------------------------------------------------------------------
# Eventos
# ---------------------------------------------------------------------------

def _serialize_evento_lean(evento):
    return {
        "id": str(evento.pk),
        "titulo": evento.titulo or "",
        "data_inicio": evento.data_inicio.isoformat() if evento.data_inicio else None,
        "data_fim": evento.data_fim.isoformat() if evento.data_fim else None,
        "tipo_evento": evento.tipo_evento or "",
        "status": evento.status or "",
        "responsavel_nome": evento.responsavel.nome if evento.responsavel_id else "",
        "processo_numero": (
            evento.processo.numero_processo if evento.processo_id else ""
        ),
        "cliente_nome": evento.cliente.nome if evento.cliente_id else "",
    }


def eventos_resumo(eventos, now):
    """Próximos (not concluded, future) and atrasados (past end, not concluded)."""
    proximos = []
    atrasados = []
    for evento in eventos:
        if evento.concluido:
            continue
        data_inicio = evento.data_inicio
        data_fim = evento.data_fim
        if data_fim and data_fim < now:
            atrasados.append(evento)
        elif data_inicio and data_inicio >= now:
            proximos.append(evento)

    proximos.sort(key=lambda e: e.data_inicio)
    atrasados.sort(key=lambda e: e.data_fim)

    return {
        "proximos": [_serialize_evento_lean(e) for e in proximos[:10]],
        "atrasados": [_serialize_evento_lean(e) for e in atrasados[:10]],
        "total_pendentes": len(proximos) + len(atrasados),
    }


# ---------------------------------------------------------------------------
# Petições — status funnel
# ---------------------------------------------------------------------------

_PETICAO_STATUS_ORDER = [
    Peticao.STATUS_PENDENTE,
    Peticao.STATUS_EM_ANDAMENTO,
    Peticao.STATUS_PROTOCOLAR,
    Peticao.STATUS_PROTOCOLADO,
]


def peticoes_por_status(peticoes):
    """Ordered status funnel with zero-counts included."""
    counts = {status: 0 for status in _PETICAO_STATUS_ORDER}
    for peticao in peticoes:
        status = peticao.status
        if status in counts:
            counts[status] += 1
    return [{"status": s, "count": counts[s]} for s in _PETICAO_STATUS_ORDER]


# ---------------------------------------------------------------------------
# Produtividade
# ---------------------------------------------------------------------------

def _monday_of(dt):
    local = timezone.localtime(dt)
    monday = local.date() - __import__("datetime").timedelta(days=local.weekday())
    from datetime import datetime, time
    tz = timezone.get_current_timezone()
    return timezone.make_aware(datetime.combine(monday, time.min), tz)


def produtividade_resumo(time_entries, productivity_goals, now):
    """Per-user hours this week vs goal + active timer count."""
    from productivity.models import TimeEntry as TE

    semana_inicio = _monday_of(now)

    # Index goals by user_id
    goals_by_user = {g.user_id: float(g.weekly_hours or 30) for g in productivity_goals}

    por_usuario = {}
    timers_ativos = 0

    for entry in time_entries:
        if entry.status == TE.STATUS_RUNNING:
            timers_ativos += 1

        # Determine reference datetime for week bucketing
        ref = entry.ended_at or entry.started_at
        if not ref or ref < semana_inicio:
            continue

        # Compute elapsed seconds (running entries get live time)
        total = int(entry.total_seconds or 0)
        if entry.status == TE.STATUS_RUNNING:
            base = entry.resumed_at or entry.started_at
            if base:
                total = total + max(0, int((now - base).total_seconds()))

        uid = str(entry.user_id)
        u = por_usuario.setdefault(
            uid,
            {
                "user_id": uid,
                "user_name": entry.user.nome if entry.user_id else "",
                "segundos": 0,
                "meta_horas": goals_by_user.get(entry.user_id, 30.0),
            },
        )
        u["segundos"] += total

    # Compute pct and round hours
    resultado = []
    for u in por_usuario.values():
        horas = round(u["segundos"] / 3600, 1)
        meta = u["meta_horas"]
        pct = round((horas / meta) * 100, 1) if meta else 0
        resultado.append(
            {
                "user_id": u["user_id"],
                "user_name": u["user_name"],
                "horas": horas,
                "meta_horas": meta,
                "pct": min(pct, 999),
            }
        )
    resultado.sort(key=lambda x: x["horas"], reverse=True)

    return {
        "semana_inicio": semana_inicio.date().isoformat(),
        "por_usuario": resultado,
        "timers_ativos": timers_ativos,
    }


# ---------------------------------------------------------------------------
# Main assembly
# ---------------------------------------------------------------------------

def build_overview(
    processos,
    todos_prazos,
    eventos,
    peticoes,
    time_entries,
    productivity_goals,
    today=None,
    now=None,
):
    """Assemble the full macro overview payload."""
    if today is None:
        today = timezone.localdate()
    if now is None:
        now = timezone.now()

    return {
        "processos_por_status": processos_por_status(processos),
        "processos_parados": processos_parados_resumo(processos, now),
        "prazos": prazos_resumo(todos_prazos, today),
        "eventos": eventos_resumo(eventos, now),
        "peticoes_por_status": peticoes_por_status(peticoes),
        "produtividade": produtividade_resumo(time_entries, productivity_goals, now),
    }
