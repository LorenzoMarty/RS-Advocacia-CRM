const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';
const rawApiBaseUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const apiBaseUrl = (rawApiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

export const isApiEnabled = Boolean(apiBaseUrl);
export const isEventsApiEnabled = isApiEnabled;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function buildUrl(path, baseUrl = apiBaseUrl) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (baseUrl.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${baseUrl}${normalizedPath.slice(4)}`;
  }

  return `${baseUrl}${normalizedPath}`;
}

function getCookie(name) {
  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
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

  return getCookie('csrftoken') || payload.data?.csrfToken || payload.csrfToken || '';
}

function errorMessageFromPayload(payload, status) {
  const error = payload.errors || payload.error || `Falha na API (${status}).`;

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
        return field === 'detail' ? text : `${field}: ${text}`;
      })
      .join(' ');
  }

  return String(error);
}

async function request(path, options = {}, { baseUrl = apiBaseUrl, requireConfiguredApi = true } = {}) {
  if (requireConfiguredApi && !baseUrl) {
    throw new Error('API nao configurada. Defina VITE_API_URL.');
  }

  const method = (options.method || 'GET').toUpperCase();
  const csrfToken = SAFE_METHODS.has(method) ? '' : await ensureCsrfToken(baseUrl);
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    ...options.headers,
  };

  const response = await fetch(buildUrl(path, baseUrl), {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(errorMessageFromPayload(payload, response.status));
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'success')) {
    if (!payload.success) {
      throw new Error(errorMessageFromPayload(payload, response.status));
    }
    return payload.data || {};
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
  return request(`/api/eventos/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

export const api = {
  bootstrap: () => request('/api/bootstrap/'),
  getCurrentUser: () => request('/api/usuarios/atual/'),
  login: (payload) => request('/api/auth/login/', jsonOptions('POST', payload)),
  logout: () => request('/api/auth/logout/', { method: 'POST' }),
  listClients: () => request('/api/clientes/'),
  createClient: (payload) => request('/api/clientes/criar/', jsonOptions('POST', payload)),
  updateClient: (id, payload) => request(`/api/clientes/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteClient: (id) => request(`/api/clientes/${id}/excluir/`, { method: 'DELETE' }),
  listProcesses: () => request('/api/processos/'),
  createProcess: (payload) => request('/api/processos/criar/', jsonOptions('POST', payload)),
  updateProcess: (id, payload) => request(`/api/processos/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteProcess: (id) => request(`/api/processos/${id}/excluir/`, { method: 'DELETE' }),
  listEvents: () => eventRequest(),
  getEvent: (id) => eventRequest(`${id}/`),
  createEvent: (payload) => eventRequest('criar/', jsonOptions('POST', payload)),
  updateEvent: (id, payload) => eventRequest(`${id}/editar/`, jsonOptions('PUT', payload)),
  deleteEvent: (id) => eventRequest(`${id}/excluir/`, { method: 'DELETE' }),
  listUsers: () => request('/api/usuarios/'),
  createUser: (payload) => request('/api/usuarios/criar/', jsonOptions('POST', payload)),
  updateUser: (id, payload) => request(`/api/usuarios/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteUser: (id) => request(`/api/usuarios/${id}/excluir/`, { method: 'DELETE' }),
  listRoles: () => request('/api/cargos/'),
  createRole: (payload) => request('/api/cargos/criar/', jsonOptions('POST', payload)),
  updateRole: (id, payload) => request(`/api/cargos/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteRole: (id) => request(`/api/cargos/${id}/excluir/`, { method: 'DELETE' }),
};
