import { expect, type Page } from '@playwright/test';
import authBn from '../src/features/auth/i18n/bn.json' with { type: 'json' };
import shellBn from '../src/features/shell/i18n/bn.json' with { type: 'json' };

/** Sidebar section names (FR-W-069), Bangla: `nav(page, tabName, S.customers)`. */
export const S = shellBn.sections;

export const PASSWORD = 'Demo@2026';

/** Signs in with a demo account (mock mode) and waits for the shell. */
export async function login(page: Page, username = 'admin', password = PASSWORD) {
  await page.goto('/login/');
  await page.getByLabel(authBn.username).fill(username);
  await page.locator('input[autocomplete=current-password]').fill(password);
  await page.getByRole('button', { name: authBn.submit }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** The whole label, optionally followed by its count ("ইনবক্স ১২"), so "কর্মী" does not also match "কর্মীদের কাজ". */
function labelRe(name: string | RegExp) {
  return typeof name === 'string' ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( [০-৯0-9,]+)?$`) : name;
}

/**
 * Client-side navigation through the sidebar keeps the in-browser mock database (a full reload re-seeds it).
 * FR-W-069: most pages are tabs of a sidebar section; pass the section (`S.customers`) to open the section, then the
 * tab. Without a section, `name` is a sidebar item (a section opens on its first tab).
 */
export async function nav(page: Page, name: string | RegExp, section?: string) {
  const menu = page.getByRole('navigation').first();
  await menu.getByRole('link', { name: labelRe(section ?? name) }).first().click();
  if (section) await page.getByTestId('section-tabs').getByRole('link', { name: labelRe(name) }).first().click();
  if (typeof name === 'string') await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

/** Opens a tab of the current page's section (FR-W-069). */
export async function tab(page: Page, name: string) {
  await page.getByTestId('section-tabs').getByRole('link', { name: labelRe(name) }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

export async function expectNoTokenInStorage(page: Page) {
  const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(dump).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/); // no JWT
  expect(dump.toLowerCase()).not.toContain('accesstoken');
}

/** Fills the shared ReasonDialog and confirms with the given button label. */
export async function confirmWithReason(page: Page, reason: string, confirm: string | RegExp, opts: { double?: boolean } = {}) {
  const dialog = page.getByRole('dialog');
  await dialog.locator('textarea').fill(reason);
  const btn = dialog.getByRole('button', { name: confirm });
  if (opts.double) await btn.dblclick();
  else await btn.click();
  await expect(dialog).toBeHidden();
}

/** Picks a preset of the shared date filter (FR-W-063), by its Bangla label (e.g. commonBn.range['7d']). */
export async function pickRange(page: Page, label: string) {
  await page.getByTestId('date-range').click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await expect(page.getByTestId('date-range')).toContainText(label);
}
