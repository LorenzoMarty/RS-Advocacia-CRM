// Translation layer between the Portuguese API payloads and the English UI fields.
// *FromApi normalize incoming records, *ToPayload build request bodies,
// *FromResponse unwrap collection/item envelopes. Pure functions, no React.
export function collectionFromResponse(payload, key) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload?.[key] || [];
}

export function itemFromResponse(payload, key) {
  if (payload?.id) {
    return payload;
  }

  return payload?.[key] || null;
}

export function usersFromResponse(payload) {
  return collectionFromResponse(payload, 'usuarios').map(userFromApi).filter(Boolean);
}

export function userFromResponse(payload) {
  return userFromApi(itemFromResponse(payload, 'usuario'));
}

export function rolesFromResponse(payload) {
  return collectionFromResponse(payload, 'cargos')
    .map(roleFromApi)
    .filter((role) => role && role.id && role.name);
}

export function roleFromResponse(payload) {
  return roleFromApi(itemFromResponse(payload, 'cargo'));
}

export function clientsFromResponse(payload) {
  return collectionFromResponse(payload, 'clientes').map(clientFromApi).filter(Boolean);
}

export function clientFromResponse(payload) {
  return clientFromApi(itemFromResponse(payload, 'cliente'));
}

export function processesFromResponse(payload) {
  return collectionFromResponse(payload, 'processos').map(processFromApi).filter(Boolean);
}

export function processFromResponse(payload) {
  return processFromApi(itemFromResponse(payload, 'processo'));
}

export function eventsFromResponse(payload) {
  return collectionFromResponse(payload, 'eventos').map(eventFromApi).filter(Boolean);
}

export function eventFromResponse(payload) {
  return eventFromApi(itemFromResponse(payload, 'evento'));
}

export function deadlinesFromResponse(payload) {
  return collectionFromResponse(payload, 'prazos').map(deadlineFromApi).filter(Boolean);
}

export function deadlineFromResponse(payload) {
  return deadlineFromApi(itemFromResponse(payload, 'prazo'));
}

export function petitionsFromResponse(payload) {
  return collectionFromResponse(payload, 'peticoes').map(petitionFromApi).filter(Boolean);
}

export function petitionFromResponse(payload) {
  return petitionFromApi(itemFromResponse(payload, 'peticao'));
}

export function prospectsFromResponse(payload) {
  return collectionFromResponse(payload, 'prospects').map(prospectFromApi).filter(Boolean);
}

export function prospectFromResponse(payload) {
  return prospectFromApi(itemFromResponse(payload, 'prospect'));
}

export function interactionFromResponse(payload) {
  return interactionFromApi(itemFromResponse(payload, 'interacao'));
}

export function lancamentosFromResponse(payload) {
  return collectionFromResponse(payload, 'lancamentos').map(lancamentoFromApi).filter(Boolean);
}

export function lancamentoFromResponse(payload) {
  return lancamentoFromApi(itemFromResponse(payload, 'lancamento'));
}

export function timeEntriesFromResponse(payload) {
  return collectionFromResponse(payload, 'time_entries').map(timeEntryFromApi).filter(Boolean);
}

export function timeEntryFromResponse(payload) {
  return timeEntryFromApi(itemFromResponse(payload, 'time_entry'));
}

export function productivityGoalsFromResponse(payload) {
  return collectionFromResponse(payload, 'productivity_goals').map(productivityGoalFromApi).filter(Boolean);
}

export function permissionGroupsFromResponse(payload) {
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

export function roleFromApi(role) {
  if (!role) {
    return null;
  }

  const usersCount = role.usuarios_total == null ? undefined : Number(role.usuarios_total);

  return {
    ...role,
    id: String(role.id || role.pk || role.nome),
    name: role.nome || '',
    permissionIds: (role.permissoes || [])
      .map(String),
    usersCount: Number.isFinite(usersCount) ? usersCount : undefined,
  };
}

export function userFromApi(user) {
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

export function clientFromApi(client) {
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
    partner: client.parceria || '',
    notes: client.obs || '',
  };
}

export function processFromApi(process) {
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

export function eventFromApi(event) {
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

export function deadlineFromApi(deadline) {
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

export function clientToPayload(client) {
  return {
    nome: client.name,
    cpf: client.document,
    tipo_cliente: client.clientType,
    parceria: client.partner || '',
    telefone: client.phone,
    email: client.email,
    obs: client.notes,
  };
}

export function processToPayload(process) {
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

export function eventToPayload(event) {
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

export function petitionFromApi(petition) {
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

export function prospectFromApi(prospect) {
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

export function interactionFromApi(interaction) {
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

export function prospectToPayload(prospect) {
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

export function interactionToPayload(interaction) {
  return {
    tipo: interaction.type,
    descricao: interaction.description,
    ...(interaction.date ? { data: interaction.date } : {}),
    ...(interaction.userId ? { usuario: interaction.userId } : {}),
  };
}

export function lancamentoFromApi(lancamento) {
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

export function lancamentoToPayload(lancamento) {
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

export function deadlineToPayload(deadline) {
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

export function petitionToPayload(petition) {
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

export function deadlineTimerToPayload(timer) {
  return {
    tempo_decorrido_segundos: Math.max(0, Math.floor(Number(timer.elapsedSeconds) || 0)),
    timer_iniciado_em: timer.timerStartedAt || null,
  };
}

export function userToPayload(user) {
  return {
    nome: user.name,
    email: user.email,
    cargo_id: user.roleId,
  };
}

export function roleToPayload(role) {
  return {
    nome: role.name,
    permissoes: role.permissionIds,
  };
}

export function timeEntryFromApi(entry) {
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

export function productivityGoalFromApi(goal) {
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
