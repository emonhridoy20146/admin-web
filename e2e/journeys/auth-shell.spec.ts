import { expect, test } from '@playwright/test';
import authBn from '../../src/features/auth/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import commonEn from '../../src/shared/i18n/common.en.json' with { type: 'json' };
import shellBn from '../../src/features/shell/i18n/bn.json' with { type: 'json' };
import dashEn from '../../src/features/dashboard/i18n/en.json' with { type: 'json' };
import { expectNoTokenInStorage, login, PASSWORD } from '../fixtures';

test('W-E1 super admin signs in and sees the overview with a branch switcher', async ({ page }) => {
  await login(page, 'admin');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: new RegExp(`^${shellBn.branch}:`) })).toBeVisible();
  await expectNoTokenInStorage(page);
});

test('W-E1 first sign-in forces a password change, then the overview loads with a fixed branch', async ({ page }) => {
  await login(page, 'newmanager');
  await expect(page).toHaveURL(/change-password/);
  await expect(page.getByText(authBn.changeForced)).toBeVisible();
  await page.locator('input[autocomplete=current-password]').fill(PASSWORD);
  await page.locator('input[autocomplete=new-password]').nth(0).fill('Barishal2026');
  await page.locator('input[autocomplete=new-password]').nth(1).fill('Barishal2026');
  await page.getByRole('button', { name: authBn.changeSubmit }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${shellBn.branch}:`) })).toHaveCount(0);
  await expect(page.getByTitle(shellBn.branchFixed)).toBeVisible();
  await expectNoTokenInStorage(page);
});

test('wrong password shows an error and stays on login', async ({ page }) => {
  await page.goto('/login/');
  await page.getByLabel(authBn.username).fill('admin');
  await page.locator('input[autocomplete=current-password]').fill('nope-nope');
  await page.getByRole('button', { name: authBn.submit }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/login/);
});

test('W-E14 language, digits and theme persist across reload', async ({ page }) => {
  await login(page, 'admin');
  const menu = page.locator('header').getByRole('button').last();
  await menu.click();
  await page.getByRole('menuitem', { name: commonBn.user.english }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('nav').first()).toContainText(dashEn.title);
  await menu.click();
  await page.getByRole('button', { name: commonEn.user.dark }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('nav').first()).toContainText(dashEn.title);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('security headers: CSP without unsafe-inline scripts', async ({ request }) => {
  const res = await request.get('/login/');
  const csp = res.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/script-src 'self'( 'sha256-[^']+')+;/);
  expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
});
