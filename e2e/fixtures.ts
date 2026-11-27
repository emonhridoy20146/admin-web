import { expect, type Locator, type Page } from '@playwright/test';
import authBn from '../src/features/auth/i18n/bn.json' with { type: 'json' };
import shellBn from '../src/features/shell/i18n/bn.json' with { type: 'json' };

/** Sidebar section names (FR-W-069, FR-W-075), Bangla: `nav(page, pageName, S.customers)`. */
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
export function labelRe(name: string | RegExp) {
  return typeof name === 'string' ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( [০-৯0-9,]+)?$`) : name;
}

/** The submenu (list of pages) of a sidebar section (FR-W-075), by its Bangla section name. */
export function submenu(root: Locator, section: string) {
  return root.getByRole('list', { name: shellBn.sections.tabs.replace('{{section}}', section), exact: true });
}

/** Unfolds a sidebar section's submenu if it is folded (FR-W-075). Single-page sections have no heading. */
export async function unfold(scope: Locator, section: string) {
  const heading = scope.getByRole('button', { name: labelRe(section) });
  if ((await heading.count()) && (await heading.getAttribute('aria-expanded')) === 'false') await heading.click();
}

/**
 * Client-side navigation through the sidebar keeps the in-browser mock database (a full reload re-seeds it).
 * FR-W-075: most pages sit in a sidebar section's submenu; pass the section (`S.customers`) to unfold it first if it
 * is folded. Without a section, `name` is a page link anywhere in the sidebar.
 */
export async function nav(page: Page, name: string | RegExp, section?: string) {
  const menu = page.getByRole('navigation').first();
  if (section) await unfold(menu, section);
  const scope = section && (await submenu(menu, section).count()) ? submenu(menu, section) : menu;
  await scope.getByRole('link', { name: labelRe(name) }).first().click();
  if (typeof name === 'string') await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

/** Opens another page from the sidebar (FR-W-075: pages of a section are its submenu items). */
export async function tab(page: Page, name: string) {
  await page.getByRole('navigation').first().getByRole('link', { name: labelRe(name) }).first().click();
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
