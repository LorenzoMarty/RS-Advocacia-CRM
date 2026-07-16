import { DEADLINE_STATUS_COLUMNS } from '../data';
import { normalizeText } from '../utils';

export const DEADLINE_DEFAULT_STATUS = DEADLINE_STATUS_COLUMNS[0].label;

export function dateInputValue(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return dateInputValue();
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function dateFromInput(value) {
  return value ? new Date(`${value}T12:00:00`) : null;
}

export function deadlineMoment(deadline) {
  return dateFromInput(deadline.date) || new Date();
}

export function elapsedSecondsForDeadline(deadline, currentTime = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor(Number(deadline?.elapsedSeconds) || 0));

  if (!deadline?.timerStartedAt) {
    return elapsedSeconds;
  }

  const startedAt = new Date(deadline.timerStartedAt).getTime();

  if (Number.isNaN(startedAt)) {
    return elapsedSeconds;
  }

  return elapsedSeconds + Math.max(0, Math.floor((currentTime - startedAt) / 1000));
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function buildDeadlineTitle(process, responsible) {
  const processNumber = process?.number || '';
  const responsibleName = responsible.trim();

  if (!processNumber && !responsibleName) {
    return '';
  }

  return `${processNumber || 'Processo'} - ${responsibleName || 'Responsável'}`;
}

export function deadlineColumnKey(deadline) {
  const status = normalizeText(deadline.status);

  if (deadline.completed || status.includes('protocolado') || status.includes('conclu')) {
    return 'protocolado';
  }

  if (status.includes('protocolar')) {
    return 'protocolar';
  }

  if (status.includes('andamento')) {
    return 'em_andamento';
  }

  return 'a_fazer';
}

export function deadlineStatusLabel(deadline) {
  return DEADLINE_STATUS_COLUMNS.find((column) => column.key === deadlineColumnKey(deadline))?.label
    || DEADLINE_DEFAULT_STATUS;
}

export function deadlineCreatePath(selectedDate) {
  const params = new URLSearchParams({
    data: selectedDate || dateInputValue(),
  });

  return `/prazos/novo?${params.toString()}`;
}
