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

// Lista enxuta (id + nome) usada para popular selects de responsável quando o
// usuário não tem permissão de ver a lista completa de usuários.
export function assignableUsersFromResponse(payload) {
  return collectionFromResponse(payload, 'usuarios_atribuiveis')
    .map((user) => ({
      id: String(user.id || user.pk || ''),
      name: user.nome || user.name || '',
    }))
    .filter((user) => user.id && user.name);
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

export function auditEntryFromApi(entry) {
  if (!entry) {
    return null;
  }

  return {
    ...entry,
    id: String(entry.id || entry.pk),
    action: entry.acao || '',
    entityType: entry.entidade_tipo || '',
    entityId: String(entry.entidade_id || ''),
    entityLabel: entry.entidade_rotulo || '',
    processId: String(entry.processo_id || ''),
    processLabel: entry.processo_numero || '',
    author: entry.autor_nome || '',
    summary: entry.resumo || '',
    changes: entry.alteracoes && typeof entry.alteracoes === 'object' ? entry.alteracoes : {},
    createdAt: entry.criado_em || null,
  };
}

export function auditFromResponse(payload) {
  return collectionFromResponse(payload, 'auditoria').map(auditEntryFromApi).filter(Boolean);
}

export function auditFromListResponse(payload) {
  return collectionFromResponse(payload, 'registros').map(auditEntryFromApi).filter(Boolean);
}

// Formato comum de paginação offset/limit usado por auditoria, clientes,
// processos e usuários — todos devolvem `dados.paginacao` no mesmo shape
// ({offset, limit, total, tem_mais}).
export function paginationFromResponse(payload) {
  const dados = payload?.dados || payload;
  const pag = dados?.paginacao;
  if (!pag) {
    return { offset: 0, limit: 100, total: 0, temMais: false };
  }
  return {
    offset: pag.offset ?? 0,
    limit: pag.limit ?? 100,
    total: pag.total ?? 0,
    temMais: Boolean(pag.tem_mais),
  };
}

export function auditPaginationFromResponse(payload) {
  return paginationFromResponse(payload);
}

// Painel de risco computado no backend (GET /api/auditoria/painel/). Apenas
// converte snake_case → as chaves camelCase que os componentes já consomem.
export function auditPanelFromResponse(payload) {
  const panel = payload?.dados || payload;
  if (!panel) {
    return null;
  }

  const summary = panel.summary || {};
  return {
    periodo: panel.periodo ?? 7,
    risk: panel.risk || { score: 0, level: 'healthy', label: '', drivers: [] },
    summary: {
      activeProcesses: summary.active_processes || 0,
      overdue: summary.overdue || 0,
      dueSoon: summary.due_soon || 0,
      stale: summary.stale || 0,
      clientsWithoutProcess: summary.clients_without_process || 0,
      runningTimers: summary.running_timers || 0,
    },
    priorityActions: (panel.priority_actions || []).map((action) => ({
      ...action,
      // 'YYYY-MM-DD' → meia-dia local, evitando drift de fuso ao formatar.
      date: action.date ? `${action.date}T12:00:00` : null,
    })),
    statusDistribution: panel.status_distribution || [],
  };
}

export function auditOverviewFromResponse(payload) {
  const dados = payload?.dados || payload;
  if (!dados) {
    return null;
  }

  const prazos = dados.prazos || {};
  const eventos = dados.eventos || {};
  const prod = dados.produtividade || {};

  return {
    // Risk panel (from build_panel — same keys as auditPanelFromResponse)
    periodo: dados.periodo ?? 7,
    risk: dados.risk || { score: 0, level: 'healthy', label: '', drivers: [] },
    summary: {
      activeProcesses: (dados.summary || {}).active_processes || 0,
      overdue: (dados.summary || {}).overdue || 0,
      dueSoon: (dados.summary || {}).due_soon || 0,
      stale: (dados.summary || {}).stale || 0,
      clientsWithoutProcess: (dados.summary || {}).clients_without_process || 0,
      runningTimers: (dados.summary || {}).running_timers || 0,
    },
    priorityActions: (dados.priority_actions || []).map((action) => ({
      ...action,
      date: action.date ? `${action.date}T12:00:00` : null,
    })),
    statusDistribution: dados.status_distribution || [],

    // Macro overview sections
    processStatus: dados.processos_por_status || [],
    staleProcesses: {
      count: (dados.processos_parados || {}).count || 0,
      itens: (dados.processos_parados || {}).itens || [],
    },
    prazos: {
      overdue: prazos.overdue || 0,
      today: prazos.today || 0,
      dueSoon: prazos.due_soon || 0,
      done: prazos.done || 0,
    },
    eventos: {
      proximos: (eventos.proximos || []).map((e) => ({
        ...e,
        dataInicio: e.data_inicio || null,
        dataFim: e.data_fim || null,
        responsavelNome: e.responsavel_nome || '',
        processoNumero: e.processo_numero || '',
        clienteNome: e.cliente_nome || '',
        tipoEvento: e.tipo_evento || '',
      })),
      atrasados: (eventos.atrasados || []).map((e) => ({
        ...e,
        dataInicio: e.data_inicio || null,
        dataFim: e.data_fim || null,
        responsavelNome: e.responsavel_nome || '',
        processoNumero: e.processo_numero || '',
        clienteNome: e.cliente_nome || '',
        tipoEvento: e.tipo_evento || '',
      })),
      totalPendentes: eventos.total_pendentes || 0,
    },
    petitionFunnel: (dados.peticoes_por_status || []).map((item) => ({
      status: item.status || '',
      count: item.count || 0,
    })),
    productivity: {
      semanaInicio: prod.semana_inicio || null,
      porUsuario: (prod.por_usuario || []).map((u) => ({
        userId: u.user_id || '',
        userName: u.user_name || '',
        horas: u.horas || 0,
        metaHoras: u.meta_horas || 30,
        pct: u.pct || 0,
      })),
      timersAtivos: prod.timers_ativos || 0,
    },
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
    roleId: String(user.cargo || user.cargo_id || ''),
    roleName: user.cargo || '',
    isAdmin: Boolean(user.admin || user.cargo === 'Administrador'),
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
    owner: process.advogado_responsavel ? String(process.advogado_responsavel) : '',
    ownerName: process.advogado_responsavel_nome || '',
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
    responsible: event.responsavel ? String(event.responsavel) : '',
    responsibleName: event.responsavel_nome || '',
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
    responsible: deadline.responsavel ? String(deadline.responsavel) : '',
    responsibleName: deadline.responsavel_nome || '',
    createdBy: deadline.criado_por || '',
    notes: deadline.observacoes || '',
    completed: Boolean(deadline.concluido),
    elapsedSeconds: Number(deadline.tempo_decorrido_segundos || 0),
    timerStartedAt: deadline.timer_iniciado_em || '',
    driveLink: deadline.link_drive || '',
    driveFileId: deadline.drive_file_id || '',
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
    advogado_responsavel: process.owner || null,
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
    responsavel: event.responsible || null,
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
    driveFileId: petition.drive_file_id || '',
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
    responsavel: deadline.responsible || null,
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

export function timeEntryFromApi(entry) {
  if (!entry) {
    return null;
  }

  return {
    ...entry,
    id: String(entry.id || entry.pk),
    userId: String(entry.user_id || ''),
    userName: entry.user_name || '',
    taskId: String(entry.task_id || ''),
    taskType: entry.task_type || '',
    taskName: entry.task_name || '',
    processId: String(entry.process_id || ''),
    processNumber: entry.process_number || '',
    startedAt: entry.started_at || '',
    pausedAt: entry.paused_at || '',
    resumedAt: entry.resumed_at || '',
    endedAt: entry.ended_at || '',
    totalSeconds: Number(entry.total_seconds ?? 0),
    elapsedSeconds: Number(entry.elapsed_seconds ?? entry.total_seconds ?? 0),
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
    userId: String(goal.user_id || ''),
    dailyHours: Number(goal.daily_hours ?? 6),
    weeklyHours: Number(goal.weekly_hours ?? 30),
    configured: Boolean(goal.configured),
  };
}
