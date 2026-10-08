export const NAV_ITEMS = [
  { key: 'painel', group: 'Principal', label: 'Painel', mobileLabel: 'Painel', to: '/' },
  { key: 'clientes', group: 'Principal', label: 'Clientes', mobileLabel: 'Clientes', to: '/clientes' },
  { key: 'processos', group: 'Principal', label: 'Processos', mobileLabel: 'Processos', to: '/processos' },
  { key: 'agenda', group: 'Principal', label: 'Agenda', mobileLabel: 'Agenda', to: '/agenda' },
  { key: 'prazos', group: 'Principal', label: 'Prazos', mobileLabel: 'Prazos', to: '/prazos' },
  { key: 'peticoes', group: 'Principal', label: 'Petições ou contestações', mobileLabel: 'Petições', to: '/peticoes-contestacoes' },
  { key: 'reunioes', group: 'Escritório', label: 'Reuniões', mobileLabel: 'Reuniões', to: '/reunioes' },
  { key: 'produtividade', group: 'Escritório', label: 'Produtividade', mobileLabel: 'Horas', to: '/produtividade' },
  { key: 'prospeccao', group: 'Escritório', label: 'Prospecção', mobileLabel: 'Prospect', to: '/prospeccao' },
  { key: 'financeiro', group: 'Escritório', label: 'Financeiro', mobileLabel: 'Financeiro', to: '/financeiro', permission: 'financeiro.view_lancamento' },
  { key: 'auditoria', group: 'Administração', label: 'Auditoria', mobileLabel: 'Audit', to: '/auditoria' },
  { key: 'usuarios', group: 'Administração', label: 'Usuários', mobileLabel: 'Usuários', to: '/usuarios', permission: 'usuarios.view_usuario' },
  { key: 'configuracoes', group: 'Administração', label: 'Configurações', mobileLabel: 'Config', to: '/configuracoes', permission: 'ai.view_configuracaoia' },
];

export const PROSPECT_STATUS_COLUMNS = [
  { key: 'em_contato', label: 'Em contato' },
  { key: 'proposta_enviada', label: 'Proposta enviada' },
  { key: 'aguardando_retorno', label: 'Aguardando retorno' },
  { key: 'perdido', label: 'Perdido' },
];
export const PROSPECT_PRIORITY_OPTIONS = ['Alta', 'Media', 'Baixa'];
export const PROSPECT_ORIGIN_OPTIONS = ['Indicação', 'Site', 'Redes sociais', 'Telefone', 'WhatsApp', 'Outros'];
export const INTERACTION_TYPE_OPTIONS = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'anotacao', label: 'Anotação' },
];

export const FINANCE_TYPE_OPTIONS = [
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
];
export const FINANCE_CATEGORIES = {
  receita: ['Honorários', 'Consulta', 'Êxito', 'Mensalidade', 'Acordo'],
  despesa: ['Custas processuais', 'Escritório', 'Software', 'Marketing', 'Impostos', 'Outros'],
};
export const FINANCE_TABS = [
  { key: 'receber', label: 'A Receber' },
  { key: 'pagas', label: 'Pagas' },
  { key: 'despesas', label: 'Despesas' },
  { key: 'cancelados', label: 'Cancelados' },
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
  'Agendado',
  'Confirmado',
  'Aguardando',
  'Em andamento',
  'Concluído',
  'Adiado',
  'Cancelado',
  'Atrasado',
  'Compareceu',
  'Não compareceu',
];
export const PROCESS_STATUS_OPTIONS = ['Ativo', 'Em andamento', 'Aguardando despacho', 'Arquivado', 'Concluído'];
export const PROCESS_AREA_OPTIONS = ['Cível', 'Trabalhista', 'Empresarial', 'Tributário'];
