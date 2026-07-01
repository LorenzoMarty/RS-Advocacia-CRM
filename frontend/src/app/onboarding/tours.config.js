// Passos do tour guiado (driver.js) por perfil de usuário.
// `currentRole.name` no store é um dos três cargos cadastráveis: Advogado, Estagiário, Administrador.
export const ROLE_TOUR_KEY = {
  Advogado: 'advogado',
  'Estagiário': 'estagiario',
  Administrador: 'administrador',
};

export const TOURS = {
  advogado: [
    {
      element: '[data-tour="nav-clientes"]',
      popover: {
        title: 'Clientes',
        description: 'Cadastre e acompanhe todos os clientes do escritório aqui.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-processos"]',
      popover: {
        title: 'Processos',
        description: 'Vincule processos aos clientes e acompanhe o andamento de cada caso.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-prazos"]',
      popover: {
        title: 'Prazos',
        description: 'Nunca perca um prazo: cadastre e acompanhe os prazos de cada processo.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-peticoes"]',
      popover: {
        title: 'Petições ou contestações',
        description: 'Organize as petições e contestações de cada processo aqui.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="shortcut-novo-cliente"]',
      popover: {
        title: 'Cadastre seu primeiro cliente',
        description: 'Clique aqui para começar a usar o sistema agora.',
        side: 'bottom',
      },
    },
  ],
  estagiario: [
    {
      element: '[data-tour="nav-agenda"]',
      popover: {
        title: 'Agenda',
        description: 'Veja e organize os compromissos do escritório.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-prazos"]',
      popover: {
        title: 'Prazos',
        description: 'Acompanhe os prazos pendentes e ajude a equipe a não perder nenhum.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-prospeccao"]',
      popover: {
        title: 'Prospecção',
        description: 'Registre o atendimento e o andamento de cada contato em prospecção.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="shortcut-novo-compromisso"]',
      popover: {
        title: 'Novo compromisso',
        description: 'Clique aqui para agendar um compromisso na agenda.',
        side: 'bottom',
      },
    },
  ],
  administrador: [
    {
      element: '[data-tour="nav-usuarios"]',
      popover: {
        title: 'Usuários',
        description: 'Gerencie os usuários e os acessos do escritório aqui.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-financeiro"]',
      popover: {
        title: 'Financeiro',
        description: 'Acompanhe e registre as cobranças e lançamentos financeiros.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-auditoria"]',
      popover: {
        title: 'Auditoria',
        description: 'Veja o histórico de ações realizadas no sistema.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="nav-produtividade"]',
      popover: {
        title: 'Produtividade',
        description: 'Acompanhe relatórios de horas e produtividade da equipe.',
        side: 'right',
      },
    },
  ],
};
