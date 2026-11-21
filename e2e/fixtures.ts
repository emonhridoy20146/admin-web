import { expect, type Page } from '@playwright/test';
import authBn from '../src/features/auth/i18n/bn.json' with { type: 'json' };

export const PASSWORD = 'Demo@2026';

/** Signs in with a demo account (mock mode) and waits for the shell. */
export async function login(page: Page, username = 'admin', password = PASSWORD) {
  await page.goto('/login/');
  await page.getByLabel(authBn.username).fill(username);
  await page.locator('input[autocomplete=current-password]').fill(password);
  await page.getByRole('button', { name: authBn.submit }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** Client-side navigation through the sidebar keeps the in-browser mock database (a full reload re-seeds it). */
export async function nav(page: Page, name: string | RegExp) {
  const menu = page.getByRole('navigation').first();
  // the whole label, optionally followed by its count ("ইনবক্স ১২"), so "কর্মী" does not also match "কর্মীদের কাজ"
  const exact = typeof name === 'string' ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( [০-৯0-9,]+)?$`) : name;
  await menu.getByRole('link', { name: exact }).first().click();
  if (typeof name === 'string') await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
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
