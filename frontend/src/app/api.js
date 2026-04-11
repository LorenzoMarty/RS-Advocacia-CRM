const rawApiBaseUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

export const isApiEnabled = Boolean(rawApiBaseUrl);

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (rawApiBaseUrl.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${rawApiBaseUrl}${normalizedPath.slice(4)}`;
  }

  return `${rawApiBaseUrl}${normalizedPath}`;
}

async function request(path, options = {}) {
  if (!isApiEnabled) {
    throw new Error('API nao configurada. Defina VITE_API_URL.');
  }

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = payload.error || `Falha na API (${response.status}).`;
    const message = typeof error === 'object' && !Array.isArray(error)
      ? JSON.stringify(error)
      : String(Array.isArray(error) ? error.join(' ') : error);
    throw new Error(message);
  }

  return payload;
}

function jsonOptions(method, payload) {
  return {
    method,
    body: JSON.stringify(payload),
  };
}

export const api = {
  bootstrap: () => request('/api/bootstrap/'),
  login: (payload) => request('/api/auth/login/', jsonOptions('POST', payload)),
  createClient: (payload) => request('/api/clients/', jsonOptions('POST', payload)),
  updateClient: (id, payload) => request(`/api/clients/${id}/`, jsonOptions('PUT', payload)),
  deleteClient: (id) => request(`/api/clients/${id}/`, { method: 'DELETE' }),
  createProcess: (payload) => request('/api/processes/', jsonOptions('POST', payload)),
  updateProcess: (id, payload) => request(`/api/processes/${id}/`, jsonOptions('PUT', payload)),
  deleteProcess: (id) => request(`/api/processes/${id}/`, { method: 'DELETE' }),
  createEvent: (payload) => request('/api/events/', jsonOptions('POST', payload)),
  updateEvent: (id, payload) => request(`/api/events/${id}/`, jsonOptions('PUT', payload)),
  deleteEvent: (id) => request(`/api/events/${id}/`, { method: 'DELETE' }),
  createUser: (payload) => request('/api/users/', jsonOptions('POST', payload)),
  updateUser: (id, payload) => request(`/api/users/${id}/`, jsonOptions('PUT', payload)),
  deleteUser: (id) => request(`/api/users/${id}/`, { method: 'DELETE' }),
  createRole: (payload) => request('/api/roles/', jsonOptions('POST', payload)),
  updateRole: (id, payload) => request(`/api/roles/${id}/`, jsonOptions('PUT', payload)),
  deleteRole: (id) => request(`/api/roles/${id}/`, { method: 'DELETE' }),
};
