# Testes de carga (k6)

Scripts de carga leves para o backend Agenda-Juri. Requerem o
[k6](https://k6.io/docs/get-started/installation/) instalado (binário externo,
sem dependência Python).

## Cenários

| Script | Cenário | Carga | Objetivo |
|--------|---------|-------|----------|
| `smoke.js` | Smoke | 1 VU, 30s | Sanidade — endpoints respondem |
| `load.js` | Carga moderada | rampa até 20 VUs por ~2min | Comportamento sob uso normal |
| `load.js` | Pico | rampa até 50 VUs por ~50s | Resiliência sob pico curto |

## Rotas exercitadas

- `/health/` e `/ready/` — públicas, sem autenticação.
- `/api/painel/` e `/api/clientes/` — autenticadas; só rodam quando
  `SESSION_COOKIE` é fornecido.

## Comandos

```bash
# Smoke
k6 run -e BASE_URL=http://localhost:8000 loadtest/smoke.js

# Carga + pico (rotas públicas)
k6 run -e BASE_URL=http://localhost:8000 loadtest/load.js

# Incluindo rotas autenticadas
k6 run -e BASE_URL=http://localhost:8000 -e SESSION_COOKIE="sessionid=<valor>" loadtest/load.js
```

## Obtendo o SESSION_COOKIE

1. Faça login no app no navegador.
2. DevTools → Application → Cookies → copie o valor de `sessionid`.
3. Passe como `-e SESSION_COOKIE="sessionid=<valor>"`.

## Métricas e limiares

- `http_req_failed < 1%` (taxa de erro).
- `ready` p95 < 800ms; `painel` p95 < 1500ms (dump completo — mais pesado).
- Acompanhe também throughput (`http_reqs`) e timeouts no resumo do k6.

> Ajuste os limiares conforme a infraestrutura alvo. Rode contra um ambiente de
> staging, **nunca** contra produção com dados reais.
