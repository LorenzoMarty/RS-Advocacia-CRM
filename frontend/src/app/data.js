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
