import { describe, expect, it } from 'vitest';

import { getStatusTone } from './utils';

describe('getStatusTone', () => {
  it.each([
    ['Pendente', 'subtle'],
    ['Em andamento', 'info'],
    ['Aguardando', 'warn'],
    ['Protocolar', 'warn'],
    ['Protocolado', 'success'],
    ['Ativo', 'success'],
    ['Inativo', 'subtle'],
    ['Concluído', 'subtle'],
    ['Cancelado', 'subtle'],
    ['Atrasado', 'danger'],
    ['Não compareceu', 'danger'],
    ['Compareceu', 'success'],
    ['Alta', 'danger'],
    ['Média', 'warn'],
    ['Baixa', 'neutral'],
    ['Falta', 'subtle'],
  ])('%s -> %s', (status, tone) => {
    expect(getStatusTone(status)).toBe(tone);
  });

  it('treats completed items as subtle regardless of label', () => {
    expect(getStatusTone('Atrasado', true)).toBe('subtle');
  });
});
