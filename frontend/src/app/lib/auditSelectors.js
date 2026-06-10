// Pure aggregation + prioritization helpers for the Auditoria dashboard.
// No React, no store access — everything takes plain arrays so it stays testable
// and reusable. UI components call these via useMemo.

const DAY_MS = 24 * 3600 * 1000;
const INACTIVE_PROCESS_STATUSES = new Set(['Arquivado', 'Concluído']);
const STALE_DAYS = 30;

export function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function groupByKey(items, keyFn) {
  return items.reduce((acc, item) => {
    const k = keyFn(item);
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
}

// Deadlines store dates as 'YYYY-MM-DD'; anchor at noon to dodge timezone drift.
export function deadlineDate(deadline) {
  if (!deadline?.date) return null;
  const d = new Date(`${deadline.date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntil(date, from = startOfToday()) {
  if (!date) return null;
  return Math.round((date.getTime() - from.getTime()) / DAY_MS);
}

export function classifyDeadline(deadline, today = startOfToday()) {
  if (deadline.completed) return null;
  const date = deadlineDate(deadline);
  if (!date) return null;
  const diff = daysUntil(date, today);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon3';
  if (diff <= 7) return 'soon7';
  return 'later';
}

export function isActiveProcess(process) {
  return !INACTIVE_PROCESS_STATUSES.has(process.status);
}

export function staleProcesses(processes, { days = STALE_DAYS, now = new Date() } = {}) {
  const cutoff = now.getTime() - days * DAY_MS;
  return processes.filter((p) => {
    if (!isActiveProcess(p)) return false;
    if (!p.lastMovementAt) return true; // never moved → treat as stale
    const moved = new Date(p.lastMovementAt).getTime();
    return Number.isNaN(moved) ? true : moved < cutoff;
  });
}

// --- Risk summary -----------------------------------------------------------

export function buildRiskSummary(processes, deadlines, timeEntries, clients, today = startOfToday()) {
  const active = processes.filter(isActiveProcess);
  let overdue = 0;
  let dueSoon = 0; // today..+7d
  deadlines.forEach((d) => {
    const bucket = classifyDeadline(d, today);
    if (bucket === 'overdue') overdue += 1;
    else if (bucket === 'today' || bucket === 'soon3' || bucket === 'soon7') dueSoon += 1;
  });
  const stale = staleProcesses(processes).length;
  const processClientIds = new Set(processes.map((p) => p.clientId));
  const clientsWithoutProcess = clients.filter((c) => !processClientIds.has(c.id)).length;
  const runningTimers = timeEntries.filter((e) => e.status === 'running').length;

  return {
    activeProcesses: active.length,
    overdue,
    dueSoon,
    stale,
    clientsWithoutProcess,
    runningTimers,
  };
}

export function computeRiskScore(summary) {
  const raw = summary.overdue * 12
    + summary.dueSoon * 4
    + summary.stale * 5;
  const score = Math.min(100, raw);
  let level = 'healthy';
  let label = 'Saudável';
  if (score >= 66) {
    level = 'critical';
    label = 'Crítico';
  } else if (score >= 33) {
    level = 'warning';
    label = 'Atenção';
  }

  const drivers = [
    { key: 'overdue', label: 'Prazos vencidos', value: summary.overdue, weight: summary.overdue * 12 },
    { key: 'stale', label: 'Processos parados', value: summary.stale, weight: summary.stale * 5 },
    { key: 'dueSoon', label: 'Vencendo em 7 dias', value: summary.dueSoon, weight: summary.dueSoon * 4 },
  ]
    .filter((d) => d.value > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  return { score, level, label, drivers };
}

// --- Priority actions -------------------------------------------------------

const DEADLINE_SEVERITY = {
  overdue: 90,
  today: 75,
  soon3: 60,
  soon7: 45,
};

export function severityTone(severity) {
  if (severity >= 75) return 'danger';
  if (severity >= 45) return 'warn';
  return 'gold';
}

function suggestDeadlineAction(bucket, hasResponsible) {
  if (!hasResponsible) return 'Atribuir responsável';
  if (bucket === 'overdue') return 'Resolver agora';
  if (bucket === 'today') return 'Protocolar hoje';
  return 'Preparar protocolo';
}

export function buildPriorityActions(deadlines, processes, today = startOfToday(), limit = 5) {
  const actions = [];

  deadlines.forEach((d) => {
    const bucket = classifyDeadline(d, today);
    if (!bucket || bucket === 'later') return;
    const hasResponsible = Boolean(d.responsible);
    let severity = DEADLINE_SEVERITY[bucket] || 0;
    if (bucket === 'overdue' && !hasResponsible) severity = 100;
    actions.push({
      id: `deadline-${d.id}`,
      kind: 'deadline',
      title: d.title || 'Prazo',
      responsible: d.responsible || 'Sem responsável',
      date: deadlineDate(d),
      severity,
      tone: severityTone(severity),
      action: suggestDeadlineAction(bucket, hasResponsible),
      to: `/prazos/${d.id}`,
    });
  });

  staleProcesses(processes).forEach((p) => {
    const hasOwner = Boolean(p.owner);
    const severity = hasOwner ? 40 : 50;
    actions.push({
      id: `process-${p.id}`,
      kind: 'process',
      title: p.number || p.clientName || 'Processo',
      responsible: p.owner || 'Sem responsável',
      date: null,
      severity,
      tone: severityTone(severity),
      action: hasOwner ? 'Revisar processo parado' : 'Atribuir responsável',
      to: `/processos/${p.id}`,
    });
  });

  return actions.sort((a, b) => b.severity - a.severity).slice(0, limit);
}

// --- Distributions ----------------------------------------------------------

export function rankByCount(items, keyFn, fallback = 'Sem responsável') {
  const groups = groupByKey(items, (item) => keyFn(item) || fallback);
  return Object.entries(groups)
    .map(([name, group]) => ({ name, count: group.length }))
    .sort((a, b) => b.count - a.count);
}

export function statusDistribution(processes) {
  return rankByCount(processes, (p) => p.status, 'Sem status')
    .map(({ name, count }) => ({ status: name, count }));
}

// --- Auto insights ----------------------------------------------------------

// Lightweight textual reading of the office state. Derives overload/unassigned
// straight from the pending deadlines so it stays useful without the heavier
// workload/heatmap panels.
export function buildInsights(summary, deadlines, today = startOfToday()) {
  const insights = [];
  const pending = deadlines.filter((d) => classifyDeadline(d, today));

  if (summary.overdue > 0) {
    insights.push({
      tone: 'danger',
      text: `${summary.overdue} prazo${summary.overdue !== 1 ? 's' : ''} vencido${summary.overdue !== 1 ? 's' : ''} — priorize hoje.`,
    });
  }
  if (summary.stale > 0) {
    insights.push({
      tone: 'warn',
      text: `${summary.stale} processo${summary.stale !== 1 ? 's' : ''} sem movimentação há +30 dias.`,
    });
  }
  const top = rankByCount(pending, (d) => d.responsible)[0];
  if (top && top.name !== 'Sem responsável' && top.count >= 5) {
    insights.push({
      tone: 'warn',
      text: `${top.name} concentra ${top.count} pendências — possível sobrecarga.`,
    });
  }
  const unassigned = pending.filter((d) => !d.responsible).length;
  if (unassigned > 0) {
    insights.push({
      tone: 'warn',
      text: `${unassigned} prazo${unassigned !== 1 ? 's' : ''} sem responsável atribuído.`,
    });
  }
  if (summary.clientsWithoutProcess > 0) {
    insights.push({
      tone: 'gold',
      text: `${summary.clientsWithoutProcess} cliente${summary.clientsWithoutProcess !== 1 ? 's' : ''} sem processo vinculado.`,
    });
  }
  if (!insights.length) {
    insights.push({ tone: 'success', text: 'Nenhum risco relevante. Operação saudável.' });
  }
  return insights;
}
