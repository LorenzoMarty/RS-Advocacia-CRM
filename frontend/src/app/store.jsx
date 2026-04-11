/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';

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

export function AppStateProvider({ children }) {
  const [seed] = useState(() => createSeedState(new Date()));
  const [permissionGroups] = useState(seed.permissionGroups);
  const [roles, setRoles] = useState(seed.roles);
  const [users, setUsers] = useState(seed.users);
  const [clients, setClients] = useState(seed.clients);
  const [processes, setProcesses] = useState(seed.processes);
  const [events, setEvents] = useState(seed.events);
  const [flashes, setFlashes] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('rs-advocacia-user') || null);

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

  function login(email, password) {
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

  function saveClient(payload) {
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

  function saveProcess(payload) {
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

  function saveEvent(payload) {
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

  function saveUser(payload) {
    if (payload.id) {
      setUsers((currentUsers) =>
        sortByName(currentUsers.map((user) => (user.id === payload.id ? { ...user, ...payload } : user))),
      );
      addFlash('Usuário atualizado.', 'success');
      return payload;
    }

    const nextUser = { ...payload, id: nextId('user') };
    setUsers((currentUsers) => sortByName([...currentUsers, nextUser]));
    addFlash('Usuário salvo.', 'success');
    return nextUser;
  }

  function saveRole(payload) {
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

  function deleteClient(clientId) {
    const relatedProcessIds = processes
      .filter((process) => process.clientId === clientId)
      .map((process) => process.id);

    setClients((currentClients) => currentClients.filter((client) => client.id !== clientId));
    setProcesses((currentProcesses) => currentProcesses.filter((process) => process.clientId !== clientId));
    setEvents((currentEvents) =>
      currentEvents.filter((event) => event.clientId !== clientId && !relatedProcessIds.includes(event.processId)),
    );
    addFlash('Cliente excluído.', 'success');
  }

  function deleteProcess(processId) {
    setProcesses((currentProcesses) => currentProcesses.filter((process) => process.id !== processId));
    setEvents((currentEvents) => currentEvents.filter((event) => event.processId !== processId));
    addFlash('Processo excluído.', 'success');
  }

  function deleteEvent(eventId) {
    setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
    addFlash('Compromisso excluído.', 'success');
  }

  function deleteUser(userId) {
    setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
    if (userId === currentUserId) {
      setCurrentUserId(null);
    }
    addFlash('Usuário excluído.', 'success');
  }

  function deleteRole(roleId) {
    setRoles((currentRoles) => currentRoles.filter((role) => role.id !== roleId));
    addFlash('Cargo excluído.', 'success');
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
