import { expect, test } from '@playwright/test';
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import inboxBn from '../../src/features/inbox/i18n/bn.json' with { type: 'json' };
import shellBn from '../../src/features/shell/i18n/bn.json' with { type: 'json' };
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
