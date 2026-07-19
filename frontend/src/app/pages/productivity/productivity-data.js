// Helpers de formatação e agregação do dashboard de produtividade.
// Mantém a derivação fora dos componentes para que demo (store) e API
// produzam exatamente o mesmo shape consumido pela UI.

import {
  belongsToUser,
  isDeadlineDone,
  isEventAttended,
  isPetitionDone,
} from '../../productivity-utils';

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

// Total de tempo logado numa tarefa (soma de todos os time entries dela).
// Usado para liberar o retorno a "Pendente" só quando o contador é 0:00.
export function taskLoggedSeconds(timeEntries, taskId, taskType, currentTime = Date.now()) {
  return (timeEntries || []).reduce((total, entry) => {
    if (String(entry.taskId) !== String(taskId) || entry.taskType !== taskType) {
      return total;
    }
    return total + timeEntryElapsedSeconds(entry, currentTime);
  }, 0);
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

function entryReferenceDate(entry) {
  return entry?.endedAt || entry?.startedAt || null;
}

export function isDateInRange(value, bounds) {
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
    (e) => matchUser(e.responsibleName) && isEventAttended(e, now) && isDateInRange(e.start, bounds),
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
