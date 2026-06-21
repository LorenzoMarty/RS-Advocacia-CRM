export const NAV_ITEMS = [
  { key: 'painel', label: 'Painel', mobileLabel: 'Painel', to: '/' },
  { key: 'clientes', label: 'Clientes', mobileLabel: 'Clientes', to: '/clientes' },
  { key: 'processos', label: 'Processos', mobileLabel: 'Processos', to: '/processos' },
  { key: 'agenda', label: 'Agenda', mobileLabel: 'Agenda', to: '/agenda' },
  { key: 'prazos', label: 'Prazos', mobileLabel: 'Prazos', to: '/prazos' },
  { key: 'peticoes', label: 'Petições ou contestações', mobileLabel: 'Petições', to: '/peticoes-contestacoes' },
  { key: 'reunioes', label: 'Reuniões', mobileLabel: 'Reuniões', to: '/reunioes' },
  { key: 'produtividade', label: 'Produtividade', mobileLabel: 'Horas', to: '/produtividade' },
  { key: 'prospeccao', label: 'Prospecção', mobileLabel: 'Prospect', to: '/prospeccao' },
  { key: 'financeiro', label: 'Financeiro', mobileLabel: 'Financeiro', to: '/financeiro', permission: 'financeiro.view_lancamento' },
  { key: 'auditoria', label: 'Auditoria', mobileLabel: 'Audit', to: '/auditoria' },
  { key: 'usuarios', label: 'Usuários', mobileLabel: 'Usuários', to: '/usuarios', permission: 'usuarios.view_usuario' },
];

export const PROSPECT_STATUS_COLUMNS = [
  { key: 'novo', label: 'Novo' },
  { key: 'em_contato', label: 'Em contato' },
  { key: 'reuniao_agendada', label: 'Reunião agendada' },
  { key: 'proposta_enviada', label: 'Proposta enviada' },
  { key: 'aguardando_retorno', label: 'Aguardando retorno' },
  { key: 'convertido', label: 'Convertido' },
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
export const FINANCE_STATUS_OPTIONS = ['Pendente', 'Pago', 'Cancelado'];
export const FINANCE_TABS = [
  { key: 'receber', label: 'A Receber' },
  { key: 'pagas', label: 'Pagas' },
  { key: 'despesas', label: 'Despesas' },
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
];
export const CLIENT_TYPE_OPTIONS = [
  { value: 'esporadico', label: 'Esporádico' },
  { value: 'mensalista', label: 'Mensalista' },
];
export const PROCESS_STATUS_OPTIONS = ['Ativo', 'Em andamento', 'Aguardando despacho', 'Arquivado', 'Concluído'];
export const PROCESS_AREA_OPTIONS = ['Cível', 'Trabalhista', 'Empresarial', 'Tributário'];
