import { formatDateTimeInput } from '../utils';

export const EMPTY_FORM = {
  title: '',
  meetingAt: '',
  clientId: '',
};

export function statusTone(status) {
  if (status === 'concluida') {
    return 'success';
  }
  if (status === 'falhou') {
    return 'danger';
  }
  return 'gold';
}

// Etapas do processamento de uma gravação, na ordem do backend
// (meetings.models.Gravacao.Status). "falhou" é tratado à parte.
export const PROCESSING_STEPS = [
  { key: 'enviada', label: 'Enviada' },
  { key: 'transcribindo', label: 'Transcrevendo' },
  { key: 'resumindo', label: 'Resumindo' },
  { key: 'concluida', label: 'Concluída' },
];

export function formatDateTime(value) {
  if (!value) {
    return 'Sem data definida';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function errorText(error) {
  return error instanceof Error ? error.message : 'Falha ao comunicar com a API.';
}

export function meetingToForm(meeting) {
  if (!meeting) {
    return EMPTY_FORM;
  }

  return {
    title: meeting.title || '',
    meetingAt: formatDateTimeInput(meeting.meetingAt),
    clientId: meeting.clientId || '',
  };
}

const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "dd MMM" (ex.: "10 out"); vazio quando não há data.
export function formatShortDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${String(date.getDate()).padStart(2, '0')} ${SHORT_MONTHS[date.getMonth()]}`;
}

// "4,2 MB" / "120 KB"; vazio quando não há tamanho.
export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

// Status exibido na lista de reuniões (ponto + texto).
// tone: warn | danger | success | neutral — mapeado para tokens no componente.
export function meetingListStatus(meeting) {
  const recordings = meeting?.recordings || [];
  if (recordings.some((recording) => recording.status === 'falhou')) {
    return { label: 'Falha na transcrição', tone: 'danger' };
  }
  if (recordings.some((recording) => recording.status !== 'concluida' && recording.status !== 'falhou')) {
    return { label: 'Processando', tone: 'warn' };
  }
  if (meeting?.summary) {
    return { label: 'Ata pronta', tone: 'success' };
  }
  return { label: 'Rascunho', tone: 'neutral' };
}

// Frase amigável para o erro cru devolvido pela API de transcrição.
export function friendlyProcessingError(error) {
  const text = String(error || '').toLowerCase();
  if (text.includes('401') || text.includes('invalid_api_key')) {
    return 'A chave da API de transcrição é inválida. Atualize-a em Configurações › Integrações.';
  }
  if (text.includes('413')) {
    return 'O arquivo de áudio é grande demais para ser transcrito. Envie um trecho menor.';
  }
  if (text.includes('timeout')) {
    return 'A transcrição demorou mais que o esperado. Tente novamente em instantes.';
  }
  return 'Ocorreu um erro ao processar o áudio.';
}
