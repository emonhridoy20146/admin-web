import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import usersBn from '../../src/features/admin-users/i18n/bn.json' with { type: 'json' };
import repBn from '../../src/features/reports/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import shellBn from '../../src/features/shell/i18n/bn.json' with { type: 'json' };
import { labelRe, login, nav, pickRange, S, submenu, tab } from '../fixtures';

/**
 * FR-W-075 / ADR-W32 (owner request 2026-11-27): the sidebar's sections fold open into submenus of their pages (like
 * dec58c6); the tab strip above the page is gone. Every page keeps its own URL, so old links, ⌘K and shortcuts still
 * open the same page, and the section holding it is unfolded with the page highlighted.
 */
const heading = (page: Page, section: string) => page.getByRole('navigation').first().getByRole('button', { name: labelRe(section) });

async function axeClean(page: Page, include: string) {
  const r = await new AxeBuilder({ page }).include(include).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
}

test('the sidebar shows the sections as submenus; a heading folds its pages; no tab strip above the page', async ({ page }) => {
  await login(page);
  const menu = page.getByRole('navigation').first();
  // six foldable sections (Inbox, Customers, Collections, Field work, Staff, Admin); Overview and Reports are plain items
  for (const sec of [S.inbox, S.customers, S.collections, S.field, S.staff, S.admin]) await expect(heading(page, sec)).toHaveAttribute('aria-expanded', 'true');
  await expect(heading(page, S.reports)).toHaveCount(0);
  await expect(menu.getByRole('link', { name: labelRe(S.reports) })).toBeVisible();
  await expect(page.getByTestId('section-tabs')).toHaveCount(0);

  await nav(page, colBn.conflicts, S.collections);
  await expect(page).toHaveURL(/\/collections\/conflicts\/$/);
  const cols = submenu(menu, S.collections);
  await expect(cols.getByRole('link', { name: labelRe(colBn.conflicts) })).toHaveAttribute('aria-current', 'page');
  await expect(cols.locator('[aria-current=page]')).toHaveCount(1);

  // fold Customers: its pages hide, the choice survives a reload (kept in the browser)
  await heading(page, S.customers).click();
  await expect(heading(page, S.customers)).toHaveAttribute('aria-expanded', 'false');
  await expect(submenu(menu, S.customers)).toBeHidden();
  // the section holding the open page cannot hide it
  await heading(page, S.collections).click();
  await expect(heading(page, S.collections)).toHaveAttribute('aria-expanded', 'true');
  await expect(cols.getByRole('link', { name: labelRe(colBn.conflicts) })).toBeVisible();
  await page.reload();
  await expect(heading(page, S.customers)).toHaveAttribute('aria-expanded', 'false');
  await heading(page, S.customers).click();
  await expect(submenu(menu, S.customers).getByRole('link', { name: labelRe(custBn.title) })).toBeVisible();

  await tab(page, cashBn.title);
  await expect(page).toHaveURL(/\/cash\/$/);
  await nav(page, repBn.title);
  await expect(menu.getByRole('link', { name: labelRe(S.reports) })).toHaveAttribute('aria-current', 'page');
});

test('opening a page of a folded section unfolds it, also from a link outside the sidebar', async ({ page }) => {
  await login(page);
  await heading(page, S.admin).click();
  await expect(heading(page, S.admin)).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('combobox').fill(usersBn.title);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(usersBn.title);
  await expect(heading(page, S.admin)).toHaveAttribute('aria-expanded', 'true');
  await expect(submenu(page.getByRole('navigation').first(), S.admin).getByRole('link', { name: labelRe(usersBn.title) })).toHaveAttribute('aria-current', 'page');
});

test('a page reopens from the submenu with the filters it was left with', async ({ page }) => {
  await login(page);
  await nav(page, colBn.title, S.collections);
  await pickRange(page, commonBn.range['7d']);
  await expect(page).toHaveURL(/range=7d/);
  await tab(page, colBn.conflicts);
  await tab(page, colBn.title);
  await expect(page).toHaveURL(/\/collections\/\?range=7d$/);
  await expect(page.getByTestId('date-range')).toContainText(commonBn.range['7d']);
});

test('old links open their page with its section unfolded and the page highlighted; a page below highlights its parent', async ({ page }) => {
  await login(page);
  const menu = page.getByRole('navigation').first();
  await page.goto('/map/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(custBn.map.title);
  await expect(heading(page, S.customers)).toHaveAttribute('aria-expanded', 'true');
  await expect(submenu(menu, S.customers).getByRole('link', { name: labelRe(custBn.map.title) })).toHaveAttribute('aria-current', 'page');

  await page.goto('/admin/users/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(usersBn.title);
  await expect(submenu(menu, S.admin).getByRole('link', { name: labelRe(usersBn.title) })).toHaveAttribute('aria-current', 'page');

  // a customer's own page: the Customers page is highlighted in its submenu
  await nav(page, custBn.title, S.customers);
  await expect(page.locator('main tbody tr a').first()).toBeVisible();
  await page.locator('main tbody tr').first().click();
  await page.getByRole('dialog').getByRole('link', { name: custBn.openFull }).click();
  await expect(page).toHaveURL(/\/customers\/[^/?]+\/$/);
  await expect(submenu(menu, S.customers).getByRole('link', { name: labelRe(custBn.title) })).toHaveAttribute('aria-current', 'page');
});

test('⌘K still opens a page by name, and a section by its name; keyboard folds a section', async ({ page }) => {
  await login(page);
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('combobox').fill(colBn.conflicts);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/collections\/conflicts\/?$/);
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('combobox').fill(S.admin);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(usersBn.title);

  await heading(page, S.staff).focus();
  await page.keyboard.press('Enter');
  await expect(heading(page, S.staff)).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(heading(page, S.staff)).toHaveAttribute('aria-expanded', 'true');
});

test('at 1440 px the sidebar is axe clean; the icon-only sidebar lists every page with no headings', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/collections/');
  await expect(heading(page, S.collections)).toBeVisible();
  await axeClean(page, 'aside nav');
  await page.getByRole('button', { name: commonBn.nav.collapse }).click();
  const menu = page.getByRole('navigation').first();
  await expect(heading(page, S.collections)).toBeHidden();
  await expect(menu.locator('[aria-current=page]')).toBeVisible();
  await expect(submenu(menu, S.admin).getByRole('link').first()).toBeVisible();
  await axeClean(page, 'aside nav');
  await page.getByRole('button', { name: commonBn.nav.expand }).click();
});

test.describe('at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('the phone menu shows the same submenus, ≥ 44 px targets on touch, closes on a tap, axe clean', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page);
    await page.goto('/data-quality/');
    await page.getByRole('button', { name: shellBn.openMenu }).click();
    const menu = page.getByRole('dialog');
    const reports = menu.getByRole('link', { name: labelRe(S.reports) });
    await expect(reports).toBeVisible();
    const cust = menu.getByRole('button', { name: labelRe(S.customers) });
    await expect(cust).toHaveAttribute('aria-expanded', 'true');
    const current = submenu(menu, S.customers).locator('[aria-current=page]');
    await expect(current).toBeVisible();
    expect((await current.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await cust.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await menu.getByRole('button', { name: labelRe(S.staff) }).click();
    await expect(menu.getByRole('button', { name: labelRe(S.staff) })).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeVisible(); // a heading does not close the menu
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await axeClean(page, '[role=dialog]');
    // tapping the open page closes the menu (FR-W-069 fix kept)
    await current.click();
    await expect(menu).toBeHidden();
    await expect(page.getByTestId('section-tabs')).toHaveCount(0);
  });
});
