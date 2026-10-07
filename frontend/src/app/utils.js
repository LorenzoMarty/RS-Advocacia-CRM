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
  if (Number.isNaN(date.getTime())) {
    return '';
  }

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

// "Hoje" / "Amanhã" / "Em N dias" / "Atrasado N dias" + dias de diferença (negativo = vencido).
export function formatRelativeDue(value, today = new Date()) {
  const days = Math.round((startOfDay(value) - startOfDay(today)) / 86400000);
  let label;
  if (days === 0) label = 'Hoje';
  else if (days === 1) label = 'Amanhã';
  else if (days > 1) label = `Em ${days} dias`;
  else label = days === -1 ? 'Atrasado 1 dia' : `Atrasado ${-days} dias`;
  return { days, label };
}

const AREA_KEYS = { civel: 'civel', trabalhista: 'trabalhista', empresarial: 'empresarial', tributario: 'tributario' };

// Área do direito -> sufixo dos tokens --cat-* (null se não for uma das 4 conhecidas).
export function getAreaKey(area) {
  return AREA_KEYS[normalizeText(area)] || null;
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

export function formatPhone(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function stripPhone(value) {
  return (value || '').replace(/\D/g, '').slice(0, 11);
}

export function getClientTypeLabel(type) {
  return type === 'mensalista' ? 'Mensalista' : 'Esporádico';
}

export function getStatusTone(value, completed = false) {
  const normalized = normalizeText(value);

  // Single source of truth for status/priority colour: danger | warn | success | info | subtle | neutral.
  if (completed || normalized.includes('conclu') || normalized.includes('cancel')) return 'subtle';
  // "nao compareceu" must be checked before "compareceu" (substring match order)
  const words = normalized.split(/\s+/);
  if (normalized.includes('nao compareceu') || normalized.includes('atras') || normalized.includes('urg') || words.includes('alta')) return 'danger';
  if (normalized.includes('confirma') || normalized.includes('compareceu') || normalized.includes('protocolado') || words.includes('ativo')) return 'success';
  if (normalized.includes('andamento')) return 'info';
  if (normalized.includes('aguard') || normalized.includes('protocolar') || words.includes('media')) return 'warn';
  if (words.includes('baixa')) return 'neutral';
  return 'subtle';
}

export function getEventTypeKey(value) {
  const normalized = normalizeText(value);
  if (normalized.includes('audien')) return 'audiencia';
  if (normalized.includes('reun')) return 'reuniao';
  return 'tarefa';
}

export function isOverdueEvent(event) {
  const normalized = normalizeText(event.status);
  const isClosed = normalized.includes('conclu')
    || normalized.includes('cancel')
    || normalized.includes('adiad')
    || normalized.includes('compareceu');
  return new Date(event.end) < new Date() && !event.completed && !isClosed;
}

export function buildSearchText(parts) {
  return normalizeText(parts.filter(Boolean).join(' '));
}
