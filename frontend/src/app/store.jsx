/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';

import { api, isApiEnabled, isEventsApiEnabled } from './api';

const AppStateContext = createContext(null);

function nextId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function sortByName(items, key = 'name') {
  return [...items].sort((left, right) => left[key].localeCompare(right[key], 'pt-BR'));
}

function replaceById(items, payload) {
  return items.some((item) => item.id === payload.id)
    ? items.map((item) => (item.id === payload.id ? payload : item))
    : [...items, payload];
}

function mergeById(items, nextItems) {
  return nextItems.reduce((currentItems, item) => replaceById(currentItems, item), items);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : 'Falha ao comunicar com a API.';
}

function collectionFromResponse(payload, englishKey, portugueseKey) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload?.[englishKey] || payload?.[portugueseKey] || [];
}

function itemFromResponse(payload, englishKey, portugueseKey) {
  if (payload?.id) {
    return payload;
  }

  return payload?.[englishKey] || payload?.[portugueseKey] || null;
}

function usersFromResponse(payload) {
  return collectionFromResponse(payload, 'users', 'usuarios');
}

function userFromResponse(payload) {
  return itemFromResponse(payload, 'user', 'usuario');
}

function rolesFromResponse(payload) {
  return collectionFromResponse(payload, 'roles', 'cargos');
}

function roleFromResponse(payload) {
  return itemFromResponse(payload, 'role', 'cargo');
}

function clientsFromResponse(payload) {
  return collectionFromResponse(payload, 'clients', 'clientes');
}

function clientFromResponse(payload) {
  return itemFromResponse(payload, 'client', 'cliente');
}

function processesFromResponse(payload) {
  return collectionFromResponse(payload, 'processes', 'processos');
}

function processFromResponse(payload) {
  return itemFromResponse(payload, 'process', 'processo');
}

function eventsFromResponse(payload) {
  return collectionFromResponse(payload, 'events', 'eventos');
}

function eventFromResponse(payload) {
  return itemFromResponse(payload, 'event', 'evento');
}

export function AppStateProvider({ children }) {
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [events, setEvents] = useState([]);
  const [flashes, setFlashes] = useState([]);
  const [isLoading, setIsLoading] = useState(isApiEnabled || isEventsApiEnabled);
  const [apiStatus, setApiStatus] = useState((isApiEnabled || isEventsApiEnabled) ? 'loading' : 'local');
  const [isEventsLoading, setIsEventsLoading] = useState(isEventsApiEnabled);
  const [currentSessionUser, setCurrentSessionUser] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('rs-advocacia-user') || null);

  function syncCurrentUser(user) {
    if (!user) {
      setCurrentSessionUser(null);
      setCurrentUserId(null);
      return null;
    }

    setCurrentSessionUser(user);
    setUsers((currentUsers) => sortByName(replaceById(currentUsers, user)));
    setCurrentUserId(user.id);
    return user;
  }

  async function loadCurrentUser() {
    const payload = await api.getCurrentUser();
    return syncCurrentUser(userFromResponse(payload));
  }

  function applyBootstrapPayload(payload) {
    if (payload.permissionGroups) {
      setPermissionGroups(payload.permissionGroups);
    }

    setRoles(sortByName(rolesFromResponse(payload)));
    setUsers((currentUsers) => sortByName(mergeById(currentUsers, usersFromResponse(payload))));
    setClients(sortByName(clientsFromResponse(payload)));
    setProcesses(processesFromResponse(payload));
    setEvents(eventsFromResponse(payload));
  }

  async function loadRemoteCollections() {
    let loadedRemoteData = false;
    let lastError = null;

    try {
      const payload = await api.bootstrap();
      applyBootstrapPayload(payload);
      loadedRemoteData = true;
    } catch (error) {
      lastError = error;
    }

    const loaders = [
      {
        load: api.listRoles,
        apply: (payload) => setRoles(sortByName(rolesFromResponse(payload))),
      },
      {
        load: api.listUsers,
        apply: (payload) => setUsers((currentUsers) => sortByName(mergeById(currentUsers, usersFromResponse(payload)))),
      },
      {
        load: api.listClients,
        apply: (payload) => setClients(sortByName(clientsFromResponse(payload))),
      },
      {
        load: api.listProcesses,
        apply: (payload) => setProcesses(processesFromResponse(payload)),
      },
      {
        load: api.listEvents,
        apply: (payload) => setEvents(eventsFromResponse(payload)),
      },
    ];

    const results = await Promise.allSettled(loaders.map(({ load }) => load()));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        loaders[index].apply(result.value);
        loadedRemoteData = true;
      } else {
        lastError = result.reason;
      }
    });

    if (!loadedRemoteData && lastError) {
      throw lastError;
    }
  }

  useEffect(() => {
    let isMounted = true;

    if (!isApiEnabled) {
      return () => {
        isMounted = false;
      };
    }

    async function loadRemoteState() {
      try {
        const currentUser = await loadCurrentUser();

        if (!isMounted) {
          return;
        }

        if (currentUser) {
          await loadRemoteCollections();
        }

        setApiStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setApiStatus('error');
        addFlash(`API indisponível: ${errorMessage(error)}`, 'error');
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsEventsLoading(false);
        }
      }
    }

    loadRemoteState();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem('rs-advocacia-user', currentUserId);
      return;
    }

    localStorage.removeItem('rs-advocacia-user');
  }, [currentUserId]);

  function addFlash(message, type = 'success') {
    const id = nextId('flash');
    setFlashes((currentFlashes) => [...currentFlashes, { id, message, type }]);
    window.setTimeout(() => {
      setFlashes((currentFlashes) => currentFlashes.filter((flash) => flash.id !== id));
    }, 3500);
  }

  function removeFlash(flashId) {
    setFlashes((currentFlashes) => currentFlashes.filter((flash) => flash.id !== flashId));
  }

  async function login(email, password) {
    if (isApiEnabled) {
      try {
        const payload = await api.login({ email, username: email, password });
        const user = userFromResponse(payload);
        if (!user) {
          throw new Error('Resposta invalida da API de login.');
        }
        syncCurrentUser(user);
        await loadRemoteCollections();
        addFlash('Sessão iniciada.', 'success');
        return true;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    const matchedUser = users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase() && user.password === password,
    );

    if (!matchedUser) {
      return false;
    }

    setCurrentUserId(matchedUser.id);
    addFlash('Sessão iniciada.', 'success');
    return true;
  }

  async function logout() {
    if (isApiEnabled) {
      try {
        await api.logout();
      } catch (error) {
        addFlash(errorMessage(error), 'error');
      }
    }

    setCurrentSessionUser(null);
    setCurrentUserId(null);
    setRoles([]);
    setUsers([]);
    setClients([]);
    setProcesses([]);
    setEvents([]);
    addFlash('Sessão encerrada.', 'info');
  }

  async function saveClient(payload) {
    if (isApiEnabled) {
      try {
        const response = payload.id
          ? await api.updateClient(payload.id, payload)
          : await api.createClient(payload);
        const savedClient = clientFromResponse(response);
        if (!savedClient) {
          throw new Error('Resposta invalida da API de clientes.');
        }
        setClients((currentClients) => sortByName(replaceById(currentClients, savedClient)));
        addFlash(payload.id ? 'Cliente atualizado.' : 'Cliente salvo.', 'success');
        return savedClient;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      setClients((currentClients) =>
        currentClients.map((client) => (client.id === payload.id ? { ...client, ...payload } : client)),
      );
      addFlash('Cliente atualizado.', 'success');
      return payload;
    }

    const nextClient = { ...payload, id: nextId('client') };
    setClients((currentClients) => sortByName([...currentClients, nextClient]));
    addFlash('Cliente salvo.', 'success');
    return nextClient;
  }

  async function saveProcess(payload) {
    if (isApiEnabled) {
      try {
        const response = payload.id
          ? await api.updateProcess(payload.id, payload)
          : await api.createProcess(payload);
        const savedProcess = processFromResponse(response);
        if (!savedProcess) {
          throw new Error('Resposta invalida da API de processos.');
        }
        setProcesses((currentProcesses) => replaceById(currentProcesses, savedProcess));
        addFlash(payload.id ? 'Processo atualizado.' : 'Processo salvo.', 'success');
        return savedProcess;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      setProcesses((currentProcesses) =>
        currentProcesses.map((process) => (process.id === payload.id ? { ...process, ...payload } : process)),
      );
      addFlash('Processo atualizado.', 'success');
      return payload;
    }

    const nextProcess = { ...payload, id: nextId('process') };
    setProcesses((currentProcesses) => [...currentProcesses, nextProcess]);
    addFlash('Processo salvo.', 'success');
    return nextProcess;
  }

  async function saveEvent(payload) {
    if (isEventsApiEnabled) {
      try {
        const response = payload.id
          ? await api.updateEvent(payload.id, payload)
          : await api.createEvent(payload);
        const savedEvent = eventFromResponse(response);
        if (!savedEvent) {
          throw new Error('Resposta invalida da API de eventos.');
        }
        setEvents((currentEvents) => replaceById(currentEvents, savedEvent));
        addFlash(payload.id ? 'Compromisso atualizado.' : 'Compromisso salvo.', 'success');
        return savedEvent;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      setEvents((currentEvents) =>
        currentEvents.map((event) => (event.id === payload.id ? { ...event, ...payload } : event)),
      );
      addFlash('Compromisso atualizado.', 'success');
      return payload;
    }

    const nextEvent = { ...payload, id: nextId('event') };
    setEvents((currentEvents) => [...currentEvents, nextEvent]);
    addFlash('Compromisso salvo.', 'success');
    return nextEvent;
  }

  async function loadEvent(eventId) {
    if (!isEventsApiEnabled) {
      return events.find((event) => event.id === eventId) || null;
    }

    setIsEventsLoading(true);

    try {
      const response = await api.getEvent(eventId);
      const eventItem = eventFromResponse(response);
      if (eventItem) {
        setEvents((currentEvents) => replaceById(currentEvents, eventItem));
      }
      return eventItem;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    } finally {
      setIsEventsLoading(false);
    }
  }

  async function saveUser(payload) {
    if (isApiEnabled) {
      try {
        const response = payload.id
          ? await api.updateUser(payload.id, payload)
          : await api.createUser(payload);
        const savedUser = userFromResponse(response);
        if (!savedUser) {
          throw new Error('Resposta invalida da API de usuarios.');
        }
        setUsers((currentUsers) => sortByName(replaceById(currentUsers, savedUser)));
        if (savedUser.id === currentUserId) {
          setCurrentSessionUser(savedUser);
        }
        addFlash(payload.id ? 'Usuário atualizado.' : 'Usuário salvo.', 'success');
        return savedUser;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      let savedUser = null;
      setUsers((currentUsers) =>
        sortByName(currentUsers.map((user) => {
          if (user.id !== payload.id) {
            return user;
          }

          savedUser = { ...user, ...payload, password: payload.password || user.password };
          return savedUser;
        })),
      );
      addFlash('Usuário atualizado.', 'success');
      return savedUser || payload;
    }

    const nextUser = { ...payload, id: nextId('user') };
    setUsers((currentUsers) => sortByName([...currentUsers, nextUser]));
    addFlash('Usuário salvo.', 'success');
    return nextUser;
  }

  async function saveRole(payload) {
    if (isApiEnabled) {
      try {
        const response = payload.id
          ? await api.updateRole(payload.id, payload)
          : await api.createRole(payload);
        const savedRole = roleFromResponse(response);
        if (!savedRole) {
          throw new Error('Resposta invalida da API de cargos.');
        }
        setRoles((currentRoles) => sortByName(replaceById(currentRoles, savedRole)));
        addFlash(payload.id ? 'Cargo atualizado.' : 'Cargo salvo.', 'success');
        return savedRole;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      setRoles((currentRoles) =>
        sortByName(currentRoles.map((role) => (role.id === payload.id ? { ...role, ...payload } : role))),
      );
      addFlash('Cargo atualizado.', 'success');
      return payload;
    }

    const nextRole = { ...payload, id: nextId('role') };
    setRoles((currentRoles) => sortByName([...currentRoles, nextRole]));
    addFlash('Cargo salvo.', 'success');
    return nextRole;
  }

  async function deleteClient(clientId) {
    if (isApiEnabled) {
      try {
        await api.deleteClient(clientId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    const relatedProcessIds = processes
      .filter((process) => process.clientId === clientId)
      .map((process) => process.id);

    setClients((currentClients) => currentClients.filter((client) => client.id !== clientId));
    setProcesses((currentProcesses) => currentProcesses.filter((process) => process.clientId !== clientId));
    setEvents((currentEvents) =>
      currentEvents.filter((event) => event.clientId !== clientId && !relatedProcessIds.includes(event.processId)),
    );
    addFlash('Cliente excluído.', 'success');
    return true;
  }

  async function deleteProcess(processId) {
    if (isApiEnabled) {
      try {
        await api.deleteProcess(processId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setProcesses((currentProcesses) => currentProcesses.filter((process) => process.id !== processId));
    setEvents((currentEvents) => currentEvents.filter((event) => event.processId !== processId));
    addFlash('Processo excluído.', 'success');
    return true;
  }

  async function deleteEvent(eventId) {
    if (isEventsApiEnabled) {
      try {
        await api.deleteEvent(eventId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
    addFlash('Compromisso excluído.', 'success');
    return true;
  }

  async function deleteUser(userId) {
    if (isApiEnabled) {
      try {
        await api.deleteUser(userId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
    if (userId === currentUserId) {
      setCurrentUserId(null);
    }
    addFlash('Usuário excluído.', 'success');
    return true;
  }

  async function deleteRole(roleId) {
    if (isApiEnabled) {
      try {
        await api.deleteRole(roleId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setRoles((currentRoles) => currentRoles.filter((role) => role.id !== roleId));
    addFlash('Cargo excluído.', 'success');
    return true;
  }

  const currentUser = users.find((user) => user.id === currentUserId) || currentSessionUser;
  const currentRole = roles.find((role) => role.id === currentUser?.roleId) || null;

  const value = {
    permissionGroups,
    roles,
    users,
    clients,
    processes,
    events,
    flashes,
    currentUser,
    currentRole,
    isApiEnabled,
    isLoading,
    isEventsLoading,
    apiStatus,
    loginHint: { email: '', password: '' },
    removeFlash,
    addFlash,
    login,
    logout,
    saveClient,
    saveProcess,
    saveEvent,
    loadEvent,
    saveUser,
    saveRole,
    deleteClient,
    deleteProcess,
    deleteEvent,
    deleteUser,
    deleteRole,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider.');
  }

  return context;
}
