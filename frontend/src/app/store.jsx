/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  api,
  isApiEnabled,
} from './api';

import { saveEntity, deleteEntity } from './store-helpers';

import {
  usersFromResponse,
  userFromResponse,
  assignableUsersFromResponse,
  clientsFromResponse,
  clientFromResponse,
  processesFromResponse,
  processFromResponse,
  eventsFromResponse,
  eventFromResponse,
  deadlinesFromResponse,
  deadlineFromResponse,
  petitionsFromResponse,
  petitionFromResponse,
  prospectsFromResponse,
  prospectFromResponse,
  interactionFromResponse,
  lancamentosFromResponse,
  lancamentoFromResponse,
  timeEntriesFromResponse,
  timeEntryFromResponse,
  productivityGoalsFromResponse,
  auditFromResponse,
  auditFromListResponse,
  auditPaginationFromResponse,
  auditOverviewFromResponse,
  clientToPayload,
  processToPayload,
  eventToPayload,
  prospectToPayload,
  interactionToPayload,
  lancamentoToPayload,
  deadlineToPayload,
  petitionToPayload,
  deadlineTimerToPayload,
  userToPayload,
} from './mappers';

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

function googleSyncMessage(summary) {
  if (!summary) {
    return 'Agenda sincronizada com Google Calendar.';
  }

  const parts = [];

  if (summary.importados) {
    parts.push(`${summary.importados} importado(s)`);
  }
  if (summary.atualizados) {
    parts.push(`${summary.atualizados} atualizado(s)`);
  }
  if (summary.exportados) {
    parts.push(`${summary.exportados} enviado(s) ao Google`);
  }
  if (summary.vinculados) {
    parts.push(`${summary.vinculados} vinculado(s)`);
  }
  if (summary.removidos) {
    parts.push(`${summary.removidos} removido(s)`);
  }
  if (summary.conflitos) {
    parts.push(`${summary.conflitos} conflito(s) resolvido(s) pelo registro mais recente`);
  }

  if (!parts.length) {
    return 'Agenda sincronizada. Nenhuma diferenca nova foi encontrada.';
  }

  return `Agenda sincronizada: ${parts.join(', ')}.`;
}

function elapsedSecondsForTimeEntry(entry, currentTime = Date.now()) {
  const totalSeconds = Math.max(0, Math.floor(Number(entry?.totalSeconds) || 0));

  if (entry?.status !== 'running') {
    return totalSeconds;
  }

  const baseTime = new Date(entry.resumedAt || entry.startedAt).getTime();

  if (Number.isNaN(baseTime)) {
    return totalSeconds;
  }

  return totalSeconds + Math.max(0, Math.floor((currentTime - baseTime) / 1000));
}

function taskDisplayName(payload) {
  return payload.taskName || payload.title || payload.name || 'Tarefa';
}

export function AppStateProvider({ children }) {
  const [accessFlags, setAccessFlags] = useState({});
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [events, setEvents] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [petitions, setPetitions] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [productivityGoals, setProductivityGoals] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditOverview, setAuditOverview] = useState(null);
  const [auditPagination, setAuditPagination] = useState({ offset: 0, limit: 100, total: 0, temMais: false });
  const [auditFilters, setAuditFilters] = useState({});
  const [isLoading, setIsLoading] = useState(isApiEnabled);
  const [apiStatus, setApiStatus] = useState(isApiEnabled ? 'loading' : 'local');
  const [isEventsLoading, setIsEventsLoading] = useState(isApiEnabled);
  const [isDeadlinesLoading, setIsDeadlinesLoading] = useState(isApiEnabled);
  const [isPetitionsLoading, setIsPetitionsLoading] = useState(isApiEnabled);
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
    const payload = await api.obterUsuarioAtual();
    return syncCurrentUser(userFromResponse(payload));
  }

  function applyBootstrapPayload(payload) {
    if (payload.acessos) {
      setAccessFlags(payload.acessos);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'usuarios')) {
      setUsers((currentUsers) => sortByName(mergeById(currentUsers, usersFromResponse(payload))));
    } else if (Object.prototype.hasOwnProperty.call(payload, 'usuarios_atribuiveis')) {
      // Sem permissão para a lista completa: usa a lista enxuta (id + nome)
      // apenas para popular os selects de responsável.
      setUsers((currentUsers) => sortByName(mergeById(currentUsers, assignableUsersFromResponse(payload))));
    }
    setClients(sortByName(clientsFromResponse(payload)));
    setProcesses(processesFromResponse(payload));
    setEvents(eventsFromResponse(payload));
    setDeadlines(deadlinesFromResponse(payload));
    setPetitions(petitionsFromResponse(payload));
    if (Object.prototype.hasOwnProperty.call(payload, 'prospects')) {
      setProspects(prospectsFromResponse(payload));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'lancamentos')) {
      setLancamentos(lancamentosFromResponse(payload));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'time_entries')) {
      setTimeEntries(timeEntriesFromResponse(payload));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'productivity_goals')) {
      setProductivityGoals(productivityGoalsFromResponse(payload));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'auditoria')) {
      setAuditEntries(auditFromResponse(payload));
    }
  }

  async function loadRemoteCollections() {
    let loadedRemoteData = false;
    let lastError = null;
    const loaders = [
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
      {
        load: api.listDeadlines,
        apply: (payload) => setDeadlines(deadlinesFromResponse(payload)),
      },
      {
        load: api.listPetitions,
        apply: (payload) => setPetitions(petitionsFromResponse(payload)),
      },
      {
        load: api.getProductivity,
        apply: (payload) => {
          setTimeEntries(timeEntriesFromResponse(payload));
          setProductivityGoals(productivityGoalsFromResponse(payload));
        },
      },
    ];

    try {
      const payload = await api.carregarInicializacao();
      applyBootstrapPayload(payload);
      const canLoadUsers = Object.prototype.hasOwnProperty.call(payload, 'usuarios');
      if (canLoadUsers) {
        loaders.push({
          load: api.listUsers,
          apply: (payload) => setUsers((currentUsers) => sortByName(mergeById(currentUsers, usersFromResponse(payload)))),
        });
      }
      loadedRemoteData = true;
    } catch (error) {
      lastError = error;
    }

    const results = await Promise.allSettled(loaders.map(({ load }) => load()));
    let partialFailure = false;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        loaders[index].apply(result.value);
        loadedRemoteData = true;
      } else {
        lastError = result.reason;
        partialFailure = true;
      }
    });

    if (partialFailure && loadedRemoteData) {
      addFlash('Alguns dados não carregaram. Recarregue a página se necessário.', 'warning');
    }

    if (!loadedRemoteData && lastError) {
      throw lastError;
    }
  }

  useEffect(() => {
    let isMounted = true;

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
      } catch {
        if (!isMounted) {
          return;
        }

        syncCurrentUser(null);
        setApiStatus('error');
        addFlash('Não foi possível conectar ao servidor. Verifique sua internet.', 'error');
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsEventsLoading(false);
          setIsDeadlinesLoading(false);
          setIsPetitionsLoading(false);
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

  function addFlash(message, type = 'success', options = {}) {
    const duration = options.critical ? Infinity : (options.duration ?? (type === 'error' ? 5200 : 3500));
    if (type === 'error') toast.error(message, { duration });
    else if (type === 'warning') toast.warning(message, { duration });
    else if (type === 'info') toast.info(message, { duration });
    else toast.success(message, { duration });
  }

  async function sair() {
    try {
      await api.sair();
    } catch (error) {
      addFlash(errorMessage(error), 'error');
    }

    setCurrentSessionUser(null);
    setCurrentUserId(null);
    setAccessFlags({});
    setUsers([]);
    setClients([]);
    setProcesses([]);
    setEvents([]);
    setDeadlines([]);
    setPetitions([]);
    setProspects([]);
    setLancamentos([]);
    setTimeEntries([]);
    setProductivityGoals([]);
    addFlash('Sessão encerrada.', 'info');
  }

  async function saveClient(payload) {
    return saveEntity({
      id: payload.id,
      createFn: () => api.createClient(clientToPayload(payload)),
      updateFn: (id) => api.updateClient(id, clientToPayload(payload)),
      fromResponse: clientFromResponse,
      onSuccess: (saved) => setClients((current) => sortByName(replaceById(current, saved))),
      addFlash,
      createMsg: 'Cliente salvo.',
      updateMsg: 'Cliente atualizado.',
    });
  }

  async function saveProcess(payload) {
    return saveEntity({
      id: payload.id,
      createFn: () => api.createProcess(processToPayload(payload)),
      updateFn: (id) => api.updateProcess(id, processToPayload(payload)),
      fromResponse: processFromResponse,
      onSuccess: (saved) => setProcesses((current) => replaceById(current, saved)),
      addFlash,
      createMsg: 'Processo salvo.',
      updateMsg: 'Processo atualizado.',
    });
  }

  async function saveEvent(payload) {
    return saveEntity({
      id: payload.id,
      createFn: () => api.createEvent(eventToPayload(payload)),
      updateFn: (id) => api.updateEvent(id, eventToPayload(payload)),
      fromResponse: eventFromResponse,
      onSuccess: (saved) => setEvents((current) => replaceById(current, saved)),
      addFlash,
      createMsg: 'Compromisso salvo.',
      updateMsg: 'Compromisso atualizado.',
    });
  }

  async function markEventAttendance(eventId) {
    try {
      const currentEvent = events.find((event) => event.id === eventId);
      const eventToUpdate = currentEvent || await loadEvent(eventId);
      if (!eventToUpdate) {
        throw new Error('Compromisso não encontrado.');
      }

      const response = await api.updateEvent(
        eventId,
        eventToPayload({ ...eventToUpdate, completed: true }),
      );
      const savedEvent = eventFromResponse(response);
      if (!savedEvent) {
        throw new Error('Resposta inválida da API de eventos.');
      }
      setEvents((currentEvents) => replaceById(currentEvents, savedEvent));
      addFlash('Compromisso atualizado.', 'success');
      return savedEvent;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  // Move de drag-and-drop no calendário: atualiza start/end mantendo o resto.
  // Otimista (move na hora) com rollback se a API falhar. A re-sincronização
  // com o Google Calendar é feita pelo backend no editar_evento.
  async function moveEvent(eventId, { start, end }) {
    const original = events.find((event) => event.id === eventId);
    if (!original) {
      return null;
    }
    const moved = { ...original, start, end: end || original.end };

    setEvents((currentEvents) =>
      currentEvents.map((event) => (event.id === eventId ? moved : event)),
    );

    try {
      const response = await api.updateEvent(eventId, eventToPayload(moved));
      const savedEvent = eventFromResponse(response);
      if (!savedEvent) {
        throw new Error('Resposta inválida da API de eventos.');
      }
      setEvents((currentEvents) => replaceById(currentEvents, savedEvent));
      return savedEvent;
    } catch (error) {
      // Rollback para a posição original.
      setEvents((currentEvents) =>
        currentEvents.map((event) => (event.id === eventId ? original : event)),
      );
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function saveDeadline(payload, options = {}) {
    return saveEntity({
      id: payload.id,
      createFn: () => api.createDeadline(deadlineToPayload(payload)),
      updateFn: (id) => api.updateDeadline(id, deadlineToPayload(payload)),
      fromResponse: deadlineFromResponse,
      onSuccess: (saved) => setDeadlines((current) => replaceById(current, saved)),
      addFlash,
      createMsg: options.silent ? null : 'Prazo salvo.',
      updateMsg: options.silent ? null : 'Prazo atualizado.',
    });
  }

  function applyDeadlineFromResponse(response) {
    const savedDeadline = deadlineFromResponse(response);
    if (savedDeadline) {
      setDeadlines((currentDeadlines) => replaceById(currentDeadlines, savedDeadline));
    }
    return savedDeadline;
  }

  async function createDeadlineDocument(deadlineId) {
    try {
      const saved = applyDeadlineFromResponse(await api.createDeadlineDocument(deadlineId));
      addFlash('Documento criado no Google Drive.', 'success');
      return saved;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function uploadDeadlineDocument(deadlineId, file) {
    try {
      const data = new FormData();
      data.append('arquivo', file, file.name);
      const saved = applyDeadlineFromResponse(await api.uploadDeadlineDocument(deadlineId, data));
      addFlash('Arquivo enviado ao Google Drive.', 'success');
      return saved;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function removeDeadlineDocument(deadlineId, { deleteFile = false } = {}) {
    try {
      const saved = applyDeadlineFromResponse(
        await api.removeDeadlineDocument(deadlineId, { deleteFile }),
      );
      addFlash('Documento removido do prazo.', 'success');
      return saved;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function savePetition(payload, options = {}) {
    return saveEntity({
      id: payload.id,
      createFn: () => api.createPetition(petitionToPayload(payload)),
      updateFn: (id) => api.updatePetition(id, petitionToPayload(payload)),
      fromResponse: petitionFromResponse,
      onSuccess: (saved) => setPetitions((current) => replaceById(current, saved)),
      addFlash,
      createMsg: options.silent ? null : 'Petição salva.',
      updateMsg: options.silent ? null : 'Petição atualizada.',
    });
  }

  async function createPetitionDocument(petitionId) {
    try {
      const response = await api.createPetitionDocument(petitionId);
      const savedPetition = petitionFromResponse(response);
      if (savedPetition) {
        setPetitions((currentPetitions) => replaceById(currentPetitions, savedPetition));
      }
      addFlash('Documento criado no Google Drive.', 'success');
      return savedPetition;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function removePetitionDocument(petitionId, { deleteFile = false } = {}) {
    try {
      const response = await api.removePetitionDocument(petitionId, { deleteFile });
      const savedPetition = petitionFromResponse(response);
      if (savedPetition) {
        setPetitions((currentPetitions) => replaceById(currentPetitions, savedPetition));
      }
      addFlash('Documento removido da petição.', 'success');
      return savedPetition;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function loadEvent(eventId) {
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

  async function loadDeadline(deadlineId) {
    setIsDeadlinesLoading(true);

    try {
      const response = await api.getDeadline(deadlineId);
      const deadline = deadlineFromResponse(response);
      if (deadline) {
        setDeadlines((currentDeadlines) => replaceById(currentDeadlines, deadline));
      }
      return deadline;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    } finally {
      setIsDeadlinesLoading(false);
    }
  }

  async function loadPetition(petitionId) {
    setIsPetitionsLoading(true);

    try {
      const response = await api.getPetition(petitionId);
      const petition = petitionFromResponse(response);
      if (petition) {
        setPetitions((currentPetitions) => replaceById(currentPetitions, petition));
      }
      return petition;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    } finally {
      setIsPetitionsLoading(false);
    }
  }

  async function syncGoogleCalendarEvents({ silent = false } = {}) {
    try {
      const response = await api.syncGoogleCalendar();
      const syncedEvents = eventsFromResponse(response);
      setEvents(syncedEvents);
      if (!silent) {
        addFlash(googleSyncMessage(response.sincronizacao_google), 'success');
      }
      return response.sincronizacao_google || {};
    } catch (error) {
      if (!silent) {
        addFlash(errorMessage(error), 'error');
      }
      return null;
    }
  }

  async function saveDeadlineTimer(deadlineId, timer) {
    const timerPayload = {
      elapsedSeconds: Math.max(0, Math.floor(Number(timer.elapsedSeconds) || 0)),
      timerStartedAt: timer.timerStartedAt || '',
    };

    try {
      const response = await api.updateDeadlineTimer(deadlineId, deadlineTimerToPayload(timerPayload));
      const savedDeadline = deadlineFromResponse(response);
      if (!savedDeadline) {
        throw new Error('Resposta inválida da API de prazos.');
      }
      setDeadlines((currentDeadlines) => replaceById(currentDeadlines, savedDeadline));
      return savedDeadline;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function saveUser(payload) {
    return saveEntity({
      id: payload.id,
      createFn: () => api.createUser(userToPayload(payload)),
      updateFn: (id) => api.updateUser(id, userToPayload(payload)),
      fromResponse: userFromResponse,
      onSuccess: (saved) => {
        setUsers((current) => sortByName(replaceById(current, saved)));
        if (saved.id === currentUserId) {
          setCurrentSessionUser(saved);
        }
      },
      addFlash,
      createMsg: 'Usuário criado.',
      updateMsg: 'Usuário atualizado.',
    });
  }

  async function deleteClient(clientId) {
    try {
      await api.deleteClient(clientId);
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return false;
    }

    // Remove client and all cascade-deleted entities from local state immediately.
    setClients((current) => current.filter((c) => c.id !== clientId));
    setProcesses((current) => current.filter((p) => p.clientId !== clientId));
    setEvents((current) => current.filter((e) => e.clientId !== clientId));
    setDeadlines((current) => current.filter((d) => d.clientId !== clientId));
    setPetitions((current) => current.filter((p) => p.clientId !== clientId));
    addFlash('Cliente deletado.', 'success');

    return true;
  }

  async function deleteProcess(processId) {
    try {
      await api.deleteProcess(processId);
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return false;
    }

    // Remove process and cascade-deleted entities; detach petitions that referenced this process.
    setProcesses((current) => current.filter((p) => p.id !== processId));
    setEvents((current) => current.filter((e) => e.processId !== processId));
    setDeadlines((current) => current.filter((d) => d.processId !== processId));
    setPetitions((current) =>
      current.map((p) => (p.processId === processId ? { ...p, processId: '' } : p)),
    );
    addFlash('Processo deletado.', 'success');

    return true;
  }

  function deleteEvent(eventId) {
    return deleteEntity({
      deleteFn: () => api.deleteEvent(eventId),
      onSuccess: () => setEvents((current) => current.filter((e) => e.id !== eventId)),
      addFlash,
      successMsg: 'Compromisso deletado.',
    });
  }

  function deleteDeadline(deadlineId) {
    return deleteEntity({
      deleteFn: () => api.deleteDeadline(deadlineId),
      onSuccess: () => setDeadlines((current) => current.filter((d) => d.id !== deadlineId)),
      addFlash,
      successMsg: 'Prazo deletado.',
    });
  }

  function deletePetition(petitionId) {
    return deleteEntity({
      deleteFn: () => api.deletePetition(petitionId),
      onSuccess: () => setPetitions((current) => current.filter((p) => p.id !== petitionId)),
      addFlash,
      successMsg: 'Petição deletada.',
    });
  }

  function deleteUser(userId) {
    return deleteEntity({
      deleteFn: () => api.deleteUser(userId),
      onSuccess: () => {
        setUsers((current) => current.filter((u) => u.id !== userId));
        if (userId === currentUserId) {
          setCurrentUserId(null);
        }
      },
      addFlash,
      successMsg: 'Usuário deletado.',
    });
  }

  function pauseRunningEntries(entries, exceptEntryId = '') {
    const currentTime = Date.now();
    const pausedAt = new Date(currentTime).toISOString();

    return entries.map((entry) => {
      if (entry.userId !== currentUserId || entry.status !== 'running' || entry.id === exceptEntryId) {
        return entry;
      }

      return {
        ...entry,
        status: 'paused',
        pausedAt,
        totalSeconds: elapsedSecondsForTimeEntry(entry, currentTime),
        elapsedSeconds: elapsedSecondsForTimeEntry(entry, currentTime),
      };
    });
  }

  async function startTimeEntry(payload, options = {}) {
    const currentTime = Date.now();
    const startedAt = new Date(currentTime).toISOString();
    const currentUser = users.find((user) => user.id === currentUserId) || currentSessionUser;

    if (!currentUser) {
      addFlash('Usuário atual não encontrado.', 'error');
      return null;
    }

    // Entrada provisória: a UI reage na hora; reconcilia com a resposta da API.
    const optimisticId = nextId('time-entry-pending');
    const optimisticEntry = {
      id: optimisticId,
      userId: currentUser.id,
      userName: currentUser.name,
      taskId: String(payload.taskId),
      taskType: payload.taskType,
      taskName: taskDisplayName(payload),
      processId: payload.processId || '',
      processNumber: payload.processNumber || '',
      startedAt,
      pausedAt: '',
      resumedAt: '',
      endedAt: '',
      totalSeconds: 0,
      elapsedSeconds: 0,
      status: 'running',
    };
    setTimeEntries((currentEntries) => replaceById(
      options.pauseExisting ? pauseRunningEntries(currentEntries, optimisticId) : currentEntries,
      optimisticEntry,
    ));

    try {
      const response = await api.startTimeEntry({
        task_id: payload.taskId,
        task_type: payload.taskType,
        pause_existing: Boolean(options.pauseExisting),
      });
      const savedEntry = timeEntryFromResponse(response);
      if (!savedEntry) {
        throw new Error('Resposta inválida da API de produtividade.');
      }
      setTimeEntries((currentEntries) => replaceById(
        currentEntries.filter((entry) => entry.id !== optimisticId),
        savedEntry,
      ));
      return savedEntry;
    } catch (error) {
      setTimeEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== optimisticId));
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function pauseTimeEntry(entryId) {
    try {
      const response = await api.pauseTimeEntry(entryId);
      const savedEntry = timeEntryFromResponse(response);
      if (savedEntry) {
        setTimeEntries((currentEntries) => replaceById(currentEntries, savedEntry));
      }
      return savedEntry;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function resumeTimeEntry(entryId, options = {}) {
    try {
      const response = await api.resumeTimeEntry(entryId, { pause_existing: Boolean(options.pauseExisting) });
      const savedEntry = timeEntryFromResponse(response);
      if (savedEntry) {
        setTimeEntries((currentEntries) => replaceById(
          options.pauseExisting ? pauseRunningEntries(currentEntries, savedEntry.id) : currentEntries,
          savedEntry,
        ));
      }
      return savedEntry;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function stopTimeEntry(entryId) {
    try {
      const response = await api.stopTimeEntry(entryId);
      const savedEntry = timeEntryFromResponse(response);
      if (savedEntry) {
        setTimeEntries((currentEntries) => replaceById(currentEntries, savedEntry));
      }
      return savedEntry;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function saveProductivityGoals(payload) {
    const goalsPayload = Array.isArray(payload.goals) ? payload.goals : [payload];
    const apiPayload = {
      ...(payload.applyAll ? { apply_all: true } : {}),
      ...(payload.goals ? {
        goals: goalsPayload.map((goal) => ({
          user_id: goal.userId || goal.user_id,
          daily_hours: goal.dailyHours ?? goal.daily_hours,
          weekly_hours: goal.weeklyHours ?? goal.weekly_hours,
        })),
      } : {
        user_id: payload.userId || payload.user_id,
        daily_hours: payload.dailyHours ?? payload.daily_hours,
        weekly_hours: payload.weeklyHours ?? payload.weekly_hours,
      }),
    };

    try {
      const response = await api.saveProductivityGoals(apiPayload);
      const savedGoals = productivityGoalsFromResponse(response);
      setProductivityGoals(savedGoals);
      addFlash('Metas atualizadas.', 'success');
      return savedGoals;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function saveProspect(payload) {
    return saveEntity({
      id: payload.id,
      createFn: () => api.createProspect(prospectToPayload(payload)),
      updateFn: (id) => api.updateProspect(id, prospectToPayload(payload)),
      fromResponse: prospectFromResponse,
      onSuccess: (saved) => setProspects((current) => replaceById(current, saved)),
      addFlash,
      createMsg: 'Prospect salvo.',
      updateMsg: 'Prospect atualizado.',
    });
  }

  function deleteProspect(prospectId) {
    return deleteEntity({
      deleteFn: () => api.deleteProspect(prospectId),
      onSuccess: () => setProspects((current) => current.filter((item) => item.id !== prospectId)),
      addFlash,
      successMsg: 'Prospect deletado.',
    });
  }

  async function addInteracao(prospectId, payload) {
    try {
      const response = await api.createInteracao(prospectId, interactionToPayload(payload));
      const savedInteraction = interactionFromResponse(response);
      setProspects((current) =>
        current.map((item) => {
          if (item.id !== prospectId) return item;
          return {
            ...item,
            lastContact: (savedInteraction?.date || '').slice(0, 10) || item.lastContact,
            interactionsCount: (item.interactionsCount || 0) + 1,
            interactions: [savedInteraction, ...(item.interactions || [])],
          };
        }),
      );
      addFlash('Interação registrada.', 'success');
      return savedInteraction;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function convertProspect(prospectId, payload = {}) {
    try {
      const response = await api.convertProspect(prospectId, payload);
      const savedProspect = prospectFromResponse(response);
      const savedClient = clientFromResponse(response);
      if (savedProspect) {
        setProspects((current) => replaceById(current, savedProspect));
      }
      if (savedClient) {
        setClients((current) => sortByName(replaceById(current, savedClient)));
      }
      addFlash('Prospect convertido em cliente.', 'success');
      return { prospect: savedProspect, client: savedClient };
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function saveLancamento(payload) {
    return saveEntity({
      id: payload.id,
      createFn: () => api.createLancamento(lancamentoToPayload(payload)),
      updateFn: (id) => api.updateLancamento(id, lancamentoToPayload(payload)),
      fromResponse: lancamentoFromResponse,
      onSuccess: (saved) => setLancamentos((current) => replaceById(current, saved)),
      addFlash,
      createMsg: 'Lançamento salvo.',
      updateMsg: 'Lançamento atualizado.',
    });
  }

  function deleteLancamento(lancamentoId) {
    return deleteEntity({
      deleteFn: () => api.deleteLancamento(lancamentoId),
      onSuccess: () => setLancamentos((current) => current.filter((item) => item.id !== lancamentoId)),
      addFlash,
      successMsg: 'Lançamento deletado.',
    });
  }

  async function marcarLancamentoPago(lancamentoId, paymentDate) {
    try {
      const response = await api.marcarLancamentoPago(lancamentoId, { data_pagamento: paymentDate });
      const saved = lancamentoFromResponse(response);
      if (saved) {
        setLancamentos((current) => replaceById(current, saved));
      }
      addFlash('Lançamento marcado como pago.', 'success');
      return saved;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  async function cancelarLancamento(lancamentoId) {
    try {
      const response = await api.cancelarLancamento(lancamentoId);
      const saved = lancamentoFromResponse(response);
      if (saved) {
        setLancamentos((current) => replaceById(current, saved));
      }
      addFlash('Lançamento cancelado.', 'info');
      return saved;
    } catch (error) {
      addFlash(errorMessage(error), 'error');
      return null;
    }
  }

  const currentUser = users.find((user) => user.id === currentUserId) || currentSessionUser;
  const currentRole = currentUser ? {
    id: currentUser.roleId || currentUser.roleName || '',
    name: currentUser.roleName || currentUser.roleId || '',
  } : null;

  function hasPermission(path) {
    if (currentUser?.isAdmin || currentRole?.name === 'Administrador') {
      return true;
    }
    return Boolean(accessFlags[path]);
  }

  async function loadAudit(filters = {}) {
    try {
      const params = { limit: 50, offset: 0, ...filters };
      const payload = await api.listAudit(params);
      setAuditEntries(auditFromListResponse(payload));
      setAuditPagination(auditPaginationFromResponse(payload));
      setAuditFilters(filters);
    } catch (error) {
      addFlash(errorMessage(error), 'error');
    }
  }

  async function loadMoreAudit() {
    try {
      const nextOffset = auditPagination.offset + auditPagination.limit;
      const params = { ...auditFilters, limit: auditPagination.limit, offset: nextOffset };
      const payload = await api.listAudit(params);
      const newEntries = auditFromListResponse(payload);
      setAuditEntries((prev) => [...prev, ...newEntries]);
      setAuditPagination(auditPaginationFromResponse(payload));
    } catch (error) {
      addFlash(errorMessage(error), 'error');
    }
  }

  async function loadAuditOverview(periodo = 7) {
    try {
      const payload = await api.getAuditOverview(periodo);
      setAuditOverview(auditOverviewFromResponse(payload));
    } catch (error) {
      addFlash(errorMessage(error), 'error');
    }
  }

  const value = {
    users,
    clients,
    processes,
    events,
    deadlines,
    petitions,
    prospects,
    lancamentos,
    timeEntries,
    productivityGoals,
    auditEntries,
    auditOverview,
    auditPagination,
    loadAudit,
    loadMoreAudit,
    loadAuditOverview,
    currentUser,
    currentRole,
    hasPermission,
    isApiEnabled,
    isLoading,
    isEventsLoading,
    isDeadlinesLoading,
    isPetitionsLoading,
    apiStatus,
    addFlash,
    sair,
    saveClient,
    saveProcess,
    saveEvent,
    markEventAttendance,
    moveEvent,
    saveDeadline,
    createDeadlineDocument,
    uploadDeadlineDocument,
    removeDeadlineDocument,
    savePetition,
    createPetitionDocument,
    removePetitionDocument,
    saveDeadlineTimer,
    syncGoogleCalendarEvents,
    loadEvent,
    loadDeadline,
    loadPetition,
    saveUser,
    deleteClient,
    deleteProcess,
    deleteEvent,
    deleteDeadline,
    deletePetition,
    deleteUser,
    saveProspect,
    deleteProspect,
    addInteracao,
    convertProspect,
    saveLancamento,
    deleteLancamento,
    marcarLancamentoPago,
    cancelarLancamento,
    startTimeEntry,
    pauseTimeEntry,
    resumeTimeEntry,
    stopTimeEntry,
    saveProductivityGoals,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState deve ser usado dentro de AppStateProvider.');
  }

  return context;
}

