# RS Advocacia CRM

## Fluxo Git

- Nada direto em `main`/`master`: uma branch por issue, `tipo/<n>-descricao` (ex.: `feat/12-corretor-v2`).
- Commits e título de PR em Conventional Commits (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`),
  no imperativo e em inglês, como o histórico atual. Um assunto por commit.
- PR segue `.github/pull_request_template.md`, com `Closes #N`; merge por *Squash and merge* (o título vira o commit).
- Issues usam os modelos de `.github/ISSUE_TEMPLATE/` (Feature/Bug), sempre com critério de pronto.
- Todo PR fora de draft recebe review automático do Claude (`claude-review.yml`); responder ou corrigir cada ponto antes do merge.

## Comandos

Gate de verificação (o mesmo do CI, `.github/workflows/quality.yml`):

```bash
# backend (backend/)
uv sync --group dev
uv run ruff check .
uv run python manage.py test

# frontend (frontend/)
npm ci && npm run lint && npm run test
```

## Skills e automação

Plugins do marketplace [`lorenzo-skills`](https://github.com/LorenzoMarty/skills), ativados em `.claude/settings.json`.

- Tarefa não trivial começa por `workflow:start`, que escolhe a cadeia: `grill-me` → `write-spec` → `to-tickets` → `implement` → `verify`.
- Specs em `.claude/specs/<slug>/spec.md` (REQ-N, critérios de concluído, log da entrevista).
- Pronto = gate de verificação abaixo verde + relatório do `workflow:verify` no PR.
- **Agente autônomo:** a label `ready-for-agent` numa issue dispara o Claude (`claude.yml`), que implementa com `workflow:implement`, sobe a branch e comenta o link do PR. Issue que precisa de decisão humana recebe `needs-human`.

> Neste projeto `.claude/specs/` está no `.gitignore`: para trabalho do agente na nuvem ou na Action, o contrato é o corpo da issue.
