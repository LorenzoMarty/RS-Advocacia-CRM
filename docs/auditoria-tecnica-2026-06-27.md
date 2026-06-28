# Avaliação Geral do Sistema — Agenda-Juri

> Auditoria técnica realizada em 2026-06-27. Leitura apenas — nenhum arquivo modificado.

---

## Resumo Executivo

Sistema de CRM jurídico com arquitetura Django 6 + React 19. Código escrito com cuidado acima da média de projetos solo/freelance: envelope de resposta consistente, decoradores de permissão, type hints no backend, mappers pt↔en puros e testáveis no frontend. Os maiores riscos são: **credenciais de produção presentes nos arquivos `.env`** (potencialmente rastreados pelo git), **ausência total de CI/CD**, **store frontend monolítico de 1.1k linhas** que carrega toda a base de dados na inicialização, e **cobertura de testes restrita ao backend** sem nenhum teste de componente ou E2E. Para um MVP de escritório pequeno o sistema é funcional e defensável; para crescimento ou um segundo cliente seria necessário refatorar a camada de dados.

---

## Nota Geral

| Área | Nota |
|---|---|
| Backend | 7,5 / 10 |
| Frontend | 6,5 / 10 |
| Segurança | 6,0 / 10 |
| Acessibilidade | 4,5 / 10 |
| Arquitetura | 6,5 / 10 |
| Performance | 5,5 / 10 |
| Testes | 5,0 / 10 |
| DevOps | 6,0 / 10 |
| Manutenibilidade | 6,5 / 10 |

---

## Principais Problemas Críticos

### [Crítico] Credenciais de produção em arquivos .env que podem estar rastreados pelo git

- **Local:** `backend/.env`, `backend/.env.local`
- **Área:** Segurança
- **Problema:** Os arquivos contêm senha real do Supabase, JWT secret, service role key, Google API credentials. O repo não tem `.github/` nem histórico visível, mas se `.env` ou `.env.local` foram commitados alguma vez, todas as credenciais vazaram e permanecem no histórico git.
- **Impacto:** Acesso total ao banco Supabase de produção, impersonação de service role, acesso a dados de clientes reais.
- **Solução:** Verificar `git log --all --full-history -- .env`; se aparecer, usar BFG Repo Cleaner. Rotacionar **imediatamente** todas as credenciais listadas nesses arquivos. Garantir que `.env` e `.env.local` estão no `.gitignore`. Manter apenas `.env.example` com placeholders.

---

### [Crítico] Toda a base de dados é carregada em memória no cliente no boot

- **Local:** `frontend/src/app/store.jsx` — `loadRemoteCollections()` linhas 206–273
- **Área:** Performance / Arquitetura
- **Problema:** Na inicialização, o store dispara 6+ chamadas paralelas (`listClients`, `listProcesses`, `listEvents`, `listDeadlines`, `listPetitions`, `getProductivity`) sem paginação, trazendo todos os registros ao navegador.
- **Impacto:** Com 500+ clientes/processos/eventos, a inicialização trava a UI, o payload JSON fica em megabytes e o contexto React re-renderiza todas as páginas.
- **Solução curto prazo:** adicionar `?limit=` nas listagens e paginar no frontend. **Solução médio prazo:** mover para carregamento por página (cada rota faz seu próprio fetch), mantendo o store como cache compartilhado.

---

### [Crítico] Ausência de CI/CD e testes end-to-end

- **Local:** raiz do repositório — nenhum `.github/workflows/`, nenhum pipeline
- **Área:** DevOps / Testes
- **Problema:** Não existe pipeline automatizado. Deploys dependem de push manual. Regressões só são detectadas em produção.
- **Solução:** GitHub Actions mínimo: `npm run lint && npm test` (frontend) + `python manage.py test` (backend) em cada PR.

---

### [Alto] `CSRF_COOKIE_HTTPONLY = False` expõe o token CSRF a XSS

- **Local:** `backend/jurisagenda/settings.py` linha 296
- **Área:** Segurança
- **Problema:** O cookie do CSRF token é lido via JavaScript. Se houver qualquer XSS, o atacante pode exfiltrar o token e forjar requests autenticados.
- **Impacto:** XSS combinado com este setting permite CSRF completo.
- **Solução:** `CSRF_COOKIE_HTTPONLY = True`. O frontend precisaria ler o token via meta tag injetada pelo Django em vez de `document.cookie`.

---

### [Alto] `lang="en"` no HTML com UI 100% em português

- **Local:** `frontend/index.html` linha 2
- **Área:** Acessibilidade
- **Problema:** `<html lang="en">` declara o documento como inglês. Leitores de tela usarão pronúncia em inglês para conteúdo em português.
- **Solução:** `<html lang="pt-BR">` — mudança de 30 segundos, impacto alto.

---

## Análise por Área

### Backend

**[Médio] `converter_campos_datahora` silencia falhas de parse**
- `backend/core/utils.py` linhas 71–84
- Se `parse_datetime` retorna `None` (data malformada), o campo continua com o valor string original sem levantar erro. O ORM pode aceitar ou recusar silenciosamente.
- Solução: levantar `ValueError` quando `convertido is None`.

```python
# atual — silencia falha
if isinstance(valor, str):
    convertido = parse_datetime(valor)
    if convertido is not None:
        data[campo] = convertido

# correto
if isinstance(valor, str):
    convertido = parse_datetime(valor)
    if convertido is None:
        raise ValueError(f"Campo {campo}: formato de data/hora inválido")
    data[campo] = convertido
```

**[Médio] Sessão armazena nome e email além de ID**
- `backend/usuarios/views.py` — `_remember_usuario_session`
- Dados redundantes na sessão. Se a sessão for capturada (fixation), o atacante vê nome/email além do ID.
- Solução: armazenar só `usuario_id`; buscar nome/email na view quando necessário.

**[Médio] Sem rate limiting em nenhum endpoint**
- Nenhum middleware ou decorator de throttle encontrado em todo o projeto.
- Permite brute force em endpoints de ação e abuso de endpoints caros (ex.: `/visao-geral/`, sincronização Google).
- Solução: `django-ratelimit` — 60 req/min por IP nos endpoints abertos; 10/min em ações de escrita.

**[Médio] Filename não sanitizado em Content-Disposition**
- `backend/documentos/views.py` — `Content-Disposition: attachment; filename="{documento.nome}"`
- Nomes com aspas ou newlines quebram o header / possibilitam header injection.
- Solução:

```python
from urllib.parse import quote
safe_filename = quote(documento.nome, safe='')
response["Content-Disposition"] = f"attachment; filename*=UTF-8''{safe_filename}"
```

**[Médio] N+1 latente nos serializers de coleção**
- Todos os apps serializam relacionamentos (ex.: `Processo.cliente.nome`) sem `select_related`. Quando os querysets crescerem, cada item da lista fará um SELECT extra.
- Solução: adicionar `select_related('cliente', 'responsavel')` nos querysets das views de listagem.

**[Baixo] Sem health-check endpoint no Django**
- O docker-compose tem healthcheck no Redis, mas o Django não tem `/healthz` nem `/ready`.
- Solução: view simples em `core/` que retorna `{"ok": true}` sem auth.

**[Baixo] Sem auditoria de login/logout**
- O app `auditoria` registra ações de negócio, mas logins, logouts e tentativas falhas não são logados.
- Risco regulatório (LGPD) e forense.

---

### Frontend

**[Alto] `store.jsx` — God Object de 1.129 linhas**
- `frontend/src/app/store.jsx`
- Um único contexto contém estado de 14 coleções, 30+ funções, lógica de otimismo, lógica de timer e loading states. Qualquer mudança em qualquer entidade re-renderiza todos os consumidores do contexto.
- Solução: dividir em contextos por domínio (`AgendaContext`, `ClientsContext`, etc.) ou migrar para Zustand com slices.

**[Alto] `deadlines.jsx` concentra 4 responsabilidades**
- `frontend/src/app/pages/deadlines.jsx` — 1000+ linhas
- Contém: página de lista/kanban, página de detalhe, página de formulário e lógica de timer — num único arquivo.
- Solução: dividir em `DeadlinesKanban.jsx`, `DeadlineDetail.jsx`, `DeadlineForm.jsx`.

**[Médio] Re-render global a cada mutação**
- Toda operação de save/delete chama `setState` no `AppStateProvider`, re-renderizando todos os 40+ componentes consumindo `useAppState()`.
- Solução: `useMemo`/`useCallback` nas funções do contexto e `React.memo` nos componentes de lista.

**[Médio] Sem paginação nas tabelas de clientes e processos**
- `clients.jsx` e `processes.jsx` renderizam todos os registros via `@tanstack/react-table` com filtro client-side. Funciona com 50 registros; trava com 500+.
- Solução: paginação server-side via query params.

**[Médio] Ausência de loading skeleton em rotas de detalhe**
- `agenda-event-detail.jsx` retorna `null` enquanto carrega (linhas 60–62). Tela em branco sem feedback.
- `Skeleton.jsx` existe em `motion/` mas não é usado nessas rotas.
- Solução: usar `<Skeleton />` no estado de loading.

**[Médio] Validação de formulários inconsistente entre páginas**
- `clients.jsx` usa `react-hook-form + zod` (excelente).
- `agenda-event-form.jsx`, `deadlines.jsx`, `processes.jsx` usam `useState` com validação manual inline.
- Solução: padronizar em `react-hook-form + zod` em todos os formulários.

**[Baixo] `deleteClient` dispara 4 API calls para refresh**
- `store.jsx` linhas 651–665 — após deletar um cliente, chama `listProcesses`, `listEvents`, `listDeadlines`, `listPetitions` para reconciliar o estado.
- Alternativa: filtrar o estado local pelos IDs afetados pelo cascade, evitando os 4 roundtrips.

---

### Cybersecurity

**[Crítico] Credenciais em `.env` / `.env.local`** — ver seção acima.

**[Alto] `CSRF_COOKIE_HTTPONLY = False`** — ver seção acima.

**[Alto] `CORS_ALLOW_ALL_ORIGINS = DEBUG`**
- `backend/jurisagenda/settings.py` linha 271
- Em desenvolvimento (`DEBUG=true`) CORS abre para qualquer origem. Se alguém rodar com `DEBUG=true` em ambiente semi-público, qualquer site pode fazer requests autenticados.
- Solução: manter `CORS_ALLOW_ALL_ORIGINS = False` sempre; em dev usar lista explícita `localhost:5173`.

**[Médio] Sem Content-Security-Policy**
- `index.html` não tem meta CSP. Backend não injeta o header `Content-Security-Policy`.
- XSS sem mitigação adicional além do React escapar JSX por padrão.
- Solução: header CSP no Caddy — início com `default-src 'self'; script-src 'self' 'unsafe-inline'`.

**[Médio] Open redirect residual no OAuth**
- `backend/integrations/google/views.py` — parâmetro `?next=` não validado contra whitelist de rotas.
- Baixo risco pois redireciona sempre para `FRONTEND_URL + path`, não URL externa; vale fechar.

```python
ALLOWED_NEXT_PATHS = {"/", "/agenda", "/clientes", "/processos", "/prazos"}
if next_path not in ALLOWED_NEXT_PATHS:
    next_path = "/"
```

**[Baixo] Informações internas em respostas de erro com DEBUG=True**
- `backend/meetings/views.py` linhas 139–142 — resposta inclui detalhes de erro da API Google quando DEBUG.
- Solução: logar server-side; nunca expor ao cliente.

---

### Acessibilidade

**[Crítico] `lang="en"` no documento pt-BR**
- `frontend/index.html` linha 2 — `<html lang="en">`
- Leitores de tela usam pronúncia em inglês para todo o conteúdo.
- Solução: `<html lang="pt-BR">`.

**[Alto] Ícones SVG de navegação sem texto acessível**
- `frontend/src/app/layout.jsx` — função `NavigationIcon` retorna SVGs sem `aria-label`.
- Em modo colapsado ou com zoom alto o texto some e o ícone fica sem nome acessível.
- Solução: `aria-label` no `<NavLink>` ou `<title>` dentro do SVG de cada ícone.

**[Alto] Labels de campos de formulário inconsistentes**
- Vários `<input>` em `deadlines.jsx` e `agenda-event-form.jsx` usam `placeholder` como único label.
- Leitores de tela não leem placeholder como label; o texto some quando o campo tem valor.
- Solução: `<label htmlFor="campo-id">` explícito em cada input.

**[Médio] Confirmação de exclusão não verificada para acessibilidade de teclado**
- `hooks/use-confirm-popup.jsx` — verificar se o popup tem `role="dialog"`, `aria-modal="true"`, foco movido ao abrir e retornado ao fechar.

**[Médio] Botões de ação sem `type="button"` explícito em formulários**
- Botões dentro de `<form>` sem `type="button"` disparam submit não intencional.

**[Médio] Contraste de cores não verificado**
- Variáveis CSS (`--color-text`, `--surface`, etc.) com temas personalizáveis podem ter contraste insuficiente.
- Testar WCAG AA (4.5:1 para texto normal) em todos os temas.

**[Baixo] Mensagens de erro não vinculadas via `aria-describedby`**
- Erros do zod/react-hook-form aparecem abaixo do campo sem `aria-describedby` ligando input à mensagem.

---

### Engenharia de Software

**[Alto] Mistura de idiomas em nomes de função/variável**
- Backend: `resposta_sucesso`, `ler_corpo_json` (pt-BR) — ok, convenção do projeto.
- Frontend: `lancamentos`, `marcarLancamentoPago`, `addInteracao`, `sair` convivem com `saveClient`, `deleteProcess`, `loadEvent` (inglês).
- O `CLAUDE.md` define "código em inglês". `store.jsx` quebra essa regra em ~30% das funções.

**[Médio] `store.jsx` viola SRP e tem complexidade de Deus**
- 1129 linhas, 14 `useState`, ~30 funções exportadas, lógica de negócio embutida no contexto React.
- Lógica de negócio deveria ser extraída para hooks especializados (`useTimeEntries`, `useDeadlines`, etc.).

**[Médio] `NavigationIcon` com switch de 15 casos inline**
- `layout.jsx` — switch/case com 15 SVGs hardcoded. Cada novo item de nav exige modificar `layout.jsx`.
- Solução: extrair para `icons.jsx` com mapa de componentes, ou adotar Lucide React.

**[Médio] `nextId` com fallback de `Date.now() + random`**
- `store.jsx` linhas 52–58 — IDs temporários via `Date.now()` + `Math.random()`. Colisão improvável mas existe.
- Solução: `crypto.randomUUID()` disponível em todos os browsers modernos.

**[Baixo] Constantes de UI duplicadas entre `data.js` e código inline**
- Algumas opções de status aparecem tanto em `data.js` quanto hardcoded em JSX.

---

### Arquitetura

**[Alto] Frontend sem camada de cache / invalidação**
- O store carrega tudo ao iniciar e nunca re-fetcha automaticamente.
- Se dois usuários editam o mesmo registro simultaneamente, um vê dado stale.
- Solução: React Query / SWR que gerenciam stale-while-revalidate automaticamente.

**[Médio] Backend sem camada de serviço uniforme**
- `agenda/services/` existe (Google sync) mas os demais apps (`clientes`, `processos`, `prazos`, `peticoes`) têm toda lógica diretamente nas views.
- Conforme o negócio cresce, lógica cross-domain ficará nos views ou em signals não rastreáveis.
- Solução: criar `services.py` por app; views apenas leem request, delegam ao service, retornam envelope.

**[Médio] Integração Google acoplada diretamente às views**
- `agenda/views.py` importa diretamente de `agenda/services/`.
- `documentos/views.py` e `meetings/views.py` importam de `integrations/google/drive.py` e `ai/`.
- Se a Google API muda, N views mudam. Falta abstração intermediária.

**[Baixo] HashRouter limita SEO e deep-linking**
- `App.jsx` usa `HashRouter` (`/#/...`). Justificado pela arquitetura Cloudflare Pages, mas impede indexação e dificulta compartilhamento de links.

---

### Performance

**[Crítico] Payload de inicialização sem limite de registros**
- `backend/core/` — endpoint de bootstrap traz todas as coleções sem `LIMIT`.
- Com 1000 clientes + 2000 processos + 5000 eventos, o JSON de boot passa de 5MB facilmente.
- Solução imediata: limitar inicialização a dados recentes (eventos dos últimos 90 dias, prazos não concluídos) e paginar o resto.

**[Alto] 6+ requests paralelos em cada inicialização**
- `store.jsx` `loadRemoteCollections` — `Promise.allSettled` com 6 loaders além do bootstrap inicial.
- Solução: consolidar no endpoint de bootstrap e eliminar os loaders individuais redundantes.

**[Médio] Sem memoização em listas grandes**
- `clients.jsx`, `processes.jsx` — filtros e sorts rodando em cada render via `useReactTable` sem `useMemo`.
- `deadlines.jsx` — `filteredDeadlines` recalculado em cada render.

**[Médio] Framer Motion por card em listas longas**
- `staggerContainer`/`staggerItem` animam cada card individualmente.
- Com 50+ cards, o Framer Motion cria um Observer por card. Em dispositivos lentos causa jank.
- Solução: `prefersReducedMotion()` já existe — aplicar nas listas longas também.

**[Baixo] Fonte Google carregada de CDN externo**
- `index.html` linhas 9–11 — `preconnect` e link para `fonts.googleapis.com`.
- Adiciona DNS lookup e request externo no critical path.
- Solução: hospedar fontes localmente via `fontsource` packages.

---

### Testes

**[Alto] Zero testes de componente/página no frontend**
- `frontend/src/` — apenas `mappers.test.js` encontrado. Nenhum teste de componente React.
- Formulários, lógica de permissão, renderização condicional e `store.jsx` sem cobertura.
- Solução mínima: Vitest + Testing Library para os formulários críticos (criação de cliente, evento, prazo).

**[Alto] Sem testes E2E**
- Nenhum Playwright ou Cypress encontrado.
- Fluxos críticos (login OAuth, criar processo + prazo, marcar comparecimento) sem cobertura automatizada.

**[Médio] Testes backend sem cobertura de permissões**
- `agenda/tests.py` — setUp usa `create_superuser` e `force_login`. Não há teste de "usuário sem permissão recebe 403".
- A lógica de permissões é o diferencial de segurança; deveria ser testada explicitamente.

**[Médio] Sem factory de dados**
- Cada `setUp` cria objetos manualmente com valores hardcoded.
- Com `factory_boy` os testes ficam mais legíveis e DRY.

**[Médio] Coverage não executado na suite padrão**
- `python manage.py test` não gera coverage. O CLAUDE.md instrui `coverage run manage.py test` separado, mas sem automação.

**[Baixo] Apps `notificacoes`, `ai`, `auditoria` com cobertura mínima ou zero**
- Apps de IA/notificações são críticos e difíceis de testar manualmente.

---

### DevOps

**[Crítico] Sem CI/CD** — ver seção acima.

**[Alto] Sem ambiente de staging**
- Deploy vai direto de `master` para produção (Cloudflare Pages + GCP VM).
- Sem sandbox para testar migrações e integrações antes de afetar usuários reais.

**[Médio] `docker-compose.yml` sem healthcheck no serviço web**
- `deploy/gcp-free/docker-compose.yml` — Redis tem healthcheck, mas o container `web` não.
- O Caddy pode receber tráfego antes do Django estar pronto.
- Solução: `healthcheck: test: ["CMD", "curl", "-f", "http://localhost:8000/healthz"]`

**[Médio] Redis interno sem TLS**
- `deploy/gcp-free/docker-compose.yml` linha 21 — `redis://` sem TLS dentro da rede Docker.
- Senha em texto no compose file é dívida técnica para produção.
- Solução: Redis com TLS ou socket Unix.

**[Médio] `migrate` e `collectstatic` no entrypoint do container**
- Linhas 24–25 do compose. Com múltiplos workers, executar migrate no entrypoint causa race conditions.
- Solução: migrate como job separado antes do deploy.

**[Baixo] `--workers 2` hardcoded no gunicorn**
- `deploy/gcp-free/docker-compose.yml` linha 18.
- Número ideal: `(2 × nCPUs) + 1`. Configurar via env var.

---

### Documentação

**[Médio] README ausente ou vazio**
- Nenhum `README.md` encontrado na raiz do projeto.
- Um novo desenvolvedor não sabe como rodar o projeto sem ler o `CLAUDE.md`.
- Solução: `README.md` com setup em 5 comandos, requisitos, estrutura e links para docs.

**[Médio] Documentação de API inexistente**
- Nenhum schema OpenAPI, Swagger ou Postman collection.
- As ~80 views de função não têm documentação dos campos aceitos/retornados além do código.

**[Baixo] `CLAUDE.md` mistura instrução de IA com documentação técnica**
- O arquivo serve dupla função: guiar a IA e documentar o projeto.
- Solução: separar em `docs/setup.md`, `docs/architecture.md` e manter `CLAUDE.md` apenas com instruções de colaboração com a IA.

---

## Plano de Melhoria Priorizado

### Fase 1 — Correções críticas (semana 1)

1. **Verificar e limpar credenciais do git** — `git log --all -- .env .env.local`; se comprometidas, rotar TODAS as credenciais (Supabase, Google, OpenAI).
2. **`lang="pt-BR"`** no `index.html` — 30 segundos.
3. **`CSRF_COOKIE_HTTPONLY = True`** — ajustar o fetch do CSRF token no frontend para ler de meta tag injetada pelo Django.
4. **`CORS_ALLOW_ALL_ORIGINS = False` em dev** — manter lista explícita `localhost:5173`.
5. **Health check endpoint** — view `GET /api/healthz/` que retorna 200 sem auth.
6. **Labels em todos os inputs dos formulários principais** (cliente, evento, prazo).

### Fase 2 — Qualidade e manutenção (sprint 1–2)

7. **CI mínimo** — GitHub Actions: lint + test no PR.
8. **Paginação nos endpoints de listagem** — `?limit=50&offset=0` no backend; store frontend carrega só a página atual.
9. **Dividir `deadlines.jsx`** — extrair `DeadlineDetail`, `DeadlineForm` como arquivos separados.
10. **Dividir `store.jsx`** — extrair `useTimeEntries`, `useAudit` como hooks/contextos separados.
11. **`converter_campos_datahora` com erro** em vez de silêncio — `core/utils.py`.
12. **Sanitização de filename** em `documentos/views.py` — RFC 5987.
13. **Testes de permissão** — pelo menos um teste de "usuário sem permissão recebe 403" por app.
14. **`select_related` nas views de listagem** para eliminar N+1 latente.

### Fase 3 — Excelência (próximo trimestre)

15. **React Query / SWR** em substituição ao store monolítico — stale-while-revalidate, deduplica requests, invalida por chave.
16. **Rate limiting** — `django-ratelimit` com 60 req/min por IP; 10/min em ações de escrita.
17. **Content-Security-Policy** no Caddy via header estático.
18. **Testes de componente React** — Testing Library para os 5 formulários principais.
19. **Playwright E2E** — login → criar cliente → criar processo → criar evento → marcar comparecimento.
20. **Staging environment** — branch `staging` com deploy automático para instância separada.
21. **Camada de serviço no backend** — `services.py` por app para lógica cross-domain.
22. **`aria-describedby`** nos campos com mensagens de erro; `aria-label` nos ícones de nav.
23. **Fontes autohosted** — `@fontsource/inter` no bundle, eliminar CDN externo.
24. **Documentação pública** — `README.md` com setup + `docs/api.md`.

---

## Checklist Final

### Segurança
- [ ] Verificar histórico git para `.env` e `.env.local` — rotar credenciais se encontradas
- [ ] `CSRF_COOKIE_HTTPONLY = True` + ajuste no fetch do frontend
- [ ] `CORS_ALLOW_ALL_ORIGINS = False` em dev
- [ ] Sanitizar `Content-Disposition: filename` com RFC 5987
- [ ] Validar parâmetro `?next=` no OAuth contra whitelist
- [ ] Remover detalhes de erro interno das respostas de erro
- [ ] Adicionar `Content-Security-Policy` header no Caddy

### Acessibilidade
- [ ] `<html lang="pt-BR">` no `index.html`
- [ ] `<label htmlFor>` explícito em todos os inputs de formulário
- [ ] `aria-label` ou `<title>` em ícones SVG de navegação
- [ ] `aria-describedby` ligando inputs às mensagens de erro
- [ ] Verificar contraste WCAG AA (4.5:1) em todos os temas
- [ ] Popup de confirmação com `role="dialog"`, foco correto

### Performance
- [ ] Paginação server-side em todos os endpoints de lista (`limit/offset`)
- [ ] Bootstrap endpoint retorna apenas dados recentes
- [ ] `useMemo` nas funções de filtro/sort nas listas
- [ ] Remover redundância de 6 loaders paralelos pós-bootstrap
- [ ] Hospedar fontes localmente

### Frontend
- [ ] Dividir `deadlines.jsx` (1000+ linhas) em 3 arquivos
- [ ] Dividir `store.jsx` (1129 linhas) em contextos/hooks por domínio
- [ ] Padronizar formulários em `react-hook-form + zod`
- [ ] Skeleton loading em todas as rotas de detalhe
- [ ] Unificar nomes de funções para inglês no store

### Backend
- [ ] `converter_campos_datahora` levantar `ValueError` em parse inválido
- [ ] `select_related` nas views de listagem de cada app
- [ ] Health check endpoint `/api/healthz/`
- [ ] Rate limiting com `django-ratelimit`
- [ ] Sessão armazenar apenas `usuario_id`
- [ ] Camada `services.py` por app

### Testes
- [ ] CI com `npm run lint && npm test && python manage.py test`
- [ ] Testes de permissão (403) em cada app backend
- [ ] Testes de componente React com Vitest + Testing Library
- [ ] Cobertura de `store.jsx` (mock de API)
- [ ] Playwright E2E: fluxo de login → criação de entidade → ação de negócio

### DevOps
- [ ] CI/CD no GitHub Actions
- [ ] Ambiente de staging
- [ ] `healthcheck` no serviço `web` do `docker-compose.yml`
- [ ] `--workers` via env var no gunicorn
- [ ] `migrate` como job separado, não em entrypoint

### Documentação
- [ ] `README.md` com setup em 5 comandos
- [ ] Separar instrução da IA da documentação técnica no `CLAUDE.md`
- [ ] Documentar API (endpoint, método, campos obrigatórios)
