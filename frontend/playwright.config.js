import { defineConfig, devices } from '@playwright/test';

// Smoke E2E against a running backend seeded with `seed_demo` (see README,
// "End-to-end smoke tests"). The Vite dev server is started here; the backend
// and the session cookie come from the environment:
//   E2E_SESSIONID  value printed by `manage.py seed_demo`
//   E2E_API_URL    backend API base (default http://localhost:8000/api)
const WEB_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.E2E_BROWSER_CHANNEL || undefined } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: process.env.E2E_API_URL || 'http://localhost:8000/api' },
  },
});
