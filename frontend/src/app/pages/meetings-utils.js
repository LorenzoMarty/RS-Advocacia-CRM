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
