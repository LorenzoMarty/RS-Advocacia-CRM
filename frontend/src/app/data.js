const ROLE_PERMISSION_GROUPS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { id: 'dashboard.view', displayName: 'Ver dashboard', modelLabel: 'Painel' },
    ],
  },
  {
    key: 'clientes',
    label: 'Clientes',
    permissions: [
      { id: 'clientes.view', displayName: 'Visualizar clientes', modelLabel: 'Cliente' },
      { id: 'clientes.create', displayName: 'Criar clientes', modelLabel: 'Cliente' },
      { id: 'clientes.edit', displayName: 'Editar clientes', modelLabel: 'Cliente' },
      { id: 'clientes.delete', displayName: 'Excluir clientes', modelLabel: 'Cliente' },
    ],
  },
  {
    key: 'processos',
    label: 'Processos',
    permissions: [
      { id: 'processos.view', displayName: 'Visualizar processos', modelLabel: 'Processo' },
      { id: 'processos.create', displayName: 'Criar processos', modelLabel: 'Processo' },
      { id: 'processos.edit', displayName: 'Editar processos', modelLabel: 'Processo' },
      { id: 'processos.delete', displayName: 'Excluir processos', modelLabel: 'Processo' },
    ],
  },
  {
    key: 'agenda',
    label: 'Agenda',
    permissions: [
      { id: 'agenda.view', displayName: 'Visualizar agenda', modelLabel: 'Compromisso' },
      { id: 'agenda.create', displayName: 'Criar compromissos', modelLabel: 'Compromisso' },
      { id: 'agenda.edit', displayName: 'Editar compromissos', modelLabel: 'Compromisso' },
      { id: 'agenda.delete', displayName: 'Excluir compromissos', modelLabel: 'Compromisso' },
    ],
  },
  {
    key: 'usuarios',
    label: 'Usuários',
    permissions: [
      { id: 'usuarios.view', displayName: 'Visualizar usuários', modelLabel: 'Usuário' },
      { id: 'usuarios.create', displayName: 'Criar usuários', modelLabel: 'Usuário' },
      { id: 'usuarios.edit', displayName: 'Editar usuários', modelLabel: 'Usuário' },
      { id: 'usuarios.delete', displayName: 'Excluir usuários', modelLabel: 'Usuário' },
      { id: 'cargos.view', displayName: 'Visualizar cargos', modelLabel: 'Cargo' },
      { id: 'cargos.create', displayName: 'Criar cargos', modelLabel: 'Cargo' },
      { id: 'cargos.edit', displayName: 'Editar cargos', modelLabel: 'Cargo' },
      { id: 'cargos.delete', displayName: 'Excluir cargos', modelLabel: 'Cargo' },
    ],
  },
];

const ALL_PERMISSION_IDS = ROLE_PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.id),
);

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', mobileLabel: 'Painel', to: '/' },
  { key: 'clientes', label: 'Clientes', mobileLabel: 'Clientes', to: '/clientes' },
  { key: 'processos', label: 'Processos', mobileLabel: 'Processos', to: '/processos' },
  { key: 'agenda', label: 'Agenda', mobileLabel: 'Agenda', to: '/agenda' },
  { key: 'usuarios', label: 'Usuários', mobileLabel: 'Usuários', to: '/usuarios' },
];

export const EVENT_TYPE_OPTIONS = ['Audiência', 'Reunião', 'Prazo', 'Tarefa interna'];
export const EVENT_PRIORITY_OPTIONS = ['Alta', 'Média', 'Baixa'];
export const EVENT_STATUS_OPTIONS = ['Agendado', 'Pendente', 'Concluído', 'Cancelado'];
export const CLIENT_TYPE_OPTIONS = [
  { value: 'esporadico', label: 'Esporádico' },
  { value: 'mensalista', label: 'Mensalista' },
];
export const PROCESS_STATUS_OPTIONS = ['Ativo', 'Em andamento', 'Aguardando despacho', 'Arquivado', 'Concluído'];
export const PROCESS_AREA_OPTIONS = ['Cível', 'Trabalhista', 'Empresarial', 'Tributário'];

function buildDate(baseDate, dayOffset, hour, minute) {
  const nextDate = new Date(baseDate);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  nextDate.setHours(hour, minute, 0, 0);
  return nextDate.toISOString();
}

export function createSeedState(baseDate = new Date()) {
  const payload = {
    permissionGroups: ROLE_PERMISSION_GROUPS,
    roles: [
      {
        id: 'role-admin',
        name: 'Administrador',
        permissionIds: ALL_PERMISSION_IDS,
      },
      {
        id: 'role-adv',
        name: 'Advogado sênior',
        permissionIds: ALL_PERMISSION_IDS.filter((permissionId) => permissionId !== 'cargos.delete'),
      },
      {
        id: 'role-estagio',
        name: 'Estágio',
        permissionIds: [
          'dashboard.view',
          'clientes.view',
          'processos.view',
          'agenda.view',
          'agenda.create',
        ],
      },
    ],
    users: [
      {
        id: 'user-1',
        name: 'Renata Sampaio',
        email: 'usuario@example.com',
        password: '123456',
        roleId: 'role-admin',
      },
      {
        id: 'user-2',
        name: 'Gabriel Costa',
        email: 'gabriel@rsadvocacia.com',
        password: '123456',
        roleId: 'role-adv',
      },
      {
        id: 'user-3',
        name: 'Laura Nunes',
        email: 'laura@rsadvocacia.com',
        password: '123456',
        roleId: 'role-estagio',
      },
    ],
    clients: [
      {
        id: 'client-1',
        name: 'Beatriz Martins',
        email: 'beatriz@empresa.com',
        phone: '(11) 99876-2201',
        document: '12345678901',
        clientType: 'mensalista',
        notes: 'Cliente corporativa com alta demanda contratual.',
      },
      {
        id: 'client-2',
        name: 'Carlos Almeida',
        email: 'carlos@almeida.com',
        phone: '(21) 98888-3310',
        document: '98765432100',
        clientType: 'esporadico',
        notes: 'Atendimento pontual para contencioso cível.',
      },
      {
        id: 'client-3',
        name: 'Grupo Aurora',
        email: 'juridico@aurora.com',
        phone: '(31) 97777-4521',
        document: '12345678000190',
        clientType: 'mensalista',
        notes: 'Conta recorrente da área trabalhista.',
      },
    ],
    processes: [
      {
        id: 'process-1',
        number: '0001234-55.2026.8.26.0100',
        clientId: 'client-1',
        description: 'Ação revisional de contratos com pedido liminar.',
        court: '3a Vara Cível',
        area: 'Cível',
        status: 'Em andamento',
        owner: 'Renata Sampaio',
      },
      {
        id: 'process-2',
        number: '0004321-12.2025.5.02.0008',
        clientId: 'client-3',
        description: 'Reclamação trabalhista em fase de audiência.',
        court: '8a Vara do Trabalho',
        area: 'Trabalhista',
        status: 'Aguardando despacho',
        owner: 'Gabriel Costa',
      },
      {
        id: 'process-3',
        number: '1009988-10.2024.8.19.0001',
        clientId: 'client-2',
        description: 'Execução de título extrajudicial.',
        court: '1a Vara Empresarial',
        area: 'Empresarial',
        status: 'Ativo',
        owner: 'Renata Sampaio',
      },
    ],
    events: [
      {
        id: 'event-1',
        title: 'Audiência de conciliação',
        description: 'Revisar estratégia final e documentos de sustentação.',
        start: buildDate(baseDate, 0, 10, 0),
        end: buildDate(baseDate, 0, 11, 0),
        type: 'Audiência',
        status: 'Agendado',
        priority: 'Alta',
        clientId: 'client-1',
        processId: 'process-1',
        responsible: 'Renata Sampaio',
        createdBy: 'Renata Sampaio',
        location: 'Fórum Central',
        notes: 'Levar proposta de acordo atualizada.',
        reminderAt: buildDate(baseDate, -1, 17, 30),
        completed: false,
      },
      {
        id: 'event-2',
        title: 'Reunião com cliente',
        description: 'Alinhar cronograma do contencioso e aprovar próxima petição.',
        start: buildDate(baseDate, 0, 15, 30),
        end: buildDate(baseDate, 0, 16, 30),
        type: 'Reunião',
        status: 'Pendente',
        priority: 'Média',
        clientId: 'client-3',
        processId: 'process-2',
        responsible: 'Gabriel Costa',
        createdBy: 'Gabriel Costa',
        location: 'Sala 02',
        notes: 'Apresentar resumo da fase atual.',
        reminderAt: buildDate(baseDate, 0, 9, 0),
        completed: false,
      },
      {
        id: 'event-3',
        title: 'Prazo para contestação',
        description: 'Protocolar contestação com anexos finais.',
        start: buildDate(baseDate, 3, 9, 0),
        end: buildDate(baseDate, 3, 10, 0),
        type: 'Prazo',
        status: 'Agendado',
        priority: 'Alta',
        clientId: 'client-2',
        processId: 'process-3',
        responsible: 'Renata Sampaio',
        createdBy: 'Renata Sampaio',
        location: 'PJe',
        notes: 'Confirmar juntada do comprovante.',
        reminderAt: buildDate(baseDate, 2, 16, 0),
        completed: false,
      },
      {
        id: 'event-4',
        title: 'Checklist interno',
        description: 'Conferência final dos documentos de onboarding.',
        start: buildDate(baseDate, -2, 14, 0),
        end: buildDate(baseDate, -2, 15, 0),
        type: 'Tarefa interna',
        status: 'Em atraso',
        priority: 'Baixa',
        clientId: 'client-1',
        processId: 'process-1',
        responsible: 'Laura Nunes',
        createdBy: 'Laura Nunes',
        location: 'Backoffice',
        notes: 'Pendência de comprovante de endereço.',
        reminderAt: buildDate(baseDate, -3, 13, 0),
        completed: false,
      },
      {
        id: 'event-5',
        title: 'Despacho com advogado correspondente',
        description: 'Fechar alinhamento antes da audiência trabalhista.',
        start: buildDate(baseDate, 7, 11, 30),
        end: buildDate(baseDate, 7, 12, 0),
        type: 'Reunião',
        status: 'Agendado',
        priority: 'Média',
        clientId: 'client-3',
        processId: 'process-2',
        responsible: 'Gabriel Costa',
        createdBy: 'Gabriel Costa',
        location: 'Videochamada',
        notes: 'Enviar ata logo após a reunião.',
        reminderAt: buildDate(baseDate, 6, 18, 0),
        completed: false,
      },
    ],
  };

  return typeof structuredClone === 'function'
    ? structuredClone(payload)
    : JSON.parse(JSON.stringify(payload));
}

export const LOGIN_HINT = {
  email: 'usuario@example.com',
  password: '123456',
};
