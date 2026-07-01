// Passos do tour guiado (driver.js) por perfil de usuário.
// `currentRole.name` no store é um dos três cargos cadastráveis: Advogado, Estagiário, Administrador.
//
// Cada passo pode ter `route`: quando presente e diferente da rota atual, o hook
// `useOnboardingTour` navega até lá (HashRouter) e espera o elemento aparecer no DOM
// antes de destacar o passo. Passos sem `route` usam um elemento já visível na tela atual
// (ex.: os links do menu lateral, presentes em todas as páginas).
export const ROLE_TOUR_KEY = {
  Advogado: 'advogado',
  'Estagiário': 'estagiario',
  Administrador: 'administrador',
};

const SCREENS = {
  clientes: {
    nav: '[data-tour="nav-clientes"]',
    navPopover: {
      title: 'Clientes',
      description: 'Cadastre e acompanhe todos os clientes do escritório aqui.',
      side: 'right',
    },
    route: '/clientes',
    element: '[data-tour="page-primary-action"]',
    popover: {
      title: 'Cadastrar cliente',
      description: 'Clique em "Novo" para cadastrar um cliente.',
      side: 'bottom',
    },
  },
  processos: {
    nav: '[data-tour="nav-processos"]',
    navPopover: {
      title: 'Processos',
      description: 'Vincule processos aos clientes e acompanhe o andamento de cada caso.',
      side: 'right',
    },
    route: '/processos',
    element: '[data-tour="page-primary-action"]',
    popover: {
      title: 'Cadastrar processo',
      description: 'Clique em "Novo" para cadastrar um processo.',
      side: 'bottom',
    },
  },
  prazos: {
    nav: '[data-tour="nav-prazos"]',
    navPopover: {
      title: 'Prazos',
      description: 'Nunca perca um prazo: cadastre e acompanhe os prazos de cada processo.',
      side: 'right',
    },
    route: '/prazos',
    element: '[data-tour="page-primary-action"]',
    popover: {
      title: 'Criar prazo',
      description: 'Clique em "Novo prazo" para criar um prazo e, depois, anexar documentos a ele.',
      side: 'bottom',
    },
  },
  peticoes: {
    nav: '[data-tour="nav-peticoes"]',
    navPopover: {
      title: 'Petições ou contestações',
      description: 'Organize as petições e contestações de cada processo aqui.',
      side: 'right',
    },
    route: '/peticoes-contestacoes',
    element: '[data-tour="page-primary-action"]',
    popover: {
      title: 'Nova peça',
      description: 'Clique aqui para cadastrar uma petição ou contestação.',
      side: 'bottom',
    },
  },
  agenda: {
    nav: '[data-tour="nav-agenda"]',
    navPopover: {
      title: 'Agenda',
      description: 'Veja e organize os compromissos do escritório.',
      side: 'right',
    },
    route: '/agenda',
    element: '[data-tour="page-primary-action"]',
    popover: {
      title: 'Novo compromisso',
      description: 'Clique em "Novo" para agendar um compromisso.',
      side: 'bottom',
    },
  },
  reunioes: {
    nav: '[data-tour="nav-reunioes"]',
    navPopover: {
      title: 'Reuniões',
      description: 'Veja as gravações, transcrições e resumos gerados por IA das reuniões.',
      side: 'right',
    },
    route: '/reunioes',
    element: '#main-content',
    popover: {
      title: 'Reuniões',
      description: 'Aqui ficam as reuniões gravadas, com transcrição e resumo automáticos.',
      side: 'bottom',
    },
  },
  prospeccao: {
    nav: '[data-tour="nav-prospeccao"]',
    navPopover: {
      title: 'Prospecção',
      description: 'Acompanhe o funil de prospecção e registre o atendimento de cada contato.',
      side: 'right',
    },
    route: '/prospeccao',
    element: '[data-tour="page-primary-action"]',
    popover: {
      title: 'Novo prospect',
      description: 'Clique aqui para cadastrar um novo contato no funil de prospecção.',
      side: 'bottom',
    },
  },
  produtividade: {
    nav: '[data-tour="nav-produtividade"]',
    navPopover: {
      title: 'Produtividade',
      description: 'Acompanhe relatórios de horas e produtividade da equipe.',
      side: 'right',
    },
    route: '/produtividade',
    element: '#main-content',
    popover: {
      title: 'Produtividade',
      description: 'Veja horas registradas e metas de produtividade aqui.',
      side: 'bottom',
    },
  },
  auditoria: {
    nav: '[data-tour="nav-auditoria"]',
    navPopover: {
      title: 'Auditoria',
      description: 'Veja o histórico de ações realizadas no sistema.',
      side: 'right',
    },
    route: '/auditoria',
    element: '#main-content',
    popover: {
      title: 'Auditoria',
      description: 'Todo o histórico de ações fica registrado aqui.',
      side: 'bottom',
    },
  },
  financeiro: {
    nav: '[data-tour="nav-financeiro"]',
    navPopover: {
      title: 'Financeiro',
      description: 'Acompanhe e registre as cobranças e lançamentos financeiros.',
      side: 'right',
    },
    route: '/financeiro',
    element: '[data-tour="page-primary-action"]',
    popover: {
      title: 'Nova cobrança',
      description: 'Clique em "Novo lançamento" para criar uma cobrança.',
      side: 'bottom',
    },
  },
  usuarios: {
    nav: '[data-tour="nav-usuarios"]',
    navPopover: {
      title: 'Usuários',
      description: 'Gerencie os usuários e os acessos do escritório aqui.',
      side: 'right',
    },
    route: '/usuarios',
    element: '[data-tour="page-primary-action"]',
    popover: {
      title: 'Cadastrar usuário',
      description: 'Clique em "Novo" para cadastrar um usuário da equipe.',
      side: 'bottom',
    },
  },
};

function screenSteps(key) {
  const screen = SCREENS[key];
  return [
    { element: screen.nav, popover: screen.navPopover },
    { element: screen.element, route: screen.route, popover: screen.popover },
  ];
}

function buildTour(keys) {
  return keys.flatMap(screenSteps);
}

export const TOURS = {
  advogado: buildTour([
    'clientes',
    'processos',
    'prazos',
    'peticoes',
    'agenda',
    'reunioes',
    'prospeccao',
    'produtividade',
    'auditoria',
  ]),
  estagiario: buildTour([
    'agenda',
    'prazos',
    'prospeccao',
    'clientes',
    'processos',
    'peticoes',
    'reunioes',
    'produtividade',
    'auditoria',
  ]),
  administrador: buildTour([
    'usuarios',
    'financeiro',
    'auditoria',
    'produtividade',
    'clientes',
    'processos',
    'prazos',
    'peticoes',
    'agenda',
    'reunioes',
    'prospeccao',
  ]),
};
