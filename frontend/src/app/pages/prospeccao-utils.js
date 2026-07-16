import { INTERACTION_TYPE_OPTIONS, PROSPECT_STATUS_COLUMNS } from '../data';
import { normalizeText } from '../utils';

export const STATUS_LABELS = PROSPECT_STATUS_COLUMNS.map((column) => column.label);

// O valor persistido ("Media", sem acento) é o enum aceito pelo backend
// (prospeccao/models.py PRIORIDADES) — mudar o valor exigiria migração de
// dados; aqui só corrigimos a exibição.
const PRIORITY_LABELS = { Media: 'Média' };

export function priorityLabel(priority) {
  return PRIORITY_LABELS[priority] || priority;
}

export function priorityTone(priority) {
  const normalized = normalizeText(priority);
  if (normalized.includes('alta')) return 'danger';
  if (normalized.includes('baixa')) return 'success';
  return 'warn';
}

export function todayIso() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function isThisMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

// Auditoria contextual: prazos ativos / críticos do responsável (por nome).
export function deadlineAuditFor(responsibleName, deadlines) {
  if (!responsibleName) {
    return { active: 0, critical: 0 };
  }
  const target = normalizeText(responsibleName);
  const today = todayIso();
  let active = 0;
  let critical = 0;
  deadlines.forEach((deadline) => {
    if (normalizeText(deadline.responsible) !== target || deadline.completed) {
      return;
    }
    active += 1;
    if (deadline.date && deadline.date < today) {
      critical += 1;
    }
  });
  return { active, critical };
}

export function interactionLabel(type) {
  return INTERACTION_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

export const STALE_DAYS = 7;
export const TERMINAL_STATUSES = ['Convertido', 'Perdido'];

export function daysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function idleLabel(days) {
  if (days == null) return 'sem contato registrado';
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

export function nextStatusOf(status) {
  const index = PROSPECT_STATUS_COLUMNS.findIndex((column) => column.label === status);
  if (index === -1) return null;
  return PROSPECT_STATUS_COLUMNS[index + 1]?.label || null;
}
