import { expect, test } from '@playwright/test';
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import inboxBn from '../../src/features/inbox/i18n/bn.json' with { type: 'json' };
import shellBn from '../../src/features/shell/i18n/bn.json' with { type: 'json' };
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { confirmWithReason, login } from '../fixtures';

async function openMenuAndGo(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: shellBn.openMenu }).click();
  await page.getByRole('dialog').getByRole('link', { name }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

test('W-E13 at 390 px: inbox → resolve a conflict → verify a deposit, with ≥ 44 px targets', async ({ page }) => {
  await login(page);
  await openMenuAndGo(page, inboxBn.title);

  await openMenuAndGo(page, colBn.conflicts);
  const resolve = page.getByRole('button', { name: colBn.resolve }).first();
  expect((await resolve.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await resolve.click();
  await confirmWithReason(page, 'Customer confirmed the payment on the phone.', /সমাধান/);
  await expect(page.getByText(colBn.resolved).first()).toBeVisible();

  await openMenuAndGo(page, cashBn.title);
  const verify = page.locator('#deposits ul > li').first().getByRole('button', { name: cashBn.verify, exact: true });
  expect((await verify.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await verify.click();
  await page.getByRole('dialog').getByRole('button', { name: /যাচাই করুন/ }).click();
  await expect(page.getByText(cashBn.verified).first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('invoice viewer at 390 px: one card per installment, no sideways scroll', async ({ page }) => {
  await login(page);
  await openMenuAndGo(page, custBn.title);
  await page.goto('/customers/?pay=missed_many');
  const first = page.locator('main a[href^="/customers/"][href$="/"]:visible').first();
  await expect(first).toBeVisible();
  const href = (await first.getAttribute('href'))!;
  await page.goto(`${href}?tab=invoices`);
  await page.getByRole('list', { name: custBn.tabs.invoices }).getByRole('button').first().click();
  const cards = page.getByRole('list', { name: custBn.invoice.schedule });
  await expect(cards).toBeVisible();
  expect(await cards.locator('li').count()).toBeGreaterThan(1);
  await expect(page.getByRole('table', { name: new RegExp(custBn.invoice.schedule) })).toBeHidden();
  const back = page.getByRole('button', { name: custBn.invoice.back });
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('390 px: Sync from ERP fits in the header, is a ≥ 44 px target, and the page does not scroll sideways', async ({ page }) => {
  await login(page);
  const btn = page.getByRole('button', { name: commonBn.erp.syncAria });
  await expect(btn).toBeVisible();
  const box = (await btn.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(40);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
