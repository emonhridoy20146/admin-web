import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import usersBn from '../../src/features/admin-users/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { login, nav, pickRange, S, tab } from '../fixtures';

/**
 * FR-W-069 / ADR-W28 (owner request 2026-11-24, item C): 8 sidebar items; related pages are tabs of a section; every
 * tab keeps its own URL, so old links open the same page inside its section.
 */
test('sidebar has 8–12 items; a section opens its first tab and its tabs switch pages', async ({ page }) => {
  await login(page);
  const menu = page.getByRole('navigation').first();
  const n = await menu.getByRole('link').count();
  expect(n).toBeGreaterThanOrEqual(8);
  expect(n).toBeLessThanOrEqual(12);

  await nav(page, S.collections);
  await expect(page).toHaveURL(/\/collections\/$/);
  await expect(menu.getByRole('link', { name: new RegExp(`^${S.collections}`) })).toHaveAttribute('aria-current', 'page');
  const tabs = page.getByTestId('section-tabs');
  await expect(tabs.getByRole('link', { name: new RegExp(`^${colBn.title}`) })).toHaveAttribute('aria-current', 'page');

  await tab(page, colBn.conflicts);
  await expect(page).toHaveURL(/\/collections\/conflicts\/$/);
  await expect(menu.getByRole('link', { name: new RegExp(`^${S.collections}`) })).toHaveAttribute('aria-current', 'page');
  await tab(page, cashBn.title);
  await expect(page).toHaveURL(/\/cash\/$/);
});

test('a tab reopens with the filters it was left with', async ({ page }) => {
  await login(page);
  await nav(page, S.collections);
  await pickRange(page, commonBn.range['7d']);
  await expect(page).toHaveURL(/range=7d/);
  await tab(page, colBn.conflicts);
  await tab(page, colBn.title);
  await expect(page).toHaveURL(/\/collections\/\?range=7d$/);
  await expect(page.getByTestId('date-range')).toContainText(commonBn.range['7d']);
});

test('old links still open their page inside its section; a page below a tab has no strip', async ({ page }) => {
  await login(page);
  await page.goto('/map/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(custBn.map.title);
  const menu = page.getByRole('navigation').first();
  await expect(menu.getByRole('link', { name: new RegExp(`^${S.customers}`) })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('section-tabs').getByRole('link', { name: custBn.map.title })).toHaveAttribute('aria-current', 'page');

  await page.goto('/admin/users/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(usersBn.title);
  await expect(menu.getByRole('link', { name: new RegExp(`^${S.admin}`) })).toHaveAttribute('aria-current', 'page');

  // a customer's own page: the Customers item is highlighted, the strip is not shown (the page has its own tabs)
  await nav(page, S.customers);
  await expect(page.locator('main tbody tr a').first()).toBeVisible();
  await page.locator('main tbody tr').first().click();
  await page.getByRole('dialog').getByRole('link', { name: custBn.openFull }).click();
  await expect(page).toHaveURL(/\/customers\/[^/?]+\/$/);
  await expect(page.getByTestId('section-tabs')).toHaveCount(0);
  await expect(menu.getByRole('link', { name: new RegExp(`^${S.customers}`) })).toHaveAttribute('aria-current', 'page');
});

test('⌘K still opens a tab page by name, and a section by its name', async ({ page }) => {
  await login(page);
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('combobox').fill(colBn.conflicts);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/collections\/conflicts\/?$/);
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('combobox').fill(S.admin);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(usersBn.title);
});

test.describe('at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('the tab strip scrolls sideways, keeps the open tab in view, ≥ 44 px targets on touch, axe clean', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page);
    await page.goto('/data-quality/');
    const tabs = page.getByTestId('section-tabs');
    const current = tabs.locator('[aria-current=page]');
    await expect(current).toBeInViewport();
    expect((await current.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const r = await new AxeBuilder({ page }).include('[data-testid=section-tabs]').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  });
});
