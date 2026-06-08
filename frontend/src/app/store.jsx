/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  api,
  isApiEnabled,
  isDeadlinesApiEnabled,
  isEventsApiEnabled,
  isPetitionsApiEnabled,
  isProductivityApiEnabled,
} from './api';

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

function prospectsFromResponse(payload) {
  return collectionFromResponse(payload, 'prospects').map(prospectFromApi).filter(Boolean);
}

function prospectFromResponse(payload) {
  return prospectFromApi(itemFromResponse(payload, 'prospect'));
}

function interactionFromResponse(payload) {
  return interactionFromApi(itemFromResponse(payload, 'interacao'));
}

function lancamentosFromResponse(payload) {
  return collectionFromResponse(payload, 'lancamentos').map(lancamentoFromApi).filter(Boolean);
}

function lancamentoFromResponse(payload) {
  return lancamentoFromApi(itemFromResponse(payload, 'lancamento'));
}

function timeEntriesFromResponse(payload) {
  return collectionFromResponse(payload, 'time_entries').map(timeEntryFromApi).filter(Boolean);
}

function timeEntryFromResponse(payload) {
  return timeEntryFromApi(itemFromResponse(payload, 'time_entry'));
}

function productivityGoalsFromResponse(payload) {
  return collectionFromResponse(payload, 'productivity_goals').map(productivityGoalFromApi).filter(Boolean);
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
    lastMovementAt: process.data_ultima_movimentacao || null,
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

function prospectFromApi(prospect) {
  if (!prospect) {
    return null;
  }

  return {
    ...prospect,
    id: String(prospect.id || prospect.pk),
    name: prospect.nome || '',
    phone: prospect.telefone || '',
    email: prospect.email || '',
    origin: prospect.origem_contato || '',
    demandType: prospect.tipo_demanda_juridica || '',
    caseDescription: prospect.descricao_caso || '',
    responsibleId: String(prospect.responsavel_id || ''),
    responsibleName: prospect.responsavel_nome || '',
    status: prospect.status_prospeccao || 'Novo',
    priority: prospect.prioridade || 'Media',
    nextAction: prospect.proxima_acao || '',
    notes: prospect.observacoes || '',
    lastContact: prospect.data_ultimo_contato || '',
    convertedClientId: String(prospect.cliente_convertido_id || ''),
    convertedAt: prospect.convertido_em || '',
    interactionsCount: Number(prospect.total_interacoes || 0),
    createdAt: prospect.data_criacao || '',
    interactions: Array.isArray(prospect.interacoes)
      ? prospect.interacoes.map(interactionFromApi).filter(Boolean)
      : (prospect.interactions || []),
  };
}

function interactionFromApi(interaction) {
  if (!interaction) {
    return null;
  }

  return {
    ...interaction,
    id: String(interaction.id || interaction.pk),
    prospectId: String(interaction.prospect_id || interaction.prospectId || ''),
    type: interaction.tipo || interaction.type || 'anotacao',
    description: interaction.descricao || interaction.description || '',
    date: interaction.data || interaction.date || '',
    userId: String(interaction.usuario_id || interaction.userId || ''),
    userName: interaction.usuario_nome || interaction.userName || '',
  };
}

function prospectToPayload(prospect) {
  return {
    nome: prospect.name,
    telefone: prospect.phone,
    email: prospect.email,
    origem_contato: prospect.origin,
    tipo_demanda_juridica: prospect.demandType,
    descricao_caso: prospect.caseDescription,
    responsavel_interno: prospect.responsibleId || null,
    status_prospeccao: prospect.status,
    prioridade: prospect.priority,
    proxima_acao: prospect.nextAction,
    observacoes: prospect.notes,
    data_ultimo_contato: prospect.lastContact || null,
  };
}

function interactionToPayload(interaction) {
  return {
    tipo: interaction.type,
    descricao: interaction.description,
    ...(interaction.date ? { data: interaction.date } : {}),
    ...(interaction.userId ? { usuario: interaction.userId } : {}),
  };
}

function lancamentoFromApi(lancamento) {
  if (!lancamento) {
    return null;
  }

  return {
    ...lancamento,
    id: String(lancamento.id || lancamento.pk),
    description: lancamento.descricao || '',
    type: lancamento.tipo || 'receita',
    category: lancamento.categoria || '',
    value: Number(lancamento.valor || 0),
    dueDate: lancamento.data_vencimento || '',
    paymentDate: lancamento.data_pagamento || '',
    status: lancamento.status || 'Pendente',
    displayStatus: lancamento.status_exibicao || lancamento.status || 'Pendente',
    overdue: Boolean(lancamento.atrasado),
    clientId: String(lancamento.cliente_id || ''),
    clientName: lancamento.cliente_nome || '',
    caseId: String(lancamento.caso_id || ''),
    caseNumber: lancamento.caso_numero || '',
    notes: lancamento.observacoes || '',
    createdAt: lancamento.criado_em || '',
  };
}

function lancamentoToPayload(lancamento) {
  return {
    descricao: lancamento.description,
    tipo: lancamento.type,
    categoria: lancamento.category,
    valor: lancamento.value,
    data_vencimento: lancamento.dueDate,
    data_pagamento: lancamento.paymentDate || null,
    status: lancamento.status,
    cliente_relacionado: lancamento.clientId || null,
    caso_relacionado: lancamento.caseId || null,
    observacoes: lancamento.notes,
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
      status: 'Confirmado',
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
      status: 'Pendente',
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

  const prospects = [
    {
      id: 'demo-prospect-carla',
      name: 'Carla Nogueira',
      phone: '(11) 98123-4567',
      email: 'carla.nogueira@email.demo',
      origin: 'Indicação',
      demandType: 'Trabalhista',
      caseDescription: 'Rescisão indireta com verbas atrasadas.',
      responsibleId: 'demo-user-mariana',
      responsibleName: 'Mariana Souza',
      status: 'Em contato',
      priority: 'Alta',
      nextAction: 'Enviar proposta de honorários',
      notes: '',
      lastContact: today,
      convertedClientId: '',
      convertedAt: '',
      interactionsCount: 1,
      createdAt: `${today}T09:00:00`,
      interactions: [
        {
          id: 'demo-interacao-carla-1',
          prospectId: 'demo-prospect-carla',
          type: 'ligacao',
          description: 'Primeiro contato. Cliente interessada.',
          date: `${today}T09:00:00`,
          userId: 'demo-user-mariana',
          userName: 'Mariana Souza',
        },
      ],
    },
    {
      id: 'demo-prospect-pedro',
      name: 'Pedro Antunes',
      phone: '(11) 97654-3210',
      email: 'pedro.antunes@email.demo',
      origin: 'Site',
      demandType: 'Cível',
      caseDescription: 'Ação indenizatória por danos morais.',
      responsibleId: 'demo-user-renata',
      responsibleName: 'Renata Sampaio',
      status: 'Novo',
      priority: 'Media',
      nextAction: 'Agendar reunião inicial',
      notes: '',
      lastContact: '',
      convertedClientId: '',
      convertedAt: '',
      interactionsCount: 0,
      createdAt: `${today}T11:30:00`,
      interactions: [],
    },
  ];

  const lancamentos = [
    {
      id: 'demo-lancamento-honorarios',
      description: 'Honorários iniciais - Bruno Lima',
      type: 'receita',
      category: 'Honorários',
      value: 3500,
      dueDate: nextWeek,
      paymentDate: '',
      status: 'Pendente',
      displayStatus: 'Pendente',
      overdue: false,
      clientId: 'demo-client-bruno',
      clientName: 'Bruno Lima',
      caseId: 'demo-process-bruno',
      caseNumber: '1000002-20.2026.8.26.0100',
      notes: '',
      createdAt: `${today}T08:00:00`,
    },
    {
      id: 'demo-lancamento-software',
      description: 'Assinatura sistema jurídico',
      type: 'despesa',
      category: 'Software',
      value: 240,
      dueDate: today,
      paymentDate: today,
      status: 'Pago',
      displayStatus: 'Pago',
      overdue: false,
      clientId: '',
      clientName: '',
      caseId: '',
      caseNumber: '',
      notes: '',
      createdAt: `${today}T08:10:00`,
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
    prospects,
    lancamentos,
    timeEntries: [],
    productivityGoals: users.map((user) => ({
      id: `demo-goal-${user.id}`,
      userId: user.id,
      dailyHours: 6,
      weeklyHours: 30,
      configured: false,
    })),
    currentUser: users[0],
  };
}

function timeEntryFromApi(entry) {
  if (!entry) {
    return null;
  }

  return {
    ...entry,
    id: String(entry.id || entry.pk),
    userId: String(entry.user_id || entry.userId || ''),
    userName: entry.user_name || entry.userName || '',
    taskId: String(entry.task_id || entry.taskId || ''),
    taskType: entry.task_type || entry.taskType || '',
    taskName: entry.task_name || entry.taskName || '',
    processId: String(entry.process_id || entry.processId || ''),
    processNumber: entry.process_number || entry.processNumber || '',
    startedAt: entry.started_at || entry.startedAt || '',
    pausedAt: entry.paused_at || entry.pausedAt || '',
    resumedAt: entry.resumed_at || entry.resumedAt || '',
    endedAt: entry.ended_at || entry.endedAt || '',
    totalSeconds: Number(entry.total_seconds ?? entry.totalSeconds ?? 0),
    elapsedSeconds: Number(entry.elapsed_seconds ?? entry.elapsedSeconds ?? entry.total_seconds ?? 0),
    status: entry.status || 'stopped',
  };
}

function productivityGoalFromApi(goal) {
  if (!goal) {
    return null;
  }

  return {
    ...goal,
    id: String(goal.id || goal.pk || ''),
    userId: String(goal.user_id || goal.userId || ''),
    dailyHours: Number(goal.daily_hours ?? goal.dailyHours ?? 6),
    weeklyHours: Number(goal.weekly_hours ?? goal.weeklyHours ?? 30),
    configured: Boolean(goal.configured),
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
  const [prospects, setProspects] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [productivityGoals, setProductivityGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(isApiEnabled || isEventsApiEnabled || isDeadlinesApiEnabled || isPetitionsApiEnabled || isProductivityApiEnabled);
  const [apiStatus, setApiStatus] = useState((isApiEnabled || isEventsApiEnabled || isDeadlinesApiEnabled || isPetitionsApiEnabled || isProductivityApiEnabled) ? 'loading' : 'local');
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
  const canUseProductivityApi = isProductivityApiEnabled && !isDemoMode;

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
    setProspects(demoState.prospects);
    setLancamentos(demoState.lancamentos);
    setTimeEntries(demoState.timeEntries);
    setProductivityGoals(demoState.productivityGoals);
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

  function addFlash(message, type = 'success', options = {}) {
    const duration = options.critical ? Infinity : (options.duration ?? (type === 'error' ? 5200 : 3500));
    if (type === 'error') toast.error(message, { duration });
    else if (type === 'warning') toast.warning(message, { duration });
    else if (type === 'info') toast.info(message, { duration });
    else toast.success(message, { duration });
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
    setProspects([]);
    setLancamentos([]);
    setTimeEntries([]);
    setProductivityGoals([]);
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

  async function saveDeadline(payload, options = {}) {
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
        if (!options.silent) {
          addFlash(payload.id ? 'Prazo atualizado.' : 'Prazo salvo.', 'success');
        }
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
      if (!options.silent) {
        addFlash('Prazo atualizado.', 'success');
      }
      return payload;
    }

    const nextDeadline = { ...payload, id: nextId('deadline') };
    setDeadlines((currentDeadlines) => [...currentDeadlines, nextDeadline]);
    if (!options.silent) {
      addFlash('Prazo salvo.', 'success');
    }
    return nextDeadline;
  }

  async function savePetition(payload, options = {}) {
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
        if (!options.silent) {
          addFlash(payload.id ? 'Petição atualizada.' : 'Petição salva.', 'success');
        }
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
      if (!options.silent) {
        addFlash('Petição atualizada.', 'success');
      }
      return payload;
    }

    const nextPetition = { ...payload, id: nextId('petition') };
    setPetitions((currentPetitions) => [...currentPetitions, nextPetition]);
    if (!options.silent) {
      addFlash('Petição salva.', 'success');
    }
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
    addFlash('Cliente deletado.', 'success');
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
    addFlash('Processo deletado.', 'success');
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
    addFlash('Compromisso deletado.', 'success');
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
    addFlash('Prazo deletado.', 'success');
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
    addFlash('Petição deletada.', 'success');
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
    addFlash('Usuário deletado.', 'success');
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
    addFlash('Cargo deletado.', 'success');
    return true;
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

    if (canUseProductivityApi) {
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
          options.pauseExisting ? pauseRunningEntries(currentEntries, savedEntry.id) : currentEntries,
          savedEntry,
        ));
        return savedEntry;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    const nextEntry = {
      id: nextId('time-entry'),
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
      options.pauseExisting ? pauseRunningEntries(currentEntries, nextEntry.id) : currentEntries,
      nextEntry,
    ));
    return nextEntry;
  }

  async function pauseTimeEntry(entryId) {
    if (canUseProductivityApi) {
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

    const currentTime = Date.now();
    const pausedAt = new Date(currentTime).toISOString();
    let savedEntry = null;
    setTimeEntries((currentEntries) => currentEntries.map((entry) => {
      if (entry.id !== entryId || entry.status !== 'running') {
        return entry;
      }

      savedEntry = {
        ...entry,
        status: 'paused',
        pausedAt,
        totalSeconds: elapsedSecondsForTimeEntry(entry, currentTime),
        elapsedSeconds: elapsedSecondsForTimeEntry(entry, currentTime),
      };
      return savedEntry;
    }));
    return savedEntry;
  }

  async function resumeTimeEntry(entryId, options = {}) {
    const currentTime = Date.now();
    const resumedAt = new Date(currentTime).toISOString();

    if (canUseProductivityApi) {
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

    let savedEntry = null;
    setTimeEntries((currentEntries) => {
      const preparedEntries = options.pauseExisting ? pauseRunningEntries(currentEntries, entryId) : currentEntries;
      return preparedEntries.map((entry) => {
        if (entry.id !== entryId || entry.status !== 'paused') {
          return entry;
        }

        savedEntry = {
          ...entry,
          status: 'running',
          resumedAt,
        };
        return savedEntry;
      });
    });
    return savedEntry;
  }

  async function stopTimeEntry(entryId) {
    if (canUseProductivityApi) {
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

    const currentTime = Date.now();
    const endedAt = new Date(currentTime).toISOString();
    let savedEntry = null;
    setTimeEntries((currentEntries) => currentEntries.map((entry) => {
      if (entry.id !== entryId || entry.status === 'stopped') {
        return entry;
      }

      savedEntry = {
        ...entry,
        status: 'stopped',
        endedAt,
        totalSeconds: elapsedSecondsForTimeEntry(entry, currentTime),
        elapsedSeconds: elapsedSecondsForTimeEntry(entry, currentTime),
      };
      return savedEntry;
    }));
    return savedEntry;
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

    if (canUseProductivityApi) {
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

    setProductivityGoals((currentGoals) => {
      let nextGoals = currentGoals;
      goalsPayload.forEach((goalPayload) => {
        const targetUsers = payload.applyAll && !(goalPayload.userId || goalPayload.user_id)
          ? users
          : users.filter((user) => user.id === String(goalPayload.userId || goalPayload.user_id));
        targetUsers.forEach((user) => {
          nextGoals = replaceById(nextGoals, {
            id: currentGoals.find((goal) => goal.userId === user.id)?.id || `goal-${user.id}`,
            userId: user.id,
            dailyHours: Number(goalPayload.dailyHours ?? goalPayload.daily_hours ?? 6),
            weeklyHours: Number(goalPayload.weeklyHours ?? goalPayload.weekly_hours ?? 30),
            configured: true,
          });
        });
      });
      return nextGoals;
    });
    addFlash('Metas atualizadas.', 'success');
    return productivityGoals;
  }

  async function saveProspect(payload) {
    if (canUseApi) {
      try {
        const response = payload.id
          ? await api.updateProspect(payload.id, prospectToPayload(payload))
          : await api.createProspect(prospectToPayload(payload));
        const savedProspect = prospectFromResponse(response);
        if (!savedProspect) {
          throw new Error('Resposta inválida da API de prospecção.');
        }
        setProspects((current) => replaceById(current, savedProspect));
        addFlash(payload.id ? 'Prospect atualizado.' : 'Prospect salvo.', 'success');
        return savedProspect;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      let saved = null;
      setProspects((current) =>
        current.map((item) => {
          if (item.id !== payload.id) return item;
          saved = { ...item, ...payload };
          return saved;
        }),
      );
      addFlash('Prospect atualizado.', 'success');
      return saved || payload;
    }

    const nextProspect = { ...payload, id: nextId('prospect'), interactions: [], interactionsCount: 0 };
    setProspects((current) => [nextProspect, ...current]);
    addFlash('Prospect salvo.', 'success');
    return nextProspect;
  }

  async function deleteProspect(prospectId) {
    if (canUseApi) {
      try {
        await api.deleteProspect(prospectId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setProspects((current) => current.filter((item) => item.id !== prospectId));
    addFlash('Prospect deletado.', 'success');
    return true;
  }

  async function addInteracao(prospectId, payload) {
    if (canUseApi) {
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

    const nextInteraction = {
      ...payload,
      id: nextId('interacao'),
      prospectId,
      date: payload.date || new Date().toISOString(),
    };
    setProspects((current) =>
      current.map((item) => {
        if (item.id !== prospectId) return item;
        return {
          ...item,
          lastContact: nextInteraction.date.slice(0, 10),
          interactionsCount: (item.interactionsCount || 0) + 1,
          interactions: [nextInteraction, ...(item.interactions || [])],
        };
      }),
    );
    addFlash('Interação registrada.', 'success');
    return nextInteraction;
  }

  async function convertProspect(prospectId, payload = {}) {
    if (canUseApi) {
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

    const prospect = prospects.find((item) => item.id === prospectId) || null;
    if (!prospect) return null;
    if (prospect.convertedClientId) {
      addFlash('Este prospect já foi convertido.', 'error');
      return null;
    }

    let client = payload.cliente_id ? clients.find((item) => item.id === String(payload.cliente_id)) : null;
    if (!client) {
      client = {
        id: nextId('client'),
        name: payload.nome || prospect.name,
        email: payload.email || prospect.email,
        phone: payload.telefone || prospect.phone,
        document: payload.cpf || '',
        clientType: payload.tipo_cliente || 'esporadico',
        notes: prospect.caseDescription || '',
      };
      setClients((current) => sortByName([...current, client]));
    }

    const updatedProspect = {
      ...prospect,
      convertedClientId: client.id,
      convertedAt: new Date().toISOString(),
      status: 'Convertido',
    };
    setProspects((current) => replaceById(current, updatedProspect));
    addFlash('Prospect convertido em cliente.', 'success');
    return { prospect: updatedProspect, client };
  }

  async function saveLancamento(payload) {
    if (canUseApi) {
      try {
        const response = payload.id
          ? await api.updateLancamento(payload.id, lancamentoToPayload(payload))
          : await api.createLancamento(lancamentoToPayload(payload));
        const saved = lancamentoFromResponse(response);
        if (!saved) {
          throw new Error('Resposta inválida da API financeira.');
        }
        setLancamentos((current) => replaceById(current, saved));
        addFlash(payload.id ? 'Lançamento atualizado.' : 'Lançamento salvo.', 'success');
        return saved;
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return null;
      }
    }

    if (payload.id) {
      let saved = null;
      setLancamentos((current) =>
        current.map((item) => {
          if (item.id !== payload.id) return item;
          saved = { ...item, ...payload };
          return saved;
        }),
      );
      addFlash('Lançamento atualizado.', 'success');
      return saved || payload;
    }

    const nextLancamento = { ...payload, id: nextId('lancamento') };
    setLancamentos((current) => [nextLancamento, ...current]);
    addFlash('Lançamento salvo.', 'success');
    return nextLancamento;
  }

  async function deleteLancamento(lancamentoId) {
    if (canUseApi) {
      try {
        await api.deleteLancamento(lancamentoId);
      } catch (error) {
        addFlash(errorMessage(error), 'error');
        return false;
      }
    }

    setLancamentos((current) => current.filter((item) => item.id !== lancamentoId));
    addFlash('Lançamento deletado.', 'success');
    return true;
  }

  async function marcarLancamentoPago(lancamentoId, paymentDate) {
    if (canUseApi) {
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

    let saved = null;
    setLancamentos((current) =>
      current.map((item) => {
        if (item.id !== lancamentoId) return item;
        saved = { ...item, status: 'Pago', displayStatus: 'Pago', overdue: false, paymentDate };
        return saved;
      }),
    );
    addFlash('Lançamento marcado como pago.', 'success');
    return saved;
  }

  async function cancelarLancamento(lancamentoId) {
    if (canUseApi) {
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

    let saved = null;
    setLancamentos((current) =>
      current.map((item) => {
        if (item.id !== lancamentoId) return item;
        saved = { ...item, status: 'Cancelado', displayStatus: 'Cancelado', overdue: false, paymentDate: '' };
        return saved;
      }),
    );
    addFlash('Lançamento cancelado.', 'info');
    return saved;
  }

  const currentUser = users.find((user) => user.id === currentUserId) || currentSessionUser;
  const currentRole = roles.find((role) => role.id === currentUser?.roleId) || null;

  const currentPermissionPaths = (() => {
    if (!currentRole || !permissionGroups.length) {
      return null;
    }
    const idToPath = new Map();
    permissionGroups.forEach((group) => {
      (group.permissions || []).forEach((permission) => {
        idToPath.set(String(permission.id), permission.path);
      });
    });
    const paths = new Set();
    (currentRole.permissionIds || []).forEach((id) => {
      const path = idToPath.get(String(id));
      if (path) paths.add(path);
    });
    return paths;
  })();

  function hasPermission(path) {
    if (isDemoMode) {
      return true;
    }
    if (currentPermissionPaths === null) {
      return false;
    }
    return currentPermissionPaths.has(path);
  }

  const value = {
    permissionGroups,
    roles,
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
    currentUser,
    currentRole,
    hasPermission,
    isApiEnabled,
    isLoading,
    isEventsLoading,
    isDeadlinesLoading,
    isPetitionsLoading,
    apiStatus,
    isDemoMode,
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
