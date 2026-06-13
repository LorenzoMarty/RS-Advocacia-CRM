// Helpers de formatação e agregação do dashboard de produtividade.
// Mantém a derivação fora dos componentes para que demo (store) e API
// produzam exatamente o mesmo shape consumido pela UI.

import {
  belongsToUser,
  formatTimerSeconds,
  isDeadlineDone,
  isEventAttended,
  isPetitionDone,
} from '../../productivity-utils';

export { formatTimerSeconds };

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function formatHoursCompact(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (!hours && !minutes) {
    return '0h';
  }
  return `${hours ? `${hours}h` : ''}${hours && minutes ? ' ' : ''}${minutes ? `${minutes}m` : ''}`;
}

export function formatMinutes(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${Math.round(safe / 60)} min`;
}

export function timeEntryElapsedSeconds(entry, currentTime = Date.now()) {
  const totalSeconds = Math.max(0, Math.floor(Number(entry?.totalSeconds) || 0));
  if (entry?.status !== 'running') {
    return totalSeconds;
  }
  const baseTime = new Date(entry.resumedAt || entry.startedAt).getTime();
  if (Number.isNaN(baseTime)) {
    return totalSeconds;
  }
  return totalSeconds + Math.max(0, Math.floor((currentTime - baseTime) / 1000));
}

// ---------------------------------------------------------------------------
// Rótulos de tarefa / status
// ---------------------------------------------------------------------------

export function taskTypeLabel(type) {
  if (type === 'prazo') return 'Prazo';
  if (type === 'contestacao') return 'Contestação';
  return 'Petição';
}

export function taskTypeIcon(type) {
  if (type === 'prazo') return 'P';
  if (type === 'contestacao') return 'C';
  return 'Pç';
}

const TYPE_COLOR = {
  prazo: 'var(--chart-1)',
  peticao: 'var(--chart-2)',
  contestacao: 'var(--chart-3)',
};

export function taskTypeColor(type) {
  return TYPE_COLOR[type] || 'var(--chart-4)';
}

export const CHART_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function statusLabel(status) {
  if (status === 'running') return 'Rodando';
  if (status === 'paused') return 'Pausado';
  return 'Encerrado';
}

export function statusTone(status) {
  if (status === 'running') return 'success';
  if (status === 'paused') return 'warn';
  return 'muted';
}

// ---------------------------------------------------------------------------
// Datas / períodos
// ---------------------------------------------------------------------------

export function startOfDay(value = new Date()) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(value = new Date()) {
  const date = startOfDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  const day = date.getDay() || 7; // domingo=0 -> 7
  date.setDate(date.getDate() - day + 1); // segunda-feira
  return date;
}

export function startOfMonth(value = new Date()) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function dateInputValue(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function periodBounds(period, customStart, customEnd) {
  if (period === 'custom') {
    return {
      start: customStart ? startOfDay(`${customStart}T12:00:00`) : null,
      end: customEnd ? endOfDay(`${customEnd}T12:00:00`) : null,
    };
  }
  if (period === 'month') {
    return { start: startOfMonth(), end: new Date() };
  }
  return { start: startOfWeek(), end: new Date() };
}

// Período anterior de mesma duração, imediatamente antes do início.
export function previousBounds(bounds) {
  if (!bounds.start || !bounds.end) {
    return { start: null, end: null };
  }
  const duration = bounds.end.getTime() - bounds.start.getTime();
  const end = new Date(bounds.start.getTime());
  const start = new Date(bounds.start.getTime() - duration);
  return { start, end };
}

export function entryReferenceDate(entry) {
  return entry?.endedAt || entry?.startedAt || null;
}

function isDateInRange(value, bounds) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  if (bounds.start && time < bounds.start.getTime()) return false;
  if (bounds.end && time > bounds.end.getTime()) return false;
  return true;
}

export function isEntryInRange(entry, bounds) {
  return isDateInRange(entryReferenceDate(entry), bounds);
}

export function variationPercent(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Agregação (mesmo shape do endpoint /resumo/)
// ---------------------------------------------------------------------------

export function aggregateEntries(entries, now = Date.now()) {
  const byUser = new Map();
  const byType = new Map();
  const byProcess = new Map();
  const byTask = new Map();
  const byDay = new Map();
  let total = 0;

  for (const entry of entries) {
    const seconds = timeEntryElapsedSeconds(entry, now);
    total += seconds;

    const userKey = entry.userId || 'sem-usuario';
    const u = byUser.get(userKey) || { userId: entry.userId, userName: entry.userName || '', seconds: 0, count: 0 };
    u.seconds += seconds;
    u.count += 1;
    byUser.set(userKey, u);

    const t = byType.get(entry.taskType) || { taskType: entry.taskType, seconds: 0, count: 0 };
    t.seconds += seconds;
    t.count += 1;
    byType.set(entry.taskType, t);

    const procKey = entry.processId || entry.processNumber || 'sem-processo';
    const p = byProcess.get(procKey) || {
      key: procKey,
      processId: entry.processId || '',
      label: entry.processNumber || 'Sem processo',
      seconds: 0,
    };
    p.seconds += seconds;
    byProcess.set(procKey, p);

    const taskKey = `${entry.taskType}:${entry.taskId}`;
    const tk = byTask.get(taskKey) || {
      key: taskKey,
      taskId: entry.taskId,
      taskType: entry.taskType,
      label: entry.taskName || taskTypeLabel(entry.taskType),
      processNumber: entry.processNumber || '',
      seconds: 0,
      count: 0,
    };
    tk.seconds += seconds;
    tk.count += 1;
    if (!tk.processNumber && entry.processNumber) tk.processNumber = entry.processNumber;
    byTask.set(taskKey, tk);

    const ref = entryReferenceDate(entry);
    if (ref) {
      const dayKey = dateInputValue(ref);
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + seconds);
    }
  }

  const bySeconds = (a, b) => b.seconds - a.seconds;
  return {
    totalSeconds: total,
    byUser: [...byUser.values()].sort(bySeconds),
    byType: [...byType.values()].sort(bySeconds),
    byProcess: [...byProcess.values()].sort(bySeconds),
    byTask: [...byTask.values()].sort(bySeconds),
    byDay: [...byDay.entries()].map(([date, seconds]) => ({ date, seconds })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// Série contínua de dias dentro dos limites (preenche lacunas com 0).
export function buildDaySeries(bounds, byDay) {
  if (!bounds.start || !bounds.end) return [];
  const map = new Map(byDay.map((item) => [item.date, item.seconds]));
  const series = [];
  const cursor = startOfDay(bounds.start);
  const last = startOfDay(bounds.end);
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard < 370) {
    const key = dateInputValue(cursor);
    series.push({ date: key, seconds: map.get(key) || 0 });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return series;
}

// ---------------------------------------------------------------------------
// Entregas concluídas no período (a partir das coleções do store)
// ---------------------------------------------------------------------------

export function computeDeliverables(bounds, { deadlines, petitions, events, user = null, now = Date.now() }) {
  const matchUser = (responsible) => (user ? belongsToUser(responsible, user) : true);
  const doneDeadlines = deadlines.filter(
    (d) => matchUser(d.responsible) && isDeadlineDone(d)
      && isDateInRange(d.atualizado_em || d.updatedAt || d.date || d.criado_em, bounds),
  );
  const donePetitions = petitions.filter(
    (p) => matchUser(p.responsible) && isPetitionDone(p)
      && isDateInRange(p.atualizado_em || p.updatedAt || p.criado_em, bounds),
  );
  const attendedEvents = events.filter(
    (e) => matchUser(e.responsible) && isEventAttended(e, now) && isDateInRange(e.start, bounds),
  );
  return { doneDeadlines, donePetitions, attendedEvents };
}

export function isTaskDone(taskType, taskId, deadlines, petitions) {
  if (taskType === 'prazo') {
    const d = deadlines.find((item) => item.id === String(taskId));
    return d ? isDeadlineDone(d) : false;
  }
  const p = petitions.find((item) => item.id === String(taskId));
  return p ? isPetitionDone(p) : false;
}
