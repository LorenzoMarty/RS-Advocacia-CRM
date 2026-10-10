import { describe, expect, it } from 'vitest';

import { formatBytes, friendlyProcessingError, meetingListStatus } from './meetings-utils';

describe('meetingListStatus', () => {
  it('prioriza falha, depois processamento, depois ata pronta', () => {
    expect(meetingListStatus({ recordings: [{ status: 'falhou' }, { status: 'enviada' }] }).tone).toBe('danger');
    expect(meetingListStatus({ recordings: [{ status: 'transcribindo' }] }).tone).toBe('warn');
    expect(meetingListStatus({ recordings: [{ status: 'concluida' }], summary: 'ok' }).label).toBe('Ata pronta');
    expect(meetingListStatus({ recordings: [] }).label).toBe('Rascunho');
  });
});

describe('friendlyProcessingError', () => {
  it('traduz erros conhecidos e cai no genérico', () => {
    expect(friendlyProcessingError('Error code: 401 invalid_api_key')).toMatch(/chave da API/);
    expect(friendlyProcessingError('413 Payload Too Large')).toMatch(/grande demais/);
    expect(friendlyProcessingError('read timeout')).toMatch(/demorou/);
    expect(friendlyProcessingError('boom')).toBe('Ocorreu um erro ao processar o áudio.');
  });
});

describe('formatBytes', () => {
  it('formata MB com vírgula e ignora vazio', () => {
    expect(formatBytes(4_404_019)).toBe('4,2 MB');
    expect(formatBytes(0)).toBe('');
  });
});
