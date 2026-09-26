import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const config = {
  backend_mode: 'always-on',
  billing_configured: false,
  backends: [
    {
      id: 'autoscale',
      label: 'Autoscale',
      url: 'https://autoscale.example.test',
      enabled: true,
      min_replicas: 0,
      max_replicas: 3,
    },
    {
      id: 'always-on',
      label: 'Always-on',
      url: 'https://always-on.example.test',
      enabled: true,
      min_replicas: 1,
      max_replicas: 1,
    },
  ],
  models: [
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', enabled: true },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna', enabled: true },
  ],
};
const empty = {
  status: 'not_configured',
  source: 'Azure Cost Management',
  start_date: '2026-08-27',
  end_date: '2026-09-25',
  fetched_at: null,
  currency: null,
  configured_categories: [],
  totals: {},
  daily: [],
};

async function setup(page: Page) {
  await page.route('**/api/config', (route) => route.fulfill({ json: config }));
  await page.route('**/api/costs?*', (route) => route.fulfill({ json: empty }));
}

test('routes model and backend independently, retains history and records measurements', async ({
  page,
}) => {
  await setup(page);
  const requests: { url: string; body: { backend: string; model: string; messages: unknown[] } }[] =
    [];
  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON();
    requests.push({ url: route.request().url(), body });
    await route.fulfill({
      json: {
        reply: 'Hello from the selected model.',
        backend: body.backend,
        model: body.model,
        input_tokens: 15,
        output_tokens: 7,
        cached_tokens: 0,
        duration_ms: 80,
        request_id: `request-${requests.length}`,
        truncated: false,
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Autoscale' }).click();
  await page.getByRole('button', { name: 'GPT-6 Luna' }).click();
  await page.getByRole('textbox', { name: 'Message' }).fill('Hello');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Hello from the selected model.')).toBeVisible();
  expect(requests[0].url).toBe('https://autoscale.example.test/api/chat');
  expect(requests[0].body).toMatchObject({ model: 'gpt-6-luna', backend: 'autoscale' });
  await page.getByRole('textbox', { name: 'Message' }).fill('And then?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Hello from the selected model.')).toHaveCount(2);
  expect(requests[1].body.messages).toHaveLength(3);
  await page.getByRole('link', { name: 'Cost explorer' }).click();
  await expect(page.getByText('2 requests', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export session' })).toBeEnabled();
  await page.getByRole('link', { name: 'Chat playground' }).click();
  await expect(page.getByText('Hello from the selected model.')).toHaveCount(2);
});

test('shows disconnected billing without fabricated prices', async ({ page }) => {
  await setup(page);
  await page.goto('/costs');
  await expect(page.getByText('Billing not connected', { exact: true })).toBeVisible();
  await expect(page.getByText('Real billing data only. No sample numbers.')).toBeVisible();
  await expect(page.getByTestId('tracked-resource-spend').locator('strong')).toHaveText('—');
  await page.screenshot({ path: '/tmp/ecocompute-costs-empty.png', fullPage: true });
});

test('renders actual cost charts and accessible daily data', async ({ page }) => {
  await setup(page);
  await page.route('**/api/costs?*', (route) =>
    route.fulfill({
      json: {
        ...empty,
        status: 'ready',
        currency: 'USD',
        fetched_at: '2026-09-26T09:00:00Z',
        configured_categories: ['autoscale', 'always-on', 'foundry', 'shared'],
        totals: { autoscale: 2.4, 'always-on': 8.7, foundry: 4.3, shared: 1.6 },
        daily: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-09-${19 + i}`,
          autoscale: [0, 0.1, 0.8, 0.2, 0.3, 0.4, 0.6][i],
          always_on: [1.2, 1.3, 1.1, 1.4, 1.2, 1.3, 1.2][i],
          foundry: [0.1, 0.3, 1.2, 0.4, 0.8, 0.6, 0.9][i],
          shared: 1.6 / 7,
        })),
      },
    }),
  );
  await page.goto('/costs');
  await expect(page.getByRole('img', { name: 'Daily Azure-reported costs' })).toBeVisible();
  await expect(page.getByTestId('tracked-resource-spend').locator('strong')).toContainText('17.00');
  await page.getByText('View daily billing data').click();
  await expect(page.getByRole('cell', { name: '2026-09-19', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/ecocompute-costs-populated.png', fullPage: true });
});

test('recovers a failed prompt and disables unconfigured models', async ({ page }) => {
  await setup(page);
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: { ...config, models: [config.models[0], { ...config.models[1], enabled: false }] },
    }),
  );
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 429, json: { detail: 'Foundry is rate limited.' } }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: /GPT-6 Luna/ })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Message' }).fill('Keep my draft');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('alert')).toHaveText('Foundry is rate limited.');
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue('Keep my draft');
});

test('mobile layout fits the viewport', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Let’s start a conversation.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/ecocompute-chat-mobile.png', fullPage: true });
});

test('desktop playground visual check', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Let’s start a conversation.' })).toBeVisible();
  await page.screenshot({ path: '/tmp/ecocompute-chat-desktop.png', fullPage: true });
});
