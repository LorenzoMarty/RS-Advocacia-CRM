// Smoke test (k6): 1 VU, ~30s. Verifica que os endpoints essenciais respondem.
// Uso: k6 run -e BASE_URL=http://localhost:8000 loadtest/smoke.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health/`);
  check(health, {
    "health 200": (r) => r.status === 200,
    "health status ok": (r) => r.json("status") === "ok",
  });

  const ready = http.get(`${BASE_URL}/ready/`);
  check(ready, { "ready saudavel": (r) => r.status === 200 });

  sleep(1);
}
