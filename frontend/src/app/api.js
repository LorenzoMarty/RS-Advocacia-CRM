const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';
const rawApiBaseUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const apiBaseUrl = (rawApiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

export const isApiEnabled = Boolean(apiBaseUrl);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function buildUrl(path, baseUrl = apiBaseUrl) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (baseUrl.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${baseUrl}${normalizedPath.slice(4)}`;
  }

  return `${baseUrl}${normalizedPath}`;
}

function apiUrl(path) {
  return buildUrl(path);
}

// Serializa params ignorando null/undefined/''; usado pelos endpoints
// paginados (clientes, processos, usuarios, auditoria).
function buildQuery(params = {}) {
  return new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== ''),
  ).toString();
}

function getCookie(name) {
  let cookieValue = '';

  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim();
      if (cookie.startsWith(`${name}=`)) {
        cookieValue = cookie.substring(name.length + 1);
        break;
      }
    }
  }

  return cookieValue;
}

async function ensureCsrfToken(baseUrl = apiBaseUrl) {
  const currentToken = getCookie('csrftoken');
  if (currentToken) {
    return currentToken;
  }

  const response = await fetch(buildUrl('/api/csrf/', baseUrl), {
    credentials: 'include',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(errorMessageFromPayload(payload, response.status));
  }

  return getCookie('csrftoken') || payload.dados?.csrf_token || payload.csrf_token || '';
}

export function errorMessageFromPayload(payload, status) {
  const error = payload.erros || `Falha na API (${status}).`;

  if (typeof error === 'string') {
    return error;
  }

  if (Array.isArray(error)) {
    return error.join(' ');
  }

  if (error && typeof error === 'object') {
    return Object.entries(error)
      .map(([field, messages]) => {
        const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
        return field === 'detalhe' ? text : `${field}: ${text}`;
      })
      .join(' ');
  }

  return String(error);
}

export async function apiRequest(
  path,
  options = {},
  { baseUrl = apiBaseUrl, requireConfiguredApi = true, timeoutMs = 30_000 } = {},
) {
  if (requireConfiguredApi && !baseUrl) {
    throw new Error('API não configurada. Defina VITE_API_URL.');
  }

  const method = (options.method || 'GET').toUpperCase();
  const csrfToken = SAFE_METHODS.has(method) ? '' : await ensureCsrfToken(baseUrl);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    Accept: 'application/json',
    ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(buildUrl(path, baseUrl), {
      ...options,
      method,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (networkError) {
    clearTimeout(timeoutId);
    if (networkError.name === 'AbortError') {
      throw new Error('A requisição demorou demais. Tente novamente.');
    }
    if (networkError instanceof TypeError) {
      throw new Error('Sem conexão com o servidor. Verifique sua internet e tente novamente.');
    }
    throw networkError;
  }
  clearTimeout(timeoutId);

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(errorMessageFromPayload(payload, response.status));
    error.status = response.status;
    throw error;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'sucesso')) {
    if (!payload.sucesso) {
      const error = new Error(errorMessageFromPayload(payload, response.status));
      error.status = response.status;
      throw error;
    }
    return payload.dados || {};
  }

  return payload;
}

function jsonOptions(method, payload) {
  return {
    method,
    body: JSON.stringify(payload),
  };
}

function eventRequest(path = '', options = {}) {
  return apiRequest(`/api/eventos/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

function deadlineRequest(path = '', options = {}) {
  return apiRequest(`/api/prazos/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

function petitionRequest(path = '', options = {}) {
  return apiRequest(`/api/peticoes/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

function productivityRequest(path = '', options = {}) {
  return apiRequest(`/api/produtividade/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

function prospeccaoRequest(path = '', options = {}) {
  return apiRequest(`/api/prospeccao/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

function financeiroRequest(path = '', options = {}) {
  return apiRequest(`/api/financeiro/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

function iaRequest(path = '', options = {}) {
  return apiRequest(`/api/ia/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

export const api = {
  carregarInicializacao: () => apiRequest('/api/inicializacao/'),
  obterUsuarioAtual: () => apiRequest('/api/usuarios/atual/'),
  urlLoginGoogle: () => apiUrl('/api/autenticacao/google'),
  urlReauthorizeGoogle: () => `${apiUrl('/api/autenticacao/google')}?next=/agenda`,
  sair: () => apiRequest('/api/autenticacao/sair/', { method: 'POST' }),
  listClients: (params = {}) => {
    const query = buildQuery(params);
    return apiRequest(`/api/clientes/${query ? `?${query}` : ''}`);
  },
  getClient: (id) => apiRequest(`/api/clientes/${id}/`),
  createClient: (payload) => apiRequest('/api/clientes/criar/', jsonOptions('POST', payload)),
  updateClient: (id, payload) => apiRequest(`/api/clientes/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteClient: (id) => apiRequest(`/api/clientes/${id}/excluir/`, { method: 'DELETE' }),
  listProcesses: (params = {}) => {
    const query = buildQuery(params);
    return apiRequest(`/api/processos/${query ? `?${query}` : ''}`);
  },
  getProcess: (id) => apiRequest(`/api/processos/${id}/`),
  createProcess: (payload) => apiRequest('/api/processos/criar/', jsonOptions('POST', payload)),
  updateProcess: (id, payload) => apiRequest(`/api/processos/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteProcess: (id) => apiRequest(`/api/processos/${id}/excluir/`, { method: 'DELETE' }),
  listEvents: () => eventRequest(),
  syncGoogleCalendar: () => apiRequest('/api/eventos/sincronizar/google/', { method: 'POST' }),
  listGoogleCalendars: () => apiRequest('/api/integracoes/google/calendarios/'),
  selectGoogleCalendars: (calendarios) => apiRequest(
    '/api/integracoes/google/calendarios/selecionar/',
    jsonOptions('PUT', { calendarios }),
  ),
  disconnectGoogle: () => apiRequest('/api/integracoes/google/desconectar/', { method: 'POST' }),
  getEvent: (id) => eventRequest(`${id}/`),
  createEvent: (payload) => eventRequest('criar/', jsonOptions('POST', payload)),
  updateEvent: (id, payload) => eventRequest(`${id}/editar/`, jsonOptions('PUT', payload)),
  patchEvent: (id, payload) => eventRequest(`${id}/editar/`, jsonOptions('PATCH', payload)),
  updateEventAttendance: (id, payload) => eventRequest(`${id}/comparecimento/`, jsonOptions('POST', payload)),
  deleteEvent: (id) => eventRequest(`${id}/excluir/`, { method: 'DELETE' }),
  listDeadlines: () => deadlineRequest(),
  getDeadline: (id) => deadlineRequest(`${id}/`),
  createDeadline: (payload) => deadlineRequest('criar/', jsonOptions('POST', payload)),
  updateDeadline: (id, payload) => deadlineRequest(`${id}/editar/`, jsonOptions('PUT', payload)),
  updateDeadlineTimer: (id, payload) => deadlineRequest(`${id}/timer/`, jsonOptions('PATCH', payload)),
  createDeadlineDocument: (id) => deadlineRequest(`${id}/documento/`, { method: 'POST' }),
  removeDeadlineDocument: (id, { deleteFile = false } = {}) =>
    deadlineRequest(`${id}/documento/${deleteFile ? '?apagar=1' : ''}`, { method: 'DELETE' }),
  uploadDeadlineDocument: (id, formData) =>
    deadlineRequest(`${id}/documento/upload/`, { method: 'POST', body: formData }),
  deleteDeadline: (id) => deadlineRequest(`${id}/excluir/`, { method: 'DELETE' }),
  listPetitions: () => petitionRequest(),
  getPetition: (id) => petitionRequest(`${id}/`),
  createPetition: (payload) => petitionRequest('criar/', jsonOptions('POST', payload)),
  updatePetition: (id, payload) => petitionRequest(`${id}/editar/`, jsonOptions('PUT', payload)),
  createPetitionDocument: (id) => petitionRequest(`${id}/documento/`, { method: 'POST' }),
  removePetitionDocument: (id, { deleteFile = false } = {}) =>
    petitionRequest(`${id}/documento/${deleteFile ? '?apagar=1' : ''}`, { method: 'DELETE' }),
  deletePetition: (id) => petitionRequest(`${id}/excluir/`, { method: 'DELETE' }),
  getProductivity: () => productivityRequest(),
  getProductivityResumo: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value != null && value !== ''),
    ).toString();
    return productivityRequest(`resumo/${query ? `?${query}` : ''}`);
  },
  startTimeEntry: (payload) => productivityRequest('time-entries/iniciar/', jsonOptions('POST', payload)),
  pauseTimeEntry: (id) => productivityRequest(`time-entries/${id}/pausar/`, jsonOptions('PATCH', {})),
  resumeTimeEntry: (id, payload = {}) => productivityRequest(`time-entries/${id}/retomar/`, jsonOptions('PATCH', payload)),
  stopTimeEntry: (id) => productivityRequest(`time-entries/${id}/encerrar/`, jsonOptions('PATCH', {})),
  saveProductivityGoals: (payload) => productivityRequest('metas/salvar/', jsonOptions('PUT', payload)),
  listUsers: (params = {}) => {
    const query = buildQuery(params);
    return apiRequest(`/api/usuarios/${query ? `?${query}` : ''}`);
  },
  createUser: (payload) => apiRequest('/api/usuarios/criar/', jsonOptions('POST', payload)),
  updateUser: (id, payload) => apiRequest(`/api/usuarios/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteUser: (id) => apiRequest(`/api/usuarios/${id}/excluir/`, { method: 'DELETE' }),
  listProspects: () => prospeccaoRequest(),
  getProspect: (id) => prospeccaoRequest(`${id}/`),
  createProspect: (payload) => prospeccaoRequest('criar/', jsonOptions('POST', payload)),
  updateProspect: (id, payload) => prospeccaoRequest(`${id}/editar/`, jsonOptions('PUT', payload)),
  deleteProspect: (id) => prospeccaoRequest(`${id}/excluir/`, { method: 'DELETE' }),
  createInteracao: (id, payload) => prospeccaoRequest(`${id}/interacoes/criar/`, jsonOptions('POST', payload)),
  convertProspect: (id, payload) => prospeccaoRequest(`${id}/converter/`, jsonOptions('POST', payload)),
  listLancamentos: (query = '') => financeiroRequest(query ? `?${query}` : ''),
  getLancamento: (id) => financeiroRequest(`${id}/`),
  createLancamento: (payload) => financeiroRequest('criar/', jsonOptions('POST', payload)),
  updateLancamento: (id, payload) => financeiroRequest(`${id}/editar/`, jsonOptions('PUT', payload)),
  deleteLancamento: (id) => financeiroRequest(`${id}/excluir/`, { method: 'DELETE' }),
  marcarLancamentoPago: (id, payload) => financeiroRequest(`${id}/marcar-pago/`, jsonOptions('POST', payload)),
  cancelarLancamento: (id) => financeiroRequest(`${id}/cancelar/`, jsonOptions('POST', {})),
  dashboardFinanceiro: () => financeiroRequest('dashboard/'),
  getConfiguracaoIA: () => iaRequest('configuracao/'),
  salvarConfiguracaoIA: (apiKey) => iaRequest('configuracao/', jsonOptions('POST', { api_key: apiKey })),
  removerConfiguracaoIA: () => iaRequest('configuracao/', { method: 'DELETE' }),
  getCustoIA: () => iaRequest('custo/'),
  listAudit: (params = {}) => {
    const query = buildQuery(params);
    return apiRequest(`/api/auditoria/${query ? `?${query}` : ''}`);
  },
  getAuditPanel: (periodo = 7) => apiRequest(`/api/auditoria/painel/?periodo=${periodo}`),
  getAuditOverview: (periodo = 7) => apiRequest(`/api/auditoria/visao-geral/?periodo=${periodo}`),
  listAuditAutores: () => apiRequest('/api/auditoria/autores/'),
  listNotificacoes: () => apiRequest('/api/notificacoes/'),
  marcarNotificacaoLida: (id) => apiRequest(`/api/notificacoes/${id}/ler/`, { method: 'POST' }),
  marcarTodasLidas: () => apiRequest('/api/notificacoes/ler-todas/', { method: 'POST' }),
  listOpcoes: (campo) => apiRequest(`/api/opcoes/${campo}/`),
  criarOpcao: (campo, valor) => apiRequest(`/api/opcoes/${campo}/criar/`, jsonOptions('POST', { valor })),
  apagarOpcao: (campo, id) => apiRequest(`/api/opcoes/${campo}/${id}/excluir/`, { method: 'DELETE' }),
};
