import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, errorMessageFromPayload } from './api';

// ---------------------------------------------------------------------------
// errorMessageFromPayload
// ---------------------------------------------------------------------------

describe('errorMessageFromPayload', () => {
  it('returns string error as-is', () => {
    expect(errorMessageFromPayload({ erros: 'Email inválido.' }, 400)).toBe('Email inválido.');
  });

  it('joins array errors', () => {
    expect(errorMessageFromPayload({ erros: ['Campo A.', 'Campo B.'] }, 400)).toBe('Campo A. Campo B.');
  });

  it('formats object errors — detalhe key is printed without prefix', () => {
    expect(errorMessageFromPayload({ erros: { detalhe: 'Sem permissão.' } }, 403)).toBe('Sem permissão.');
  });

  it('formats object errors — other keys get field prefix', () => {
    expect(errorMessageFromPayload({ erros: { email: ['Já em uso.'] } }, 400)).toBe('email: Já em uso.');
  });

  it('falls back to generic message when no erros key', () => {
    expect(errorMessageFromPayload({}, 500)).toBe('Falha na API (500).');
  });

  it('falls back to generic message for 500 with empty payload', () => {
    expect(errorMessageFromPayload({}, 502)).toBe('Falha na API (502).');
  });
});

// ---------------------------------------------------------------------------
// apiRequest — network errors and timeout
// ---------------------------------------------------------------------------

describe('apiRequest — network errors', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { cookie: 'csrftoken=test-csrf' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws Portuguese message on TypeError (offline / CORS)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(
      apiRequest('/api/clientes/', {}, { baseUrl: 'http://localhost:8000/api', requireConfiguredApi: false }),
    ).rejects.toThrow('Sem conexão com o servidor. Verifique sua internet e tente novamente.');
  });

  it('throws timeout message on AbortError', async () => {
    const abortError = new DOMException('The user aborted a request.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(
      apiRequest('/api/clientes/', {}, { baseUrl: 'http://localhost:8000/api', requireConfiguredApi: false }),
    ).rejects.toThrow('A requisição demorou demais. Tente novamente.');
  });

  it('re-throws unknown errors unchanged', async () => {
    const boom = new Error('Unknown internal error');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(boom));

    await expect(
      apiRequest('/api/clientes/', {}, { baseUrl: 'http://localhost:8000/api', requireConfiguredApi: false }),
    ).rejects.toThrow('Unknown internal error');
  });

  it('throws API error message from payload on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ sucesso: false, erros: 'Sem permissão.' }),
    }));

    await expect(
      apiRequest('/api/clientes/', {}, { baseUrl: 'http://localhost:8000/api', requireConfiguredApi: false }),
    ).rejects.toThrow('Sem permissão.');
  });

  it('returns dados on successful response with envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sucesso: true, dados: { id: '1', nome: 'Cliente' } }),
    }));

    const result = await apiRequest('/api/clientes/1/', {}, {
      baseUrl: 'http://localhost:8000/api',
      requireConfiguredApi: false,
    });

    expect(result).toEqual({ id: '1', nome: 'Cliente' });
  });
});
