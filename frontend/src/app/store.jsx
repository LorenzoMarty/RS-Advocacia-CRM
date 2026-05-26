/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';

import { api, isApiEnabled, isDeadlinesApiEnabled, isEventsApiEnabled, isPetitionsApiEnabled } from './api';

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

function collectionFromResponse(payload, key) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload?.[key] || [];
}

function itemFromResponse(payload, key) {
  if (payload?.id) {
    return payload;
  }

  return payload?.[key] || null;
}

function usersFromResponse(payload) {
  return collectionFromResponse(payload, 'usuarios').map(userFromApi).filter(Boolean);
}

function userFromResponse(payload) {
  return userFromApi(itemFromResponse(payload, 'usuario'));
}

function rolesFromResponse(payload) {
  return collectionFromResponse(payload, 'cargos')
    .map(roleFromApi)
    .filter((role) => role && role.id && role.name);
}

function roleFromResponse(payload) {
  return roleFromApi(itemFromResponse(payload, 'cargo'));
}

function clientsFromResponse(payload) {
  return collectionFromResponse(payload, 'clientes').map(clientFromApi).filter(Boolean);
}

function clientFromResponse(payload) {
  return clientFromApi(itemFromResponse(payload, 'cliente'));
}

function processesFromResponse(payload) {
  return collectionFromResponse(payload, 'processos').map(processFromApi).filter(Boolean);
}

function processFromResponse(payload) {
  return processFromApi(itemFromResponse(payload, 'processo'));
}

function eventsFromResponse(payload) {
  return collectionFromResponse(payload, 'eventos').map(eventFromApi).filter(Boolean);
}

function eventFromResponse(payload) {
  return eventFromApi(itemFromResponse(payload, 'evento'));
}

function deadlinesFromResponse(payload) {
  return collectionFromResponse(payload, 'prazos').map(deadlineFromApi).filter(Boolean);
}

function deadlineFromResponse(payload) {
  return deadlineFromApi(itemFromResponse(payload, 'prazo'));
}

function petitionsFromResponse(payload) {
  return collectionFromResponse(payload, 'peticoes').map(petitionFromApi).filter(Boolean);
}

function petitionFromResponse(payload) {
  return petitionFromApi(itemFromResponse(payload, 'peticao'));
}

function permissionGroupsFromResponse(payload) {
  return collectionFromResponse(payload, 'grupos_permissoes').map((group) => ({
    key: group.chave || '',
    label: group.rotulo || '',
    permissions: (group.permissoes || []).map((permission) => ({
      id: String(permission.id),
      path: permission.caminho || '',
      displayName: permission.nome || '',
      modelLabel: permission.modelo || '',
      app: permission.modulo || '',
      action: {
        criar: 'create',
        editar: 'edit',
        excluir: 'delete',
        visualizar: 'view',
      }[permission.acao] || permission.acao || 'view',
    })),
  }));
}

function roleFromApi(role) {
  if (!role) {
    return null;
  }

  return {
    ...role,
    id: String(role.id || role.pk || role.nome),
    name: role.nome || '',
    permissionIds: (role.permissoes || [])
      .map(String),
  };
}

function userFromApi(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    id: String(user.id || user.pk),
    name: user.nome || '',
    email: user.email || '',
    picture: user.foto || '',
    roleId: String(user.cargo_id || user.cargo || ''),
    googleCalendarConnected: Boolean(user.google_calendar_conectado),
    googleCalendarDestination: user.google_calendar_destino || 'agenda principal do Google',
  };
}

function clientFromApi(client) {
  if (!client) {
    return null;
  }

  return {
    ...client,
    id: String(client.id || client.pk),
    name: client.nome || '',
    email: client.email || '',
    phone: client.telefone || '',
    document: client.cpf || '',
    clientType: client.tipo_cliente || 'esporadico',
    notes: client.obs || '',
  };
}

function processFromApi(process) {
  if (!process) {
    return null;
  }

  return {
    ...process,
    id: String(process.id || process.pk),
    number: process.numero_processo || '',
    clientId: String(process.cliente_id || ''),
    clientName: process.cliente_nome || '',
    description: process.descricao || '',
    court: process.vara || '',
    area: process.area_juridica || '',
    status: process.status || '',
    owner: process.advogado_responsavel || '',
  };
}

function eventFromApi(event) {
  if (!event) {
    return null;
  }

  return {
    ...event,
    id: String(event.id || event.pk),
    title: event.titulo || '',
    description: event.descricao || '',
    start: event.data_inicio || '',
    end: event.data_fim || '',
    type: event.tipo_evento || '',
    status: event.status || '',
    priority: event.prioridade || '',
    clientId: String(event.cliente_id || ''),
    clientName: event.cliente_nome || '',
    processId: String(event.processo_id || ''),
    processNumber: event.processo_numero || '',
    responsible: event.responsavel || '',
    createdBy: event.criado_por || '',
    location: event.local || '',
    notes: event.observacoes || '',
    reminderAt: event.lembrete_em || '',
    completed: Boolean(event.concluido),
  };
}

function deadlineFromApi(deadline) {
  if (!deadline) {
    return null;
  }

  return {
    ...deadline,
    id: String(deadline.id || deadline.pk),
    title: deadline.titulo || '',
    description: deadline.descricao || '',
    date: deadline.data_limite || '',
    status: deadline.status || '',
    priority: deadline.prioridade || '',
    clientId: String(deadline.cliente_id || ''),
    clientName: deadline.cliente_nome || '',
    processId: String(deadline.processo_id || ''),
    processNumber: deadline.processo_numero || '',
    responsible: deadline.responsavel || '',
    createdBy: deadline.criado_por || '',
    notes: deadline.observacoes || '',
    completed: Boolean(deadline.concluido),
    elapsedSeconds: Number(deadline.tempo_decorrido_segundos || 0),
    timerStartedAt: deadline.timer_iniciado_em || '',
  };
}

function clientToPayload(client) {
  return {
    nome: client.name,
    cpf: client.document,
    tipo_cliente: client.clientType,
    telefone: client.phone,
    email: client.email,
    obs: client.notes,
  };
}

function processToPayload(process) {
  return {
    numero_processo: process.number,
    cliente: process.clientId,
    descricao: process.description,
    vara: process.court,
    area_juridica: process.area,
    status: process.status,
    advogado_responsavel: process.owner,
  };
}

function eventToPayload(event) {
  return {
    titulo: event.title,
    tipo_evento: event.type,
    prioridade: event.priority,
    descricao: event.description,
    data_inicio: event.start,
    data_fim: event.end,
    lembrete_em: event.reminderAt || null,
    cliente: event.clientId,
    processo: event.processId,
    responsavel: event.responsible,
    status: event.status,
    local: event.location,
    observacoes: event.notes,
    concluido: Boolean(event.completed),
  };
}

function petitionFromApi(petition) {
  if (!petition) {
    return null;
  }

  return {
    ...petition,
    id: String(petition.id || petition.pk),
    clientId: String(petition.cliente_id || ''),
    clientName: petition.cliente_nome || '',
    processId: String(petition.processo_id || petition.processId || ''),
    processNumber: petition.processo_numero || petition.processNumber || '',
    type: petition.tipo || petition.type || 'Petição',
    adversary: petition.adverso || '',
    responsible: petition.responsavel_acao || '',
    driveLink: petition.link_drive || '',
    pendingReason: petition.motivo_pendente || '',
    area: petition.area_juridica || '',
    status: petition.status || '',
    createdBy: petition.criado_por || '',
    createdAt: petition.criado_em || '',
    updatedAt: petition.atualizado_em || '',
  };
}

function deadlineToPayload(deadline) {
  return {
    titulo: deadline.title,
    descricao: deadline.description,
    data_limite: deadline.date,
    processo: deadline.processId,
    responsavel: deadline.responsible,
    status: deadline.status,
    prioridade: deadline.priority,
    observacoes: deadline.notes,
    concluido: Boolean(deadline.completed),
  };
}

function petitionToPayload(petition) {
  return {
    cliente: petition.clientId,
    processo: petition.processId || '',
    tipo: petition.type || 'Petição',
    adverso: petition.adversary,
    responsavel_acao: petition.responsible,
    link_drive: petition.driveLink,
    motivo_pendente: petition.pendingReason,
    area_juridica: petition.area,
    status: petition.status,
  };
}

function deadlineTimerToPayload(timer) {
  return {
    tempo_decorrido_segundos: Math.max(0, Math.floor(Number(timer.elapsedSeconds) || 0)),
    timer_iniciado_em: timer.timerStartedAt || null,
  };
}

function userToPayload(user) {
  return {
    nome: user.name,
    email: user.email,
    cargo_id: user.roleId,
  };
}

function roleToPayload(role) {
  return {
    nome: role.name,
    permissoes: role.permissionIds,
  };
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

function demoDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function demoDateTime(offset, time) {
  return `${demoDate(offset)}T${time}:00`;
}

function createDemoState() {
  const today = demoDate(0);
  const tomorrow = demoDate(1);
  const nextWeek = demoDate(7);

  const roles = [
    { id: 'demo-role-admin', name: 'Administrador', permissionIds: [] },
    { id: 'demo-role-lawyer', name: 'Advogado', permissionIds: [] },
    { id: 'demo-role-assistant', name: 'Assistente juridico', permissionIds: [] },
  ];

  const users = [
    {
      id: 'demo-user-renata',
      name: 'Renata Sampaio',
      email: 'renata@rsadvocacia.demo',
      picture: '',
      roleId: 'demo-role-admin',
      googleCalendarConnected: false,
      googleCalendarDestination: 'agenda principal do Google',
    },
    {
      id: 'demo-user-mariana',
      name: 'Mariana Souza',
      email: 'mariana@rsadvocacia.demo',
      picture: '',
      roleId: 'demo-role-lawyer',
      googleCalendarConnected: false,
      googleCalendarDestination: 'agenda principal do Google',
    },
    {
      id: 'demo-user-lorenzo',
      name: 'Lorenzo dos Reis',
      email: 'lorenzo@rsadvocacia.demo',
      picture: '',
      roleId: 'demo-role-assistant',
      googleCalendarConnected: false,
      googleCalendarDestination: 'agenda principal do Google',
    },
  ];

  const clients = [
    {
      id: 'demo-client-bruno',
      name: 'Bruno Lima',
      email: 'bruno.lima@email.demo',
      phone: '(11) 98888-1200',
      document: '12345678909',
      clientType: 'mensalista',
      notes: 'Cliente com acompanhamento ativo em demanda civel e prazos fatais nesta semana.',
    },
    {
      id: 'demo-client-almeida',
      name: 'Almeida Comercio LTDA',
      email: 'juridico@almeidacomercio.demo',
      phone: '(11) 3777-4400',
      document: '12345678000190',
      clientType: 'mensalista',
      notes: 'Contrato mensal para consultivo empresarial e contencioso trabalhista.',
    },
    {
      id: 'demo-client-ana',
      name: 'Ana Ribeiro',
      email: 'ana.ribeiro@email.demo',
      phone: '(21) 97777-8844',
      document: '98765432100',
      clientType: 'esporadico',
      notes: 'Atendimento pontual em acao indenizatoria.',
    },
  ];

  const processes = [
    {
      id: 'demo-process-bruno',
      number: '1000002-20.2026.8.26.0100',
      clientId: 'demo-client-bruno',
      clientName: 'Bruno Lima',
      description: 'Acao de obrigacao de fazer com pedido de tutela de urgencia.',
      court: '12a Vara Civel de Sao Paulo',
      area: 'Civel',
      status: 'Em andamento',
      owner: 'Mariana Souza',
    },
    {
      id: 'demo-process-almeida',
      number: '0002451-77.2026.5.02.0031',
      clientId: 'demo-client-almeida',
      clientName: 'Almeida Comercio LTDA',
      description: 'Reclamacao trabalhista com audiencia inicial designada.',
      court: '31a Vara do Trabalho de Sao Paulo',
      area: 'Trabalhista',
      status: 'Aguardando despacho',
      owner: 'Renata Sampaio',
    },
    {
      id: 'demo-process-ana',
      number: '0801123-45.2026.8.19.0001',
      clientId: 'demo-client-ana',
      clientName: 'Ana Ribeiro',
      description: 'Acao indenizatoria por danos materiais e morais.',
      court: '5a Vara Civel do Rio de Janeiro',
      area: 'Civel',
      status: 'Ativo',
      owner: 'Mariana Souza',
    },
  ];

  const events = [
    {
      id: 'demo-event-audiencia',
      title: 'Audiencia de conciliacao',
      description: 'Audiencia virtual. Conferir documentos e proposta antes do horario.',
      start: demoDateTime(0, '09:30'),
      end: demoDateTime(0, '10:30'),
      type: 'Audiencia',
      status: 'Agendado',
      priority: 'Alta',
      clientId: 'demo-client-bruno',
      clientName: 'Bruno Lima',
      processId: 'demo-process-bruno',
      processNumber: '1000002-20.2026.8.26.0100',
      responsible: 'Mariana Souza',
      createdBy: 'Renata Sampaio',
      location: 'Videoconferencia',
      notes: 'Enviar link ao cliente 30 minutos antes.',
      reminderAt: demoDateTime(0, '09:00'),
      completed: false,
    },
    {
      id: 'demo-event-reuniao',
      title: 'Reuniao de alinhamento trabalhista',
      description: 'Revisar documentos de jornada e estrategia para audiencia.',
      start: demoDateTime(1, '14:00'),
      end: demoDateTime(1, '15:00'),
      type: 'Reuniao',
      status: 'Agendado',
      priority: 'Media',
      clientId: 'demo-client-almeida',
      clientName: 'Almeida Comercio LTDA',
      processId: 'demo-process-almeida',
      processNumber: '0002451-77.2026.5.02.0031',
      responsible: 'Renata Sampaio',
      createdBy: 'Lorenzo dos Reis',
      location: 'Escritorio',
      notes: 'Separar contrato social e controles de ponto.',
      reminderAt: demoDateTime(1, '13:30'),
      completed: false,
    },
    {
      id: 'demo-event-tarefa',
      title: 'Conferir documentos do cliente',
      description: 'Checklist de provas antes do protocolo.',
      start: demoDateTime(0, '16:00'),
      end: demoDateTime(0, '16:30'),
      type: 'Tarefa interna',
      status: 'Pendente',
      priority: 'Media',
      clientId: 'demo-client-ana',
      clientName: 'Ana Ribeiro',
      processId: 'demo-process-ana',
      processNumber: '0801123-45.2026.8.19.0001',
      responsible: 'Lorenzo dos Reis',
      createdBy: 'Mariana Souza',
      location: '',
      notes: 'Validar notas fiscais e comprovantes.',
      reminderAt: '',
      completed: false,
    },
  ];

  const deadlines = [
    {
      id: 'demo-deadline-contestacao',
      title: '1000002-20.2026.8.26.0100 - Bruno Lima',
      description: 'Preparar contestacao e documentos para protocolo.',
      date: today,
      status: 'Pendente',
      priority: 'Alta',
      clientId: 'demo-client-bruno',
      clientName: 'Bruno Lima',
      processId: 'demo-process-bruno',
      processNumber: '1000002-20.2026.8.26.0100',
      responsible: 'Mariana Souza',
      createdBy: 'Renata Sampaio',
      notes: 'Conferir procuracao e comprovantes anexos.',
      completed: false,
      elapsedSeconds: 2700,
      timerStartedAt: '',
    },
    {
      id: 'demo-deadline-manifestacao',
      title: '0002451-77.2026.5.02.0031 - Almeida Comercio LTDA',
      description: 'Manifestacao sobre documentos juntados pela parte reclamante.',
      date: tomorrow,
      status: 'Em andamento',
      priority: 'Alta',
      clientId: 'demo-client-almeida',
      clientName: 'Almeida Comercio LTDA',
      processId: 'demo-process-almeida',
      processNumber: '0002451-77.2026.5.02.0031',
      responsible: 'Renata Sampaio',
      createdBy: 'Lorenzo dos Reis',
      notes: 'Revisar holerites e controles de ponto.',
      completed: false,
      elapsedSeconds: 5400,
      timerStartedAt: '',
    },
    {
      id: 'demo-deadline-protocolo',
      title: '0801123-45.2026.8.19.0001 - Ana Ribeiro',
      description: 'Protocolar peticao inicial revisada.',
      date: nextWeek,
      status: 'Protocolar',
      priority: 'Media',
      clientId: 'demo-client-ana',
      clientName: 'Ana Ribeiro',
      processId: 'demo-process-ana',
      processNumber: '0801123-45.2026.8.19.0001',
      responsible: 'Mariana Souza',
      createdBy: 'Renata Sampaio',
      notes: 'Aguardar assinatura final.',
      completed: false,
      elapsedSeconds: 0,
      timerStartedAt: '',
    },
  ];

  const petitions = [
    {
      id: 'demo-petition-bruno',
      clientId: 'demo-client-bruno',
      clientName: 'Bruno Lima',
      processId: 'demo-process-bruno',
      processNumber: '1000002-20.2026.8.26.0100',
      type: 'Contestação',
      adversary: 'Companhia Alfa S/A',
      responsible: 'Mariana Souza',
      driveLink: 'https://drive.google.com/',
      pendingReason: 'Aguardando confirmacao de documentos complementares.',
      area: 'Civel',
      status: 'Pendente',
      createdBy: 'Renata Sampaio',
      createdAt: `${today}T08:30:00`,
      updatedAt: `${today}T11:20:00`,
    },
    {
      id: 'demo-petition-almeida',
      clientId: 'demo-client-almeida',
      clientName: 'Almeida Comercio LTDA',
      processId: 'demo-process-almeida',
      processNumber: '0002451-77.2026.5.02.0031',
      type: 'Contestação',
      adversary: 'Joao Pereira',
      responsible: 'Renata Sampaio',
      driveLink: 'https://drive.google.com/',
      pendingReason: '',
      area: 'Trabalhista',
      status: 'Em andamento',
      createdBy: 'Lorenzo dos Reis',
      createdAt: `${today}T09:00:00`,
      updatedAt: `${today}T13:10:00`,
    },
    {
      id: 'demo-petition-ana',
      clientId: 'demo-client-ana',
      clientName: 'Ana Ribeiro',
      processId: 'demo-process-ana',
      processNumber: '0801123-45.2026.8.19.0001',
      type: 'Petição',
      adversary: 'Beta Seguradora',
      responsible: 'Mariana Souza',
      driveLink: '',
      pendingReason: '',
      area: 'Civel',
      status: 'Protocolar',
      createdBy: 'Renata Sampaio',
      createdAt: `${today}T10:15:00`,
      updatedAt: `${today}T15:40:00`,
    },
  ];

  return {
    permissionGroups: [],
    roles,
    users,
    clients,
    processes,
    events,
    deadlines,
    petitions,
    currentUser: users[0],
  };
}

export function AppStateProvider({ children }) {
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [events, setEvents] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [petitions, setPetitions] = useState([]);
  const [flashes, setFlashes] = useState([]);
  const [isLoading, setIsLoading] = useState(isApiEnabled || isEventsApiEnabled || isDeadlinesApiEnabled || isPetitionsApiEnabled);
  const [apiStatus, setApiStatus] = useState((isApiEnabled || isEventsApiEnabled || isDeadlinesApiEnabled || isPetitionsApiEnabled) ? 'loading' : 'local');
  const [isEventsLoading, setIsEventsLoading] = useState(isEventsApiEnabled);
  const [isDeadlinesLoading, setIsDeadlinesLoading] = useState(isDeadlinesApiEnabled);
  const [isPetitionsLoading, setIsPetitionsLoading] = useState(isPetitionsApiEnabled);
  const [currentSessionUser, setCurrentSessionUser] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('rs-advocacia-user') || null);
  const isDemoMode = apiStatus === 'demo';
  const canUseApi = isApiEnabled && !isDemoMode;
  const canUseEventsApi = isEventsApiEnabled && !isDemoMode;
  const canUseDeadlinesApi = isDeadlinesApiEnabled && !isDemoMode;
  const canUsePetitionsApi = isPetitionsApiEnabled && !isDemoMode;

  function applyDemoState() {
    const demoState = createDemoState();
    setPermissionGroups(demoState.permissionGroups);
    setRoles(sortByName(demoState.roles));
    setUsers(sortByName(demoState.users));
    setClients(sortByName(demoState.clients));
    setProcesses(demoState.processes);
    setEvents(demoState.events);
    setDeadlines(demoState.deadlines);
    setPetitions(demoState.petitions);
    setCurrentSessionUser(demoState.currentUser);
    setCurrentUserId(demoState.currentUser.id);
  }

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
    if (payload.grupos_permissoes) {
      setPermissionGroups(permissionGroupsFromResponse(payload));
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'cargos')) {
      setRoles(sortByName(rolesFromResponse(payload)));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'usuarios')) {
      setUsers((currentUsers) => sortByName(mergeById(currentUsers, usersFromResponse(payload))));
    }
    setClients(sortByName(clientsFromResponse(payload)));
    setProcesses(processesFromResponse(payload));
    setEvents(eventsFromResponse(payload));
    setDeadlines(deadlinesFromResponse(payload));
    setPetitions(petitionsFromResponse(payload));
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
        load: api.listRoles,
        apply: (payload) => setRoles(sortByName(rolesFromResponse(payload))),
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
      applyDemoState();
      setApiStatus('demo');
      setIsLoading(false);
      setIsEventsLoading(false);
      setIsDeadlinesLoading(false);
      setIsPetitionsLoading(false);
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

        applyDemoState();
        setApiStatus('demo');
        addFlash(`Modo demo carregado. API indisponivel: ${errorMessage(error)}`, 'info');
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

  async function sair() {
    if (canUseApi) {
      try {
        await api.sair();
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
    setDeadlines([]);
    setPetitions([]);
    addFlash('Sessão encerrada.', 'info');
  }

  async function saveClient(payload) {
    if (canUseApi) {
      try {
        const response = payload.id
          ? await api.updateClient(payload.id, clientToPayload(payload))
          : await api.createClient(clientToPayload(payload));
        const savedClient = clientFromResponse(response);
        if (!savedClient) {
          throw new Error('Resposta inválida da API de clientes.');
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
    if (canUseApi) {
      try {
        const response = payload.id
          ? await api.updateProcess(payload.id, processToPayload(payload))
          : await api.createProcess(processToPayload(payload));
        const savedProcess = processFromResponse(response);
        if (!savedProcess) {
          throw new Error('Resposta inválida da API de processos.');
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
    if (canUseEventsApi) {
      try {
        const response = payload.id
          ? await api.updateEvent(payload.id, eventToPayload(payload))
          : await api.createEvent(eventToPayload(payload));
        const savedEvent = eventFromResponse(response);
        if (!savedEvent) {
          throw new Error('Resposta inválida da API de eventos.');
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

  async function saveDeadline(payload) {
    if (canUseDeadlinesApi) {
      try {
        const response = payload.id
          ? await api.updateDeadline(payload.id, deadlineToPayload(payload))
          : await api.createDeadline(deadlineToPayload(payload));
        const savedDeadline = deadlineFromResponse(response);
        if (!savedDeadline) {
          throw new Error('Resposta invalida da API de prazos.');
        }
        setDeadlines((currentDeadlines) => replaceById(currentDeadlines, savedDeadline));
        addFlash(payload.id ? 'Prazo atualizado.' : 'Prazo salvo.', 'success');
        return savedDeadline;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      setDeadlines((currentDeadlines) =>
        currentDeadlines.map((deadline) => (deadline.id === payload.id ? { ...deadline, ...payload } : deadline)),
      );
      addFlash('Prazo atualizado.', 'success');
      return payload;
    }

    const nextDeadline = { ...payload, id: nextId('deadline') };
    setDeadlines((currentDeadlines) => [...currentDeadlines, nextDeadline]);
    addFlash('Prazo salvo.', 'success');
    return nextDeadline;
  }

  async function savePetition(payload) {
    if (canUsePetitionsApi) {
      try {
        const response = payload.id
          ? await api.updatePetition(payload.id, petitionToPayload(payload))
          : await api.createPetition(petitionToPayload(payload));
        const savedPetition = petitionFromResponse(response);
        if (!savedPetition) {
          throw new Error('Resposta invalida da API de peticoes.');
        }
        setPetitions((currentPetitions) => replaceById(currentPetitions, savedPetition));
        addFlash(payload.id ? 'Peticao atualizada.' : 'Peticao salva.', 'success');
        return savedPetition;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      setPetitions((currentPetitions) =>
        currentPetitions.map((petition) => (petition.id === payload.id ? { ...petition, ...payload } : petition)),
      );
      addFlash('Peticao atualizada.', 'success');
      return payload;
    }

    const nextPetition = { ...payload, id: nextId('petition') };
    setPetitions((currentPetitions) => [...currentPetitions, nextPetition]);
    addFlash('Peticao salva.', 'success');
    return nextPetition;
  }

  async function loadEvent(eventId) {
    if (!canUseEventsApi) {
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

  async function loadDeadline(deadlineId) {
    if (!canUseDeadlinesApi) {
      return deadlines.find((deadline) => deadline.id === deadlineId) || null;
    }

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
    if (!canUsePetitionsApi) {
      return petitions.find((petition) => petition.id === petitionId) || null;
    }

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
    if (!canUseEventsApi) {
      addFlash('API de eventos nao configurada.', 'error');
      return null;
    }

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

    if (canUseDeadlinesApi) {
      try {
        const response = await api.updateDeadlineTimer(deadlineId, deadlineTimerToPayload(timerPayload));
        const savedDeadline = deadlineFromResponse(response);
        if (!savedDeadline) {
          throw new Error('Resposta invalida da API de prazos.');
        }
        setDeadlines((currentDeadlines) => replaceById(currentDeadlines, savedDeadline));
        return savedDeadline;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    let savedDeadline = null;
    setDeadlines((currentDeadlines) =>
      currentDeadlines.map((deadline) => {
        if (deadline.id !== deadlineId) {
          return deadline;
        }

        savedDeadline = { ...deadline, ...timerPayload };
        return savedDeadline;
      }),
    );
    return savedDeadline;
  }

  async function saveUser(payload) {
    if (canUseApi) {
      try {
        const response = payload.id
          ? await api.updateUser(payload.id, userToPayload(payload))
          : await api.createUser(userToPayload(payload));
        const savedUser = userFromResponse(response);
        if (!savedUser) {
          throw new Error('Resposta inválida da API de usuários.');
        }
        setUsers((currentUsers) => sortByName(replaceById(currentUsers, savedUser)));
        if (savedUser.id === currentUserId) {
          setCurrentSessionUser(savedUser);
        }
        addFlash(payload.id ? 'Usuário atualizado.' : 'Usuário criado.', 'success');
        return savedUser;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (!payload.id) {
      const nextUser = { ...payload, id: nextId('user') };
      setUsers((currentUsers) => sortByName([...currentUsers, nextUser]));
      addFlash('Usuário criado.', 'success');
      return nextUser;
    }

    let savedUser = null;
    setUsers((currentUsers) =>
      sortByName(currentUsers.map((user) => {
        if (user.id !== payload.id) {
          return user;
        }

        savedUser = { ...user, ...payload };
        return savedUser;
      })),
    );
    addFlash('Usuário atualizado.', 'success');
    return savedUser || payload;
  }

  async function saveRole(payload) {
    if (canUseApi) {
      try {
        const response = payload.id
          ? await api.updateRole(payload.id, roleToPayload(payload))
          : await api.createRole(roleToPayload(payload));
        const savedRole = roleFromResponse(response);
        if (!savedRole) {
          throw new Error('Resposta inválida da API de cargos.');
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
    if (canUseApi) {
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
    setDeadlines((currentDeadlines) =>
      currentDeadlines.filter((deadline) => deadline.clientId !== clientId && !relatedProcessIds.includes(deadline.processId)),
    );
    setPetitions((currentPetitions) => currentPetitions.filter((petition) => petition.clientId !== clientId));
    addFlash('Cliente excluído.', 'success');
    return true;
  }

  async function deleteProcess(processId) {
    if (canUseApi) {
      try {
        await api.deleteProcess(processId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setProcesses((currentProcesses) => currentProcesses.filter((process) => process.id !== processId));
    setEvents((currentEvents) => currentEvents.filter((event) => event.processId !== processId));
    setDeadlines((currentDeadlines) => currentDeadlines.filter((deadline) => deadline.processId !== processId));
    setPetitions((currentPetitions) =>
      currentPetitions.map((petition) =>
        petition.processId === processId ? { ...petition, processId: '', processNumber: '' } : petition,
      ),
    );
    addFlash('Processo excluído.', 'success');
    return true;
  }

  async function deleteEvent(eventId) {
    if (canUseEventsApi) {
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

  async function deleteDeadline(deadlineId) {
    if (canUseDeadlinesApi) {
      try {
        await api.deleteDeadline(deadlineId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setDeadlines((currentDeadlines) => currentDeadlines.filter((deadline) => deadline.id !== deadlineId));
    addFlash('Prazo excluido.', 'success');
    return true;
  }

  async function deletePetition(petitionId) {
    if (canUsePetitionsApi) {
      try {
        await api.deletePetition(petitionId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setPetitions((currentPetitions) => currentPetitions.filter((petition) => petition.id !== petitionId));
    addFlash('Peticao excluida.', 'success');
    return true;
  }

  async function deleteUser(userId) {
    if (canUseApi) {
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
    if (canUseApi) {
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
    deadlines,
    petitions,
    flashes,
    currentUser,
    currentRole,
    isApiEnabled,
    isLoading,
    isEventsLoading,
    isDeadlinesLoading,
    isPetitionsLoading,
    apiStatus,
    isDemoMode,
    removeFlash,
    addFlash,
    sair,
    saveClient,
    saveProcess,
    saveEvent,
    saveDeadline,
    savePetition,
    saveDeadlineTimer,
    syncGoogleCalendarEvents,
    loadEvent,
    loadDeadline,
    loadPetition,
    saveUser,
    saveRole,
    deleteClient,
    deleteProcess,
    deleteEvent,
    deleteDeadline,
    deletePetition,
    deleteUser,
    deleteRole,
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
