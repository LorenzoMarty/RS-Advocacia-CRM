# Manutencao frontend - 2026-05-26

## O que mudou

- Exclusoes deixaram de usar paginas `/excluir` no frontend. A confirmacao agora usa o modal existente sobre a pagina atual, com titulo "Tem certeza?", botao "Cancelar" e botao vermelho "Deletar".
- Mensagens do sistema foram convertidas para toast fixo no canto da tela, sem deslocar o layout e sem exigir clique para fechar. Erros criticos ainda podem receber fechamento manual via `addFlash(..., { critical: true })`.
- O sistema dispara lembretes discretos ao abrir a area protegida: prazos vencendo em ate 3 dias e compromissos marcados para amanha. A exibicao e limitada a uma vez por sessao/dia.
- Movimentacoes nos kanbans de prazos e peticoes agora notificam a coluna de destino sem duplicar o toast generico de salvamento.
- Acoes de exclusao foram padronizadas para o mesmo modal e os mesmos textos em clientes, processos, agenda, prazos, peticoes, usuarios, cargos e reunioes.

## Auditoria estrutural

- Prazo e peticao ainda fazem sentido como entidades separadas: prazo tem data limite, timer e regra processual; peticao/contestacao tem tipo de peca, adverso e link de Drive. O problema e que os dois kanbans repetem fluxo e drag/drop. Sugestao: extrair um componente unico de kanban parametrizado por colunas, card e callback de movimento.
- Compromisso nao esta duplicado entre cliente, processo e agenda no frontend: a agenda guarda o registro e cliente/processo apenas exibem filtros relacionados. No backend, `Evento` exige cliente e processo, enquanto a interface trata vinculos como opcionais em alguns pontos. Sugestao: alinhar regra de negocio, tornando os vinculos obrigatorios tambem na UI ou opcionais tambem no model.
- Usuarios usam cargos/permissoes: a tela de cargos edita permissoes e o backend aplica decorators de permissao. A UI ainda nao parece ocultar rotas/acoes conforme permissao do usuario atual. Sugestao: adicionar gating visual no menu e nos botoes em uma etapa separada, mantendo o backend como fonte final de autorizacao.
