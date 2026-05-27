export const NAV_ITEMS = [
  { key: 'painel', label: 'Painel', mobileLabel: 'Painel', to: '/' },
  { key: 'clientes', label: 'Clientes', mobileLabel: 'Clientes', to: '/clientes' },
  { key: 'processos', label: 'Processos', mobileLabel: 'Processos', to: '/processos' },
  { key: 'agenda', label: 'Agenda', mobileLabel: 'Agenda', to: '/agenda' },
  { key: 'prazos', label: 'Prazos', mobileLabel: 'Prazos', to: '/prazos' },
  { key: 'peticoes', label: 'Petições ou contestações', mobileLabel: 'Petições', to: '/peticoes-contestacoes' },
  { key: 'reunioes', label: 'Reuniões', mobileLabel: 'Reuniões', to: '/reunioes' },
  { key: 'produtividade', label: 'Produtividade', mobileLabel: 'Horas', to: '/produtividade' },
  { key: 'auditoria', label: 'Auditoria', mobileLabel: 'Audit', to: '/auditoria' },
  { key: 'usuarios', label: 'Usuários', mobileLabel: 'Usuários', to: '/usuarios' },
];

export const EVENT_TYPE_OPTIONS = ['Audiência', 'Reunião'];
export const EVENT_PRIORITY_OPTIONS = ['Alta', 'Média', 'Baixa'];
export const DEADLINE_STATUS_COLUMNS = [
  { key: 'a_fazer', label: 'Pendente' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'protocolar', label: 'Protocolar' },
  { key: 'protocolado', label: 'Protocolado' },
];
export const PETITION_STATUS_COLUMNS = [
  { key: 'pendente', label: 'Pendente' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'protocolar', label: 'Protocolar' },
  { key: 'protocolado', label: 'Protocolado' },
];
export const EVENT_STATUS_OPTIONS = [
  'Pendente',
  'Confirmado',
];
export const CLIENT_TYPE_OPTIONS = [
  { value: 'esporadico', label: 'Esporádico' },
  { value: 'mensalista', label: 'Mensalista' },
];
export const PROCESS_STATUS_OPTIONS = ['Ativo', 'Em andamento', 'Aguardando despacho', 'Arquivado', 'Concluído'];
export const PROCESS_AREA_OPTIONS = ['Cível', 'Trabalhista', 'Empresarial', 'Tributário'];
