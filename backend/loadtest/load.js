// Teste de carga (k6): rampa moderada + pico.
// Uso básico (rotas públicas):
//   k6 run -e BASE_URL=http://localhost:8000 loadtest/load.js
// Incluir rota autenticada (dump do painel):
//   k6 run -e BASE_URL=http://localhost:8000 -e SESSION_COOKIE="sessionid=<valor>" loadtest/load.js
//
// Como obter o SESSION_COOKIE: faça login no app e copie o cookie `sessionid`
// do navegador (DevTools > Application > Cookies), ou via fluxo de auth da API.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const SESSION_COOKIE = __ENV.SESSION_COOKIE || "";

export const options = {
  scenarios: {
    carga_moderada: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    pico: {
      executor: "ramping-vus",
      startVUs: 0,
      startTime: "2m30s",
      stages: [
        { duration: "20s", target: 50 },
        { duration: "20s", target: 50 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:ready}": ["p(95)<800"],
    "http_req_duration{endpoint:painel}": ["p(95)<1500"],
  },
};

function authHeaders() {
  return SESSION_COOKIE ? { headers: { Cookie: SESSION_COOKIE } } : {};
}

export default function () {
  const ready = http.get(`${BASE_URL}/ready/`, { tags: { endpoint: "ready" } });
  check(ready, { "ready 200": (r) => r.status === 200 });

  if (SESSION_COOKIE) {
    const painel = http.get(`${BASE_URL}/api/painel/`, {
      ...authHeaders(),
      tags: { endpoint: "painel" },
    });
    check(painel, { "painel 200": (r) => r.status === 200 });

    const clientes = http.get(`${BASE_URL}/api/clientes/`, {
      ...authHeaders(),
      tags: { endpoint: "clientes" },
    });
    check(clientes, { "clientes 200": (r) => r.status === 200 });
  }

  sleep(1);
}
