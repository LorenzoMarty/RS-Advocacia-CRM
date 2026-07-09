"""Audit risk panel computation.

Pure functions that turn the office's processes/deadlines/clients/timers into the
panel payload (risk score, KPI summary, priority actions, status distribution).
Ported faithfully from the former frontend ``auditSelectors.js`` — same weights,
buckets and ordering — so behaviour is preserved after moving it server-side.
"""

from datetime import timedelta

from django.utils import timezone

from auditoria import risco


def classify_deadline(prazo, today):
    """Bucket a deadline by urgency, or None if it shouldn't be counted."""
    if prazo.concluido:
        return None
    if not prazo.data_limite:
        return None
    diff = (prazo.data_limite - today).days
    if diff < 0:
        return "overdue"
    if diff == 0:
        return "today"
    if diff <= 3:
        return "soon3"
    if diff <= 7:
        return "soon7"
    return "later"


def is_active_process(processo):
    return processo.status not in risco.INACTIVE_PROCESS_STATUSES


def stale_processes(processos, now):
    """Active processes untouched for STALE_DAYS (data_ultima_movimentacao is auto_now)."""
    cutoff = now - timedelta(days=risco.STALE_DAYS)
    stale = []
    for processo in processos:
        if not is_active_process(processo):
            continue
        moved = processo.data_ultima_movimentacao
        if moved is None or moved < cutoff:
            stale.append(processo)
    return stale


def build_risk_summary(processos, prazos, clientes, running_timers, today, now):
    overdue = 0
    due_soon = 0  # today..+7d
    for prazo in prazos:
        bucket = classify_deadline(prazo, today)
        if bucket == "overdue":
            overdue += 1
        elif bucket in ("today", "soon3", "soon7"):
            due_soon += 1

    active = [p for p in processos if is_active_process(p)]
    stale = len(stale_processes(processos, now))
    process_client_ids = {p.cliente_id for p in processos}
    clients_without_process = sum(1 for c in clientes if c.id not in process_client_ids)

    return {
        "active_processes": len(active),
        "overdue": overdue,
        "due_soon": due_soon,
        "stale": stale,
        "clients_without_process": clients_without_process,
        "running_timers": running_timers,
    }


def compute_risk_score(summary):
    raw = (
        summary["overdue"] * risco.RISK_WEIGHTS["overdue"]
        + summary["due_soon"] * risco.RISK_WEIGHTS["dueSoon"]
        + summary["stale"] * risco.RISK_WEIGHTS["stale"]
    )
    score = min(100, raw)

    level, label = risco.RISK_LEVEL_HEALTHY
    for threshold, lvl, lbl in risco.RISK_LEVELS:
        if score >= threshold:
            level, label = lvl, lbl
            break

    candidates = [
        ("overdue", summary["overdue"], risco.RISK_WEIGHTS["overdue"]),
        ("stale", summary["stale"], risco.RISK_WEIGHTS["stale"]),
        ("dueSoon", summary["due_soon"], risco.RISK_WEIGHTS["dueSoon"]),
    ]
    drivers = [
        {
            "key": key,
            "label": risco.DRIVER_LABELS[key],
            "value": value,
            "weight": value * weight,
        }
        for key, value, weight in candidates
        if value > 0
    ]
    drivers.sort(key=lambda d: d["weight"], reverse=True)

    return {"score": score, "level": level, "label": label, "drivers": drivers[:3]}


def severity_tone(severity):
    for threshold, tone in risco.SEVERITY_TONE:
        if severity >= threshold:
            return tone
    return risco.SEVERITY_TONE_DEFAULT


def _suggest_deadline_action(bucket, has_responsible):
    if not has_responsible:
        return "Atribuir responsável"
    if bucket == "overdue":
        return "Resolver agora"
    if bucket == "today":
        return "Protocolar hoje"
    return "Preparar protocolo"


def build_priority_actions(prazos, processos, today, now, periodo):
    """Top items by severity within the selected horizon (overdue always kept)."""
    actions = []

    for prazo in prazos:
        bucket = classify_deadline(prazo, today)
        if not bucket or bucket == "later":
            continue
        # Horizon filter: vencidos sempre entram; demais só dentro do período.
        if periodo and bucket != "overdue":
            if (prazo.data_limite - today).days > periodo:
                continue
        has_responsible = bool(prazo.responsavel)
        severity = risco.DEADLINE_SEVERITY.get(bucket, 0)
        if bucket == "overdue" and not has_responsible:
            severity = 100
        actions.append(
            {
                "id": f"deadline-{prazo.id}",
                "kind": "deadline",
                "title": prazo.titulo or "Prazo",
                "responsible": prazo.responsavel.nome if prazo.responsavel_id else "Sem responsável",
                "date": prazo.data_limite.isoformat() if prazo.data_limite else None,
                "severity": severity,
                "tone": severity_tone(severity),
                "action": _suggest_deadline_action(bucket, has_responsible),
                "to": f"/prazos/{prazo.id}",
            }
        )

    for processo in stale_processes(processos, now):
        has_owner = bool(processo.advogado_responsavel)
        severity = (
            risco.PROCESS_SEVERITY["with_owner"]
            if has_owner
            else risco.PROCESS_SEVERITY["without_owner"]
        )
        title = (
            processo.numero_processo
            or getattr(processo.cliente, "nome", "")
            or "Processo"
        )
        actions.append(
            {
                "id": f"process-{processo.id}",
                "kind": "process",
                "title": title,
                "responsible": (
                    processo.advogado_responsavel.nome
                    if processo.advogado_responsavel_id
                    else "Sem responsável"
                ),
                "date": None,
                "severity": severity,
                "tone": severity_tone(severity),
                "action": (
                    "Revisar processo parado" if has_owner else "Atribuir responsável"
                ),
                "to": f"/processos/{processo.id}",
            }
        )

    actions.sort(key=lambda a: a["severity"], reverse=True)
    return actions[: risco.PRIORITY_LIMIT]


def status_distribution(processos):
    counts = {}
    for processo in processos:
        status = processo.status or "Sem status"
        counts[status] = counts.get(status, 0) + 1
    items = [{"status": status, "count": count} for status, count in counts.items()]
    items.sort(key=lambda item: item["count"], reverse=True)
    return items


def build_panel(
    processos, prazos, clientes, running_timers, periodo, today=None, now=None
):
    """Assemble the full panel payload. `processos`/`prazos`/`clientes` are lists."""
    if today is None:
        today = timezone.localdate()
    if now is None:
        now = timezone.now()

    summary = build_risk_summary(
        processos, prazos, clientes, running_timers, today, now
    )
    return {
        "periodo": periodo,
        "risk": compute_risk_score(summary),
        "summary": summary,
        "priority_actions": build_priority_actions(
            prazos, processos, today, now, periodo
        ),
        "status_distribution": status_distribution(processos),
    }
