import { expect, test } from '@playwright/test';

const sessionid = process.env.E2E_SESSIONID;

test.beforeEach(async ({ context, page }) => {
  expect(sessionid, 'set E2E_SESSIONID to the cookie printed by seed_demo').toBeTruthy();
  await context.addCookies([{ name: 'sessionid', value: sessionid, domain: 'localhost', path: '/' }]);
  // Mark the first-visit guided tour as done so it does not cover the UI under test.
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function patched(key) {
      return String(key).startsWith('onboarding:')
        ? JSON.stringify({ completed: true, dismissed: true, lastStep: 0 })
        : getItem.call(this, key);
    };
  });
});

test('seed_demo session opens the app without redirecting to login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Prazos' }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/login/);
});

test('editing a process shows the success toast', async ({ page }) => {
  await page.goto('/processos');
  await page.getByRole('link', { name: 'Editar' }).first().click();
  await expect(page.getByRole('heading', { name: 'Editar processo' })).toBeVisible();

  await page.getByLabel('Descrição').fill(`Editado pelo smoke E2E ${Date.now()}`);
  await page.getByRole('button', { name: 'Atualizar' }).click();

  await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();
  await expect(page).toHaveURL(/\/processos\/[^/]+$/);
});

test('moving a deadline card between kanban columns persists', async ({ page }) => {
  await page.goto('/prazos');
  const board = page.getByLabel('Kanban de prazos fatais');
  const countOf = async (name) =>
    Number(await board.locator('section', { has: page.getByRole('heading', { name, exact: true }) }).locator('.deadline-column-count').first().innerText());

  const pending = board.locator('section', { has: page.getByRole('heading', { name: 'Pendente', exact: true }) });
  const target = board.locator('section', { has: page.getByRole('heading', { name: 'Em andamento', exact: true }) });
  const before = { pending: await countOf('Pendente'), target: await countOf('Em andamento') };

  await pending.locator('.deadline-card').first().dragTo(target);

  await expect.poll(() => countOf('Em andamento')).toBe(before.target + 1);
  expect(await countOf('Pendente')).toBe(before.pending - 1);

  await page.reload();
  await expect.poll(() => countOf('Em andamento')).toBe(before.target + 1);
});

test('global search (Ctrl+K) opens a client', async ({ page }) => {
  await page.goto('/');
  // Wait for the store to finish loading: the search only indexes loaded records.
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Busca global')).toBeVisible();
  await page.keyboard.press('Control+K');
  await expect(page.getByLabel('Busca global')).toBeFocused();
  await page.keyboard.type('Horizonte');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/clientes\/[^/]+$/);
});

test.describe('no horizontal overflow at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const routes = [
    '/', '/clientes', '/processos', '/agenda', '/prazos', '/peticoes-contestacoes',
    '/reunioes', '/produtividade', '/prospeccao', '/financeiro', '/auditoria',
    '/usuarios', '/configuracoes',
  ];

  for (const route of routes) {
    test(route, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  }
});
