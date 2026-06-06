# Production Readiness — Agenda-Juri backend

Guia operacional para validar saúde e prontidão do backend Django antes de
produção. Complementa o `README` e `docs/architecture-ai-meetings.md`.

## 1. Endpoints de saúde

| Endpoint | Tipo | Comportamento |
|----------|------|---------------|
| `GET /health/` | Liveness | Sempre `200 {"status":"ok"}`. Não toca dependências. |
| `GET /ready/` | Readiness | Checa banco, cache e broker (se `CELERY_BROKER_URL`). `200` se tudo ok, `503` se algo falha. |

Resposta do `/ready/`:

```json
{"status": "ok", "checks": {"database": "ok", "cache": "ok", "broker": "ok"}}
```

`broker` só aparece quando `CELERY_BROKER_URL` está configurado. As respostas
expõem apenas status por dependência — sem versões/hosts.

Configure no orquestrador: liveness → `/health/`, readiness → `/ready/`.

## 2. Logging

`LOGGING` emite para **stdout** (canal correto em serverless/containers — o
coletor da plataforma captura). Sem file handler.

- `LOG_LEVEL` (env) controla o nível dos loggers da aplicação. Default:
  `DEBUG` em dev, `INFO` em produção.
- Loggers configurados para todos os apps (`agenda`, `clientes`, `core`,
  `integrations`, `meetings`, `peticoes`, `prazos`, `processos`,
  `productivity`, `usuarios`, `ai`) + `django.request`/`django.server`.
- Chamadas `logger.exception(...)` existentes (ex.: `meetings/tasks.py`,
  `agenda/views.py`, `integrations/google/*`) agora aparecem nos logs.

## 3. Cache

`CACHES` usa Redis quando `CACHE_URL` ou `REDIS_URL` está definido; senão
`LocMemCache` (dev/test). `KEY_PREFIX="juris"` evita colisão com chaves do broker
Celery na mesma instância Redis. A infra está pronta, mas nenhuma view usa cache
ainda (comportamento de negócio inalterado).

## 4. Verificação de configuração

```bash
python manage.py check --deploy
```

Com `DEBUG=False` e `SECRET_KEY` forte (≥50 chars, aleatória), o check deve
passar sem warnings. Endurecimentos aplicados (todos configuráveis por env):

| Setting | Default produção | Env override |
|---------|------------------|--------------|
| `SECURE_SSL_REDIRECT` | `True` | `SECURE_SSL_REDIRECT` |
| `SECURE_HSTS_SECONDS` | `31536000` | `SECURE_HSTS_SECONDS` |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` | idem |
| `SECURE_HSTS_PRELOAD` | `True` | idem |
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` | — |
| `AUTH_PASSWORD_VALIDATORS` | 4 validadores padrão | — |

Cookies seguros (`Secure` + `SameSite=None`) e CSRF/CORS restritos ao origin do
frontend já estavam em vigor (ver `settings.py`).

## 5. Variáveis de ambiente obrigatórias (produção)

| Var | Descrição |
|-----|-----------|
| `SECRET_KEY` | Chave longa e aleatória (≥50 chars). |
| `DEBUG` | `False`. |
| `ALLOWED_HOSTS` | Hosts adicionais (env), além dos defaults. |
| `DATABASE_URL` | Postgres (SQLite não suportado). |
| `REDIS_URL` | Broker Celery + cache. Sem ela, meetings cai para `inline`. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | **Defina explicitamente** (Fernet). O fallback usa SHA256(`SECRET_KEY`) — rotacionar `SECRET_KEY` quebraria a descriptografia dos tokens Google. |
| `OPENAI_API_KEY` | Transcrição/resumo de reuniões. |
| `MEETINGS_PROCESSING_MODE` | `celery` (worker dedicado) ou `inline`. |

## 6. Riscos conhecidos

- **`MEETINGS_PROCESSING_MODE=inline` em serverless**: transcrição síncrona
  estoura o timeout (~60s) com áudio real. Use `celery` + worker always-on
  (Render/Railway/Fly/VM) com Redis externo em produção.
- **Encryption key fallback**: ver `GOOGLE_TOKEN_ENCRYPTION_KEY` acima.
- **django-ninja `csrf` kwarg**: removido em ninja 1.x — CSRF é automático para
  auth de sessão. Não reintroduzir `csrf=` em `jurisagenda/api.py`.

## 7. Comandos de validação

```bash
# de Agenda-Juri/backend/
python manage.py check --deploy
python manage.py test                      # suíte completa
python manage.py test core processos productivity

# health (servidor rodando)
curl -i http://localhost:8000/health/
curl -i http://localhost:8000/ready/

# carga
k6 run -e BASE_URL=http://localhost:8000 loadtest/smoke.js
k6 run -e BASE_URL=http://localhost:8000 loadtest/load.js
```

## 8. Critérios de "pronto para produção"

- [ ] `check --deploy` sem warnings (com SECRET_KEY real).
- [ ] `/health/` 200 sempre; `/ready/` 503 quando DB/Redis indisponível.
- [ ] Logs dos apps aparecem em stdout com timestamp+nível.
- [ ] Suíte de testes verde.
- [ ] k6 smoke dentro dos limiares (p95, erro < 1%).
- [ ] Env vars da seção 5 definidas; `GOOGLE_TOKEN_ENCRYPTION_KEY` explícita.
- [ ] Decisão registrada sobre `MEETINGS_PROCESSING_MODE` para o deploy alvo.
