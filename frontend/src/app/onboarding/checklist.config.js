// Itens do checklist de primeiros passos exibido no dashboard, por perfil.
export const CHECKLIST_ITEMS = {
  advogado: [
    { id: 'cadastrar_cliente', label: 'Cadastrar seu primeiro cliente', route: '/clientes/novo' },
    { id: 'cadastrar_processo', label: 'Cadastrar um processo', route: '/processos/novo' },
    { id: 'criar_prazo', label: 'Criar um prazo', route: '/prazos/novo' },
    { id: 'anexar_documento', label: 'Anexar um documento a um prazo', route: '/prazos' },
    { id: 'ver_produtividade', label: 'Ver seu painel de produtividade', route: '/produtividade' },
  ],
  estagiario: [
    { id: 'ver_agenda', label: 'Conferir a agenda do escritório', route: '/agenda' },
    { id: 'criar_prazo', label: 'Criar um prazo', route: '/prazos/novo' },
    { id: 'registrar_interacao', label: 'Registrar um atendimento em prospecção', route: '/prospeccao' },
    { id: 'anexar_documento', label: 'Anexar um documento a um prazo', route: '/prazos' },
  ],
  administrador: [
    { id: 'cadastrar_usuario', label: 'Cadastrar um usuário da equipe', route: '/usuarios/novo' },
    { id: 'criar_cobranca', label: 'Criar uma cobrança', route: '/financeiro/novo' },
    { id: 'ver_auditoria', label: 'Ver o histórico de auditoria', route: '/auditoria' },
    { id: 'ver_produtividade', label: 'Ver relatórios de produtividade da equipe', route: '/produtividade' },
  ],
};
