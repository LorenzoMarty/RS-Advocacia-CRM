import { describe, expect, it } from 'vitest';

import {
  clientFromApi,
  clientToPayload,
  collectionFromResponse,
  deadlineFromApi,
  deadlineTimerToPayload,
  deadlineToPayload,
  eventFromApi,
  eventToPayload,
  interactionFromApi,
  interactionToPayload,
  itemFromResponse,
  lancamentoFromApi,
  lancamentoToPayload,
  permissionGroupsFromResponse,
  petitionFromApi,
  petitionToPayload,
  processFromApi,
  processToPayload,
  productivityGoalFromApi,
  prospectFromApi,
  prospectToPayload,
  roleFromApi,
  timeEntryFromApi,
  userFromApi,
  userToPayload,
} from './mappers';

describe('envelope helpers', () => {
  it('collectionFromResponse passes arrays through', () => {
    expect(collectionFromResponse([1, 2], 'clientes')).toEqual([1, 2]);
  });

  it('collectionFromResponse unwraps the keyed collection', () => {
    expect(collectionFromResponse({ clientes: [{ id: 1 }] }, 'clientes')).toEqual([{ id: 1 }]);
  });

  it('collectionFromResponse falls back to empty array', () => {
    expect(collectionFromResponse(null, 'clientes')).toEqual([]);
    expect(collectionFromResponse({}, 'clientes')).toEqual([]);
  });

  it('itemFromResponse prefers a payload that already has an id', () => {
    expect(itemFromResponse({ id: 7 }, 'cliente')).toEqual({ id: 7 });
  });

  it('itemFromResponse unwraps the keyed item or returns null', () => {
    expect(itemFromResponse({ cliente: { id: 7 } }, 'cliente')).toEqual({ id: 7 });
    expect(itemFromResponse({}, 'cliente')).toBeNull();
  });
});

describe('clientFromApi / clientToPayload', () => {
  it('maps Portuguese API fields to English UI fields', () => {
    const client = clientFromApi({
      id: 3,
      nome: 'Maria Silva',
      email: 'maria@exemplo.com',
      telefone: '11 99999-0000',
      cpf: '123.456.789-00',
      tipo_cliente: 'mensalista',
      obs: 'VIP',
    });

    expect(client).toMatchObject({
      id: '3',
      name: 'Maria Silva',
      email: 'maria@exemplo.com',
      phone: '11 99999-0000',
      document: '123.456.789-00',
      clientType: 'mensalista',
      notes: 'VIP',
    });
  });

  it('coerces id to string and falls back to pk', () => {
    expect(clientFromApi({ pk: 9, nome: 'X' }).id).toBe('9');
  });

  it('defaults clientType to esporadico and returns null for null input', () => {
    expect(clientFromApi({ id: 1, nome: 'X' }).clientType).toBe('esporadico');
    expect(clientFromApi(null)).toBeNull();
  });

  it('round-trips UI fields back to API names', () => {
    const payload = clientToPayload({
      name: 'Maria',
      document: '123',
      clientType: 'mensalista',
      partner: 'Escritório X',
      phone: '11 9',
      email: 'm@x.com',
      notes: 'obs',
    });

    expect(payload).toEqual({
      nome: 'Maria',
      cpf: '123',
      tipo_cliente: 'mensalista',
      parceria: 'Escritório X',
      telefone: '11 9',
      email: 'm@x.com',
      obs: 'obs',
    });
  });
});

describe('processFromApi / processToPayload', () => {
  it('maps process fields and coerces relations to string ids', () => {
    const process = processFromApi({
      id: 10,
      numero_processo: '0001234-56.2026.8.26.0100',
      cliente_id: 3,
      cliente_nome: 'Maria',
      descricao: 'Ação',
      vara: '2ª Vara Cível',
      area_juridica: 'Cível',
      status: 'Ativo',
      advogado_responsavel: 'Dr. João',
      data_ultima_movimentacao: '2026-06-01',
    });

    expect(process).toMatchObject({
      id: '10',
      number: '0001234-56.2026.8.26.0100',
      clientId: '3',
      clientName: 'Maria',
      court: '2ª Vara Cível',
      area: 'Cível',
      owner: 'Dr. João',
      lastMovementAt: '2026-06-01',
    });
  });

  it('defaults lastMovementAt to null and returns null for null input', () => {
    expect(processFromApi({ id: 1 }).lastMovementAt).toBeNull();
    expect(processFromApi(null)).toBeNull();
  });

  it('builds the API payload with the cliente relation', () => {
    expect(
      processToPayload({
        number: '123',
        clientId: '3',
        description: 'd',
        court: 'v',
        area: 'a',
        status: 's',
        owner: 'o',
      }),
    ).toEqual({
      numero_processo: '123',
      cliente: '3',
      descricao: 'd',
      vara: 'v',
      area_juridica: 'a',
      status: 's',
      advogado_responsavel: 'o',
    });
  });
});

describe('eventFromApi / eventToPayload', () => {
  it('maps event fields including completed flag', () => {
    const event = eventFromApi({
      id: 5,
      titulo: 'Audiência',
      data_inicio: '2026-06-10T09:00:00',
      data_fim: '2026-06-10T10:00:00',
      tipo_evento: 'audiencia',
      prioridade: 'alta',
      cliente_id: 3,
      processo_id: 10,
      processo_numero: '123',
      responsavel: 7,
      responsavel_nome: 'Mariana Souza',
      lembrete_em: '2026-06-10T08:00:00',
      concluido: 1,
    });

    expect(event).toMatchObject({
      id: '5',
      title: 'Audiência',
      start: '2026-06-10T09:00:00',
      end: '2026-06-10T10:00:00',
      type: 'audiencia',
      priority: 'alta',
      clientId: '3',
      processId: '10',
      processNumber: '123',
      responsible: '7',
      responsibleName: 'Mariana Souza',
      reminderAt: '2026-06-10T08:00:00',
      completed: true,
    });
  });

  it('sends responsavel id and nulls it when empty', () => {
    expect(eventToPayload({ responsible: '7' }).responsavel).toBe('7');
    expect(eventToPayload({ responsible: '' }).responsavel).toBeNull();
  });

  it('sends null reminder when empty and booleanizes concluido', () => {
    const payload = eventToPayload({ title: 't', reminderAt: '', completed: undefined });

    expect(payload.lembrete_em).toBeNull();
    expect(payload.concluido).toBe(false);
  });
});

describe('deadlineFromApi / deadlineToPayload / deadlineTimerToPayload', () => {
  it('maps deadline fields including timer state', () => {
    const deadline = deadlineFromApi({
      id: 2,
      titulo: 'Contestação',
      data_limite: '2026-06-20',
      tempo_decorrido_segundos: '90',
      timer_iniciado_em: '2026-06-10T08:00:00',
      concluido: false,
    });

    expect(deadline).toMatchObject({
      id: '2',
      title: 'Contestação',
      date: '2026-06-20',
      elapsedSeconds: 90,
      timerStartedAt: '2026-06-10T08:00:00',
      completed: false,
    });
  });

  it('builds deadline payload with processo relation', () => {
    const payload = deadlineToPayload({
      title: 't',
      description: 'd',
      date: '2026-06-20',
      processId: '10',
      responsible: 'r',
      status: 's',
      priority: 'p',
      notes: 'n',
      completed: true,
    });

    expect(payload).toEqual({
      titulo: 't',
      descricao: 'd',
      data_limite: '2026-06-20',
      processo: '10',
      responsavel: 'r',
      status: 's',
      prioridade: 'p',
      observacoes: 'n',
      concluido: true,
    });
  });

  it('floors and clamps timer seconds, nulls empty start', () => {
    expect(deadlineTimerToPayload({ elapsedSeconds: 12.9, timerStartedAt: '' })).toEqual({
      tempo_decorrido_segundos: 12,
      timer_iniciado_em: null,
    });
    expect(deadlineTimerToPayload({ elapsedSeconds: -5 }).tempo_decorrido_segundos).toBe(0);
    expect(deadlineTimerToPayload({ elapsedSeconds: 'abc' }).tempo_decorrido_segundos).toBe(0);
  });

  it('maps the Drive document reference', () => {
    const deadline = deadlineFromApi({
      id: 2,
      titulo: 'X',
      data_limite: '2026-06-20',
      link_drive: 'http://drive/doc',
      drive_file_id: 'doc-1',
    });

    expect(deadline).toMatchObject({ driveLink: 'http://drive/doc', driveFileId: 'doc-1' });
  });

  it('defaults the Drive reference to empty strings', () => {
    const deadline = deadlineFromApi({ id: 2, titulo: 'X', data_limite: '2026-06-20' });
    expect(deadline).toMatchObject({ driveLink: '', driveFileId: '' });
  });
});

describe('userFromApi / userToPayload / roleFromApi', () => {
  it('maps user fields including Google Calendar state', () => {
    const user = userFromApi({
      id: 1,
      nome: 'João',
      email: 'j@x.com',
      foto: 'http://img',
      cargo_id: 4,
      google_calendar_conectado: 1,
      google_calendar_destino: 'Agenda Escritório',
    });

    expect(user).toMatchObject({
      id: '1',
      name: 'João',
      picture: 'http://img',
      roleId: '4',
      googleCalendarConnected: true,
      googleCalendarDestination: 'Agenda Escritório',
    });
  });

  it('defaults the calendar destination label', () => {
    expect(userFromApi({ id: 1 }).googleCalendarDestination).toBe('agenda principal do Google');
  });

  it('builds the user payload with cargo_id', () => {
    expect(userToPayload({ name: 'J', email: 'j@x.com', roleId: '4' })).toEqual({
      nome: 'J',
      email: 'j@x.com',
      cargo_id: '4',
    });
  });

  it('maps role permissions to string ids and usersCount', () => {
    const role = roleFromApi({ id: 4, nome: 'Advogado', permissoes: [1, 2], usuarios_total: '3' });

    expect(role).toMatchObject({ id: '4', name: 'Advogado', permissionIds: ['1', '2'], usersCount: 3 });
  });

  it('leaves usersCount undefined when the API omits it', () => {
    expect(roleFromApi({ id: 4, nome: 'X' }).usersCount).toBeUndefined();
  });
});

describe('petitionFromApi / petitionToPayload', () => {
  it('maps petition fields with defaults', () => {
    const petition = petitionFromApi({
      id: 8,
      cliente_id: 3,
      processo_id: 10,
      adverso: 'Réu',
      responsavel_acao: 'Dra. Ana',
      link_drive: 'http://drive',
      motivo_pendente: 'Aguardando doc',
      area_juridica: 'Trabalhista',
      status: 'Pendente',
    });

    expect(petition).toMatchObject({
      id: '8',
      clientId: '3',
      processId: '10',
      type: 'Petição',
      adversary: 'Réu',
      responsible: 'Dra. Ana',
      driveLink: 'http://drive',
      pendingReason: 'Aguardando doc',
      area: 'Trabalhista',
    });
  });

  it('maps the petition Drive document id', () => {
    expect(petitionFromApi({ id: 8, drive_file_id: 'doc-9' })).toMatchObject({
      driveFileId: 'doc-9',
    });
    expect(petitionFromApi({ id: 8 }).driveFileId).toBe('');
  });

  it('builds the petition payload', () => {
    const payload = petitionToPayload({
      clientId: '3',
      processId: '',
      type: '',
      adversary: 'Réu',
      responsible: 'Ana',
      driveLink: 'l',
      pendingReason: 'm',
      area: 'a',
      status: 's',
    });

    expect(payload.cliente).toBe('3');
    expect(payload.tipo).toBe('Petição');
    expect(payload.processo).toBe('');
  });
});

describe('prospect / interaction mappers', () => {
  it('maps prospect fields with status and priority defaults', () => {
    const prospect = prospectFromApi({
      id: 11,
      nome: 'Lead',
      origem_contato: 'Indicação',
      tipo_demanda_juridica: 'Cível',
      responsavel_id: 2,
      total_interacoes: '4',
      interacoes: [{ id: 1, tipo: 'ligacao', descricao: 'contato' }],
    });

    expect(prospect).toMatchObject({
      id: '11',
      name: 'Lead',
      origin: 'Indicação',
      demandType: 'Cível',
      responsibleId: '2',
      status: 'Novo',
      priority: 'Media',
      interactionsCount: 4,
    });
    expect(prospect.interactions).toHaveLength(1);
    expect(prospect.interactions[0]).toMatchObject({ id: '1', type: 'ligacao', description: 'contato' });
  });

  it('nulls the responsible relation when empty in the payload', () => {
    expect(prospectToPayload({ name: 'L', responsibleId: '' }).responsavel_interno).toBeNull();
  });

  it('defaults interaction type and omits optional payload fields', () => {
    expect(interactionFromApi({ id: 1 }).type).toBe('anotacao');

    const payload = interactionToPayload({ type: 'ligacao', description: 'd' });
    expect(payload).toEqual({ tipo: 'ligacao', descricao: 'd' });
    expect(interactionToPayload({ type: 't', description: 'd', date: '2026-06-10', userId: '2' })).toEqual({
      tipo: 't',
      descricao: 'd',
      data: '2026-06-10',
      usuario: '2',
    });
  });
});

describe('lancamento mappers', () => {
  it('maps financial entries with numeric value and overdue flag', () => {
    const lancamento = lancamentoFromApi({
      id: 20,
      descricao: 'Honorários',
      tipo: 'receita',
      categoria: 'Honorários',
      valor: '1500.50',
      data_vencimento: '2026-07-01',
      status: 'Pendente',
      status_exibicao: 'Atrasado',
      atrasado: 1,
      cliente_id: 3,
      caso_id: 10,
    });

    expect(lancamento).toMatchObject({
      id: '20',
      description: 'Honorários',
      value: 1500.5,
      dueDate: '2026-07-01',
      displayStatus: 'Atrasado',
      overdue: true,
      clientId: '3',
      caseId: '10',
    });
  });

  it('nulls empty relations and payment date in the payload', () => {
    const payload = lancamentoToPayload({
      description: 'd',
      type: 'receita',
      category: 'c',
      value: 10,
      dueDate: '2026-07-01',
      paymentDate: '',
      status: 'Pendente',
      clientId: '',
      caseId: '',
      notes: '',
    });

    expect(payload.data_pagamento).toBeNull();
    expect(payload.cliente_relacionado).toBeNull();
    expect(payload.caso_relacionado).toBeNull();
  });
});

describe('productivity mappers', () => {
  it('maps time entries accepting snake_case and camelCase', () => {
    const fromSnake = timeEntryFromApi({
      id: 30,
      user_id: 1,
      task_id: 2,
      task_type: 'deadline',
      task_name: 'Contestação',
      total_seconds: '120',
      elapsed_seconds: 150,
      status: 'running',
    });

    expect(fromSnake).toMatchObject({
      id: '30',
      userId: '1',
      taskId: '2',
      taskType: 'deadline',
      taskName: 'Contestação',
      totalSeconds: 120,
      elapsedSeconds: 150,
      status: 'running',
    });

    expect(timeEntryFromApi({ id: 30, userId: 1, totalSeconds: 60 })).toMatchObject({
      userId: '1',
      totalSeconds: 60,
      status: 'stopped',
    });
  });

  it('keeps zero seconds instead of treating it as missing', () => {
    expect(timeEntryFromApi({ id: 1, total_seconds: 0 }).totalSeconds).toBe(0);
  });

  it('maps productivity goals with 6h/30h defaults', () => {
    expect(productivityGoalFromApi({ id: 1, user_id: 2 })).toMatchObject({
      userId: '2',
      dailyHours: 6,
      weeklyHours: 30,
      configured: false,
    });
    expect(productivityGoalFromApi({ id: 1, daily_hours: 0 }).dailyHours).toBe(0);
  });
});

describe('permissionGroupsFromResponse', () => {
  it('maps groups and translates actions to English', () => {
    const groups = permissionGroupsFromResponse({
      grupos_permissoes: [
        {
          chave: 'clientes',
          rotulo: 'Clientes',
          permissoes: [
            { id: 1, caminho: 'clientes.criar', nome: 'Criar cliente', modelo: 'Cliente', modulo: 'clientes', acao: 'criar' },
            { id: 2, caminho: 'clientes.ver', nome: 'Ver cliente', modelo: 'Cliente', modulo: 'clientes', acao: 'visualizar' },
            { id: 3, caminho: 'clientes.x', nome: 'X', modelo: 'Cliente', modulo: 'clientes', acao: 'custom' },
          ],
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: 'clientes', label: 'Clientes' });
    expect(groups[0].permissions.map((p) => p.action)).toEqual(['create', 'view', 'custom']);
    expect(groups[0].permissions[0]).toMatchObject({ id: '1', path: 'clientes.criar', app: 'clientes' });
  });
});
