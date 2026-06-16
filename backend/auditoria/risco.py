"""Domain constants for the audit risk panel.

Single source of truth for the weights, thresholds and labels that drive the
Auditoria dashboard. Kept here (not in settings) because these are business
rules, not deployment config. Ported 1:1 from the former frontend
``auditSelectors.js`` so the computed numbers stay identical.
"""

# Processes in these statuses are considered closed and excluded from the
# "active"/"stale" counts.
INACTIVE_PROCESS_STATUSES = {"Arquivado", "Concluído"}

# A process with no movement for this many days counts as "stale".
STALE_DAYS = 30

# Risk score = overdue * 12 + dueSoon * 4 + stale * 5, capped at 100.
RISK_WEIGHTS = {"overdue": 12, "dueSoon": 4, "stale": 5}

# Score thresholds, evaluated top-down; below all of them → healthy.
RISK_LEVELS = (
    (66, "critical", "Crítico"),
    (33, "warning", "Atenção"),
)
RISK_LEVEL_HEALTHY = ("healthy", "Saudável")

# Labels shown for each risk driver in the score card.
DRIVER_LABELS = {
    "overdue": "Prazos vencidos",
    "stale": "Processos parados",
    "dueSoon": "Vencendo em 7 dias",
}

# Severity (0-100) assigned to each deadline bucket in the priority list.
DEADLINE_SEVERITY = {
    "overdue": 90,
    "today": 75,
    "soon3": 60,
    "soon7": 45,
}

# Severity for a stale process, depending on whether it has an owner.
PROCESS_SEVERITY = {"with_owner": 40, "without_owner": 50}

# Severity → tone thresholds (>= danger, >= warn, else gold).
SEVERITY_TONE = ((75, "danger"), (45, "warn"))
SEVERITY_TONE_DEFAULT = "gold"

# How many priority actions to surface.
PRIORITY_LIMIT = 5
