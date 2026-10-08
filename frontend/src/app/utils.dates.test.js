/* global process */
// Fuso do escritório: datas "YYYY-MM-DD" não podem virar o dia anterior (UTC-3).
process.env.TZ = 'America/Sao_Paulo';

import { describe, expect, it } from 'vitest';

import { formatDate, formatRelativeDue, getStatusTone, isFinishedTask, isSameDay, startOfDay } from './utils';

describe('datas de calendário (YYYY-MM-DD) em UTC-3', () => {
  it('startOfDay mantém o dia', () => {
    expect(startOfDay('2026-10-08').getDate()).toBe(8);
  });

  it('isSameDay compara com o dia local', () => {
    expect(isSameDay('2026-10-08', new Date(2026, 9, 8, 9, 30))).toBe(true);
    expect(isSameDay('2026-10-08', new Date(2026, 9, 7, 23, 0))).toBe(false);
  });

  it('formatDate não recua um dia', () => {
    expect(formatDate('2026-10-08')).toBe('08/10/2026');
  });

  it('formatRelativeDue: hoje / amanhã / atrasado', () => {
    const today = new Date(2026, 9, 8, 15, 0);
    expect(formatRelativeDue('2026-10-08', today)).toEqual({ days: 0, label: 'Hoje' });
    expect(formatRelativeDue('2026-10-09', today)).toEqual({ days: 1, label: 'Amanhã' });
    expect(formatRelativeDue('2026-10-07', today)).toEqual({ days: -1, label: 'Atrasado 1 dia' });
  });
});

describe('getStatusTone com item concluído', () => {
  it.each([
    ['Pago', true, 'success'],
    ['Compareceu', true, 'success'],
    ['Protocolado', true, 'success'],
    ['Pendente', false, 'subtle'],
    ['Concluído', true, 'subtle'],
  ])('%s (completed=%s) -> %s', (status, completed, tone) => {
    expect(getStatusTone(status, completed)).toBe(tone);
  });
});

describe('isFinishedTask', () => {
  it('trata status finais como encerrados mesmo sem a flag', () => {
    expect(isFinishedTask({ status: 'Protocolado', completed: false })).toBe(true);
    expect(isFinishedTask({ status: 'Cancelado' })).toBe(true);
    expect(isFinishedTask({ status: 'Pendente', completed: false })).toBe(false);
  });
});
