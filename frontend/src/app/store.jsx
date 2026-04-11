/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';

import { api, isApiEnabled } from './api';
import { createSeedState, LOGIN_HINT } from './data';

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

function errorMessage(error) {
  return error instanceof Error ? error.message : 'Falha ao comunicar com a API.';
}

export function AppStateProvider({ children }) {
  const [seed] = useState(() => createSeedState(new Date()));
  const [permissionGroups] = useState(seed.permissionGroups);
  const [roles, setRoles] = useState(seed.roles);
  const [users, setUsers] = useState(seed.users);
  const [clients, setClients] = useState(seed.clients);
  const [processes, setProcesses] = useState(seed.processes);
  const [events, setEvents] = useState(seed.events);
  const [flashes, setFlashes] = useState([]);
  const [isLoading, setIsLoading] = useState(isApiEnabled);
  const [apiStatus, setApiStatus] = useState(isApiEnabled ? 'loading' : 'local');
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('rs-advocacia-user') || null);

  useEffect(() => {
    let isMounted = true;

    if (!isApiEnabled) {
      return () => {
        isMounted = false;
      };
    }

    async function loadRemoteState() {
      try {
        const payload = await api.bootstrap();

        if (!isMounted) {
          return;
        }

        setRoles(payload.roles || []);
        setUsers(payload.users || []);
        setClients(payload.clients || []);
        setProcesses(payload.processes || []);
        setEvents(payload.events || []);
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
        }
      }
    }

    loadRemoteState();

    return () => {
      isMounted = false;
    };
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
        const payload = await api.login({ email, password });
        setUsers((currentUsers) => sortByName(replaceById(currentUsers, payload.user)));
        setCurrentUserId(payload.user.id);
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

  function logout() {
    setCurrentUserId(null);
    addFlash('Sessão encerrada.', 'info');
  }

  async function saveClient(payload) {
    if (isApiEnabled) {
      try {
        const response = payload.id
          ? await api.updateClient(payload.id, payload)
          : await api.createClient(payload);
        setClients((currentClients) => sortByName(replaceById(currentClients, response.client)));
        addFlash(payload.id ? 'Cliente atualizado.' : 'Cliente salvo.', 'success');
        return response.client;
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
        setProcesses((currentProcesses) => replaceById(currentProcesses, response.process));
        addFlash(payload.id ? 'Processo atualizado.' : 'Processo salvo.', 'success');
        return response.process;
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
    if (isApiEnabled) {
      try {
        const response = payload.id
          ? await api.updateEvent(payload.id, payload)
          : await api.createEvent(payload);
        setEvents((currentEvents) => replaceById(currentEvents, response.event));
        addFlash(payload.id ? 'Compromisso atualizado.' : 'Compromisso salvo.', 'success');
        return response.event;
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

  async function saveUser(payload) {
    if (isApiEnabled) {
      try {
        const response = payload.id
          ? await api.updateUser(payload.id, payload)
          : await api.createUser(payload);
        setUsers((currentUsers) => sortByName(replaceById(currentUsers, response.user)));
        addFlash(payload.id ? 'Usuário atualizado.' : 'Usuário salvo.', 'success');
        return response.user;
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
        setRoles((currentRoles) => sortByName(replaceById(currentRoles, response.role)));
        addFlash(payload.id ? 'Cargo atualizado.' : 'Cargo salvo.', 'success');
        return response.role;
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
    if (isApiEnabled) {
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

  const currentUser = users.find((user) => user.id === currentUserId) || null;
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
    apiStatus,
    loginHint: LOGIN_HINT,
    removeFlash,
    addFlash,
    login,
    logout,
    saveClient,
    saveProcess,
    saveEvent,
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
