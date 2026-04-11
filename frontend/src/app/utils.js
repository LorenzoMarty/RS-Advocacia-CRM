export function normalizeText(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return `${formatDate(value)} ${formatTime(value)}`;
}

export function formatDateTimeInput(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

export function parseDateTimeInput(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toISOString();
}

export function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameDay(left, right) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

export function formatCount(total, singular = 'registro', plural = 'registros') {
  return `${total} ${total === 1 ? singular : plural}`;
}

export function formatDocument(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 14);

  if (digits.length > 11) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function documentLabel(value) {
  return (value || '').replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF';
}

export function stripDocument(value) {
  return (value || '').replace(/\D/g, '').slice(0, 14);
}

export function getClientTypeLabel(type) {
  return type === 'mensalista' ? 'Mensalista' : 'Esporádico';
}

export function getStatusTone(value, completed = false) {
  const normalized = normalizeText(value);

  if (completed || normalized.includes('conclu')) return 'success';
  if (normalized.includes('cancel') || normalized.includes('atras') || normalized.includes('urg')) return 'danger';
  if (normalized.includes('aguard') || normalized.includes('penden') || normalized.includes('media')) return 'warn';
  return 'gold';
}

export function getEventTypeKey(value) {
  const normalized = normalizeText(value);
  if (normalized.includes('audien')) return 'audiencia';
  if (normalized.includes('reun')) return 'reuniao';
  if (normalized.includes('prazo')) return 'prazo';
  return 'tarefa';
}

export function isOverdueEvent(event) {
  return new Date(event.end) < new Date() && !event.completed && !normalizeText(event.status).includes('conclu');
}

export function buildSearchText(parts) {
  return normalizeText(parts.filter(Boolean).join(' '));
}
