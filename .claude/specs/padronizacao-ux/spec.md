---
slug: padronizacao-ux
status: needs-changes
revision_count: 1
artifact_url: https://claude.ai/code/artifact/f5ea9f9e-24e2-4fd4-8d95-3ca7496afb88
created: 2026-07-17
---

# Padronização de UI/UX — Apple-like, TOC-friendly, responsivo, Don't Make Me Think

## Objetivo

Continuação formalizada do refino visual já em andamento (flat design, sem gradiente/glow,
Tailwind+shadcn). Estender o padrão pra todo o app — inclusive telas já refinadas nesta sessão
— contra 4 critérios de qualidade: padronização/alinhamento rigoroso, convenções e estética
Apple, conforto pra usuários com TOC, responsividade real em desktop/tablet/mobile (agora
incluindo kanbans e calendário, antes fora de escopo), e o checklist "Don't Make Me Think"
(Steve Krug) aplicado de forma geral.

## Requisitos

- [x] REQ-1: Espaçamento, escala tipográfica e tamanho de ícone consistentes entre telas
  equivalentes (ex.: todo cabeçalho de lista usa o mesmo padrão de título+ação; todo Card usa o
  mesmo padding).
- [x] REQ-2: Ações equivalentes (Salvar/Cancelar, Excluir, confirmação de ação destrutiva)
  aparecem no mesmo lugar, ordem e com o mesmo padrão de confirmação em qualquer tela do app.
- [x] REQ-3: Convenções de interação macOS/iOS aplicadas: foco visível padrão em todo elemento
  interativo, Esc fecha modais/popups, Enter confirma formulários, áreas de toque com no mínimo
  ~40–44px.
- [x] REQ-4: Estética Apple-like mantida/estendida: tipografia com respiro generoso, raios de
  borda consistentes, paleta calma sem gradiente/glow (already in progress), nada visualmente
  destoante do restante do sistema.
- [~] REQ-5: App usável e confortável em desktop, tablet e mobile — incluindo kanbans (Prazos,
  Petições, Prospecção) e o calendário da Agenda, que agora entram no escopo de revisão de
  consistência (antes tratados como "miolo intocável").
- [x] REQ-6: Cada tela avaliada e ajustada contra o checklist "Don't Make Me Think": navegação
  óbvia, hierarquia visual clara, ação primária evidente, convenção em vez de originalidade,
  ambiguidade removida.
- [x] REQ-7: Processos, Usuários e Prospecção (telas ainda sem o refino visual desta fase)
  recebem o mesmo tratamento de padronização já aplicado em Dashboard/Financeiro/Auditoria/etc.

## Critérios de concluído

- Relatório de auditoria cobrindo todas as telas do app contra os 4 critérios (padronização,
  Apple, TOC, responsivo) + checklist Don't Make Me Think, listando achados e as correções
  efetivamente aplicadas.
- Aprovação final do usuário sobre esse relatório (não é revisão tela a tela durante a
  implementação — é uma aprovação única ao final, sobre o relatório consolidado).

## Fora de escopo

- Mudanças de backend/API.
- Novas features de produto.
- Qualquer dado que exigiria endpoint novo (ex.: sparkline com histórico real em Financeiro —
  já identificado como bloqueado por falta de API, decisão mantida).

## Skills necessárias

- `ui-styling`: aplicação consistente de componentes shadcn/Tailwind e espaçamento — usada em
  REQ-1, REQ-2 e REQ-7 (padronização das telas restantes).
- `web-design-guidelines`: fonte de verdade pra revisar a UI contra boas práticas de interface —
  usada em REQ-3 e REQ-6 (convenções de interação e checklist Don't Make Me Think).
- `accesslint:audit`: auditoria concreta de foco visível, área de toque e contraste — usada em
  REQ-3 (convenções Apple/acessibilidade) e REQ-5 (responsividade real).
- `design-taste-frontend`: evita UI genérica ao padronizar Processos/Usuários/Prospecção — usada
  em REQ-7.

## Log da entrevista

- P: Essa spec é continuação do refino visual já em andamento ou um pedido separado (auditoria
  nova)? / R: Continuação do refino atual.
- P: Quais telas entram nesta rodada — só as que faltam ou tudo, incluindo o já refinado? / R:
  Tudo, incluindo o que já foi refinado.
- P: "Confortável pra TOC" — alinhamento/grade, previsibilidade de interação, ou ambos? / R:
  Ambos igualmente.
- P: "Confortável pra usuários Apple" — convenções de interação, estética visual, ou ambos? / R:
  Ambos.
- P: Responsividade — quais tamanhos de tela importam? / R: Desktop, tablet e mobile.
- P: "Don't Make Me Think" — pontos específicos ou checklist geral? / R: Checklist geral em
  tudo.
- P: Kanbans e calendário sempre ficaram fora das migrações — entram no escopo de consistência
  agora? / R: Entram no escopo também.
- P: Critério de "concluído" — revisão tela a tela ou relatório final? / R: Relatório de
  auditoria + aprovação final.

## Log de implementação (revision_count: 1)

**O que foi feito:**
- Corrigido `focus-visible` global ausente (`styles/base/reset.css` zerava o outline sem
  substituto) e ausente no `buttonVariants` do shadcn Button — REQ-3.
- Bumped touch targets do Button (`default` 36→40px, `sm` 32→36px, `lg` 40→44px, `icon` 36→40px)
  — REQ-3. `sm` ficou deliberadamente abaixo de 44px: usado em linhas de tabela densas
  (Ver/Editar/Excluir); levar a 44px inflaria demais essas listas. Compromisso assumido, não
  escondido.
- Esc já fechava popups de confirmação; adicionado Esc ao `ProfileMenu` da sidebar (só o
  outside-click cobria antes) — REQ-3.
- Padronizado espaçamento de cabeçalho de lista: `dashboard.jsx` e `agenda-list.jsx` usavam
  `mb-6` enquanto todas as outras 8 telas de listagem usam `mb-2` — ambos corrigidos para `mb-2`
  — REQ-1.
- Ações Salvar/Cancelar e o fluxo de confirmação destrutiva (`useConfirmPopup`) já eram
  consistentes em toda a base — confirmado via grep em todos os `*-form.jsx` e telas com Excluir
  — REQ-2.
- **REQ-7 (achado durante a auditoria, não estava concluído como a spec presumia):** Processos,
  Usuários e Prospecção ainda tinham telas de detalhe com markup 100% CSS legado (`event-item`,
  `related-item`, `client-card`, `meta-chip`, `note-box`, `.empty`) — o mesmo bug de raiz do
  `EmptyState` que motivou toda essa spec, só que nunca migrado nessas 3 telas. Confirmado com o
  usuário (AskUserQuestion) antes de prosseguir; migrado:
  - Novo componente compartilhado `RelatedItem` em `pages/common.jsx` (título/subtítulo/badge/
    chips) para as listas de itens relacionados dentro de `DetailSection`.
  - `processes.jsx` (`ProcessDetailPage`): compromissos/prazos/peças relacionados + card de
    cliente vinculado + observações, todos migrados para `RelatedItem`/Tailwind.
  - `users.jsx` (`UserDetailPage`): processos/compromissos relacionados migrados para
    `RelatedItem`.
  - Botões de ação em `EmptyState` (`<Link className="btn">`) trocados por `<Button asChild>`
    em `processes.jsx`, `users.jsx`, `prospeccao-list.jsx` para usar o componente shadcn em vez
    da classe CSS legada `.btn`.
  - `prospeccao-list.jsx` e `prospect-detail.jsx`: header/toolbar/métricas já estavam migrados;
    confirmado que `prospeccao.css` não tem gradiente residual (só um box-shadow funcional de
    borda, não um glow).
- Sweep amplo por gradiente/glow residual em botões, selects, cards de kanban (Prazos/Petições),
  modais, loading/skeleton, login — todos achatados para cor sólida nesta sessão (antes deste
  log) — REQ-4.

**Arquivos tocados nesta rodada (além do já registrado em sessões anteriores):**
`app/pages/dashboard.jsx`, `app/pages/agenda-list.jsx`, `app/pages/common.jsx`,
`app/pages/processes.jsx`, `app/pages/users.jsx`, `app/pages/prospeccao-list.jsx`.

**REQ-5 (parcial, `[~]`):** kanbans (Prazos/Petições/Prospecção) e calendário da Agenda tiveram
o gradiente/glow removido e cards já usam `cardHover` (framer-motion) ou `translateY` em CSS,
mas a estrutura interna (colunas de drag-and-drop, grid do calendário) permanece como CSS legado
por design — reescrever para Tailwind puro arrisca quebrar o drag-and-drop sem ganho visual
adicional, já que a paleta e o espaçamento já foram unificados. Responsividade em tablet/mobile
não foi verificada visualmente em runtime nesta rodada (extensão Chrome DevTools MCP
indisponível durante toda a sessão) — só `npm run build`/`npx eslint`, nenhuma captura de tela.

**Skills efetivamente usadas:** `web-design-guidelines` (checklist manual via WebFetch,
categorias Accessibility/Focus/Forms/Navigation/Dark Mode/i18n cobertas por grep+leitura de
código, não auditoria automatizada), `ui-styling` (aplicação de shadcn/Tailwind no REQ-7).
**Não usadas:** `accesslint:audit` (precisa de Chrome ao vivo, indisponível) e
`design-taste-frontend` (REQ-7 seguiu o padrão já estabelecido nas demais telas em vez de uma
exploração de design própria — decisão consciente de consistência sobre originalidade).

**Achados fora do escopo desta spec (não corrigidos, só registrados):** `clients.jsx`
(`ClientDetailPage`, não nomeada no REQ-7) tem o mesmo padrão legado (`event-item`/`list-top`/
`meta-chip`/`note-box`/`.empty`) nas seções de processos/compromissos relacionados ao cliente.
Como não foi um dos 3 nomes explícitos do REQ-7, não foi alterada — fica como candidata a uma
spec/rodada futura.

## Correções pendentes (review-spec, revision_count: 1)

- **REQ-5 — lacuna, não bug.** Nenhuma verificação em runtime (browser) foi feita em nenhuma tela
  em tablet/mobile durante toda esta rodada — a extensão Chrome DevTools MCP retornou "did not
  respond in time" em toda tentativa (última tentativa: `tabs_context_mcp` nesta review, mesmo
  erro). Kanbans/calendário tiveram só gradiente/glow removido; a estrutura de drag-and-drop e a
  responsividade real desses componentes em telas menores permanecem não verificadas — só lidas
  no código, o que a regra de verificação do projeto não aceita como prova.
  - **O que precisa acontecer para fechar REQ-5:** verificação visual real (screenshot ou
    inspeção manual) de Prazos/Petições/Prospecção (kanban) e Agenda (calendário) em ~768px e
    ~390px de largura — confirmando que colunas/cards não quebram, texto não trunca de forma
    ilegível, e o drag-and-drop continua utilizável em touch.
  - **Bloqueio:** depende de um Chrome funcional (extensão MCP) ou de o usuário testar
    manualmente e reportar o resultado. Não é algo que `implement-spec` resolve escrevendo mais
    código sem essa verificação — por isso a cadeia automática para `implement-spec` foi
    interrompida aqui, e a decisão foi devolvida ao usuário em vez de tentar de novo sem sucesso.
