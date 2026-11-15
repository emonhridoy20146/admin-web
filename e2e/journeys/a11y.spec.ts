import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from '../fixtures';

const PAGES = ['/', '/handovers/', '/inbox/', '/customers/', '/collections/', '/collections/conflicts/', '/cash/', '/admin/users/', '/admin/permissions/', '/admin/settings/', '/admin/flags/', '/admin/audit/'];

test('login page has no serious axe violations', async ({ page }) => {
  await page.goto('/login/');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test('main pages have no serious axe violations', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const found: string[] = [];
  for (const path of PAGES) {
    // client-side navigation keeps the session; reloads restore it from the mock session too
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    for (const v of r.violations) if (v.impact === 'serious' || v.impact === 'critical') found.push(`${path} ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`);
  }
  expect(found).toEqual([]);
});
