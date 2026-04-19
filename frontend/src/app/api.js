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

export function apiUrl(path) {
  return buildUrl(path);
}

export function getCookie(name) {
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

export async function apiRequest(path, options = {}, { baseUrl = apiBaseUrl, requireConfiguredApi = true } = {}) {
  if (requireConfiguredApi && !baseUrl) {
    throw new Error('API nao configurada. Defina VITE_API_URL.');
  }

  const method = (options.method || 'GET').toUpperCase();
  const csrfToken = SAFE_METHODS.has(method) ? '' : await ensureCsrfToken(baseUrl);
  const headers = {
    Accept: 'application/json',
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
  return apiRequest(`/api/eventos/${path}`, options, {
    baseUrl: apiBaseUrl,
    requireConfiguredApi: false,
  });
}

export const api = {
  bootstrap: () => apiRequest('/api/bootstrap/'),
  getCurrentUser: () => apiRequest('/api/usuarios/atual/'),
  googleRedirectUrl: () => apiUrl('/api/auth/google/'),
  logout: () => apiRequest('/api/auth/logout/', { method: 'POST' }),
  listClients: () => apiRequest('/api/clientes/'),
  createClient: (payload) => apiRequest('/api/clientes/criar/', jsonOptions('POST', payload)),
  updateClient: (id, payload) => apiRequest(`/api/clientes/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteClient: (id) => apiRequest(`/api/clientes/${id}/excluir/`, { method: 'DELETE' }),
  listProcesses: () => apiRequest('/api/processos/'),
  createProcess: (payload) => apiRequest('/api/processos/criar/', jsonOptions('POST', payload)),
  updateProcess: (id, payload) => apiRequest(`/api/processos/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteProcess: (id) => apiRequest(`/api/processos/${id}/excluir/`, { method: 'DELETE' }),
  listEvents: () => eventRequest(),
  getEvent: (id) => eventRequest(`${id}/`),
  createEvent: (payload) => eventRequest('criar/', jsonOptions('POST', payload)),
  updateEvent: (id, payload) => eventRequest(`${id}/editar/`, jsonOptions('PUT', payload)),
  deleteEvent: (id) => eventRequest(`${id}/excluir/`, { method: 'DELETE' }),
  listUsers: () => apiRequest('/api/usuarios/'),
  updateUser: (id, payload) => apiRequest(`/api/usuarios/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteUser: (id) => apiRequest(`/api/usuarios/${id}/excluir/`, { method: 'DELETE' }),
  listRoles: () => apiRequest('/api/cargos/'),
  createRole: (payload) => apiRequest('/api/cargos/criar/', jsonOptions('POST', payload)),
  updateRole: (id, payload) => apiRequest(`/api/cargos/${id}/editar/`, jsonOptions('PUT', payload)),
  deleteRole: (id) => apiRequest(`/api/cargos/${id}/excluir/`, { method: 'DELETE' }),
};
