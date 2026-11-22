import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import inboxBn from '../../src/features/inbox/i18n/bn.json' with { type: 'json' };
import usersBn from '../../src/features/admin-users/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { login, nav } from '../fixtures';

// Owner request 2026-11-22 (contract 1.35.0, FR-W-053, master FR-CASH-010, ADR-049): a collection goes to the ERP when
// the collector deposits it; a deposit is final. The office only reads what each deposit contained.

test('deposits are final: no verify, reject or delete; a deposit shows its collections with method, ERP state and totals', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, cashBn.title);
  // the list opens on the deposits made since 1.35.0, each "Deposited"
  const tabs = page.getByRole('group', { name: cashBn.deposits });
  await expect(tabs.getByRole('button', { name: cashBn.depositTab.submitted, exact: true })).toHaveAttribute('aria-pressed', 'true');
  const row = page.locator('#deposits tbody tr').first();
  await expect(row).toContainText('৳');
  await expect(row).toContainText(commonBn.status.submitted);
  // nothing on the page asks the office to decide a deposit
  await expect(page.getByRole('button', { name: /যাচাই|প্রত্যাখ্যান|জমা মুছুন/ })).toHaveCount(0);

  await row.locator('td').nth(1).click();
  await expect(page).toHaveURL(/dep=/);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(cashBn.depositDetail.subtitleFinal)).toBeVisible();
  await expect(drawer.getByTestId('deposit-head')).toContainText(commonBn.status.submitted);
  await expect(drawer.getByText(cashBn.depositDetail.finalNote)).toBeVisible();
  // totals: cash, non-cash, count, then the same money by ERP state (field money is never shown as in the ERP)
  await expect(drawer.getByTestId('deposit-cash')).toContainText('৳');
  await expect(drawer.getByTestId('deposit-noncash')).toContainText('৳');
  await expect(drawer.getByTestId('deposit-count')).not.toBeEmpty();
  await expect(drawer.getByTestId('deposit-erp')).toContainText(cashBn.depositDetail.inErp);
  await expect(drawer.getByTestId('deposit-erp')).toContainText(cashBn.depositDetail.onTheWay);
  const lines = drawer.getByTestId('cash-line');
  await expect(lines.first()).toBeVisible();
  const n = await lines.count();
  const methods = Object.values(commonBn.method);
  for (let i = 0; i < n; i++) {
    const line = lines.nth(i);
    await expect(line.getByRole('link')).toHaveAttribute('href', /\/customers\/.+\//);
    await expect(line).toContainText(new RegExp(methods.join('|')));
    // an ERP receipt number once posted, else "not in the ERP yet"
    await expect(line.getByTestId('cash-line-erp')).toContainText(new RegExp(`${cashBn.erpLine.receipt}|${cashBn.erpLine.notYet}`));
  }
  await expect(drawer.getByRole('button', { name: /মুছুন|যাচাই/ })).toHaveCount(0);
  const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/dep=/);
});

test('older deposits keep their status and the oldest-first view of the cash they covered', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, cashBn.title);
  await page.getByRole('group', { name: cashBn.deposits }).getByRole('button', { name: cashBn.depositTab.all, exact: true }).click();
  await expect(page).toHaveURL(/deposits=all/);
  const old = page.locator('#deposits tbody tr').filter({ hasText: commonBn.status.verified }).first();
  await expect(old).toContainText('৳');
  await old.locator('td').nth(1).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(cashBn.depositDetail.subtitle)).toBeVisible();
  await expect(drawer.getByText(cashBn.depositDetail.covered, { exact: true })).toBeVisible();
  await expect(drawer.getByText(cashBn.depositDetail.unmatched, { exact: true })).toBeVisible();
  await expect(drawer.getByText(cashBn.depositDetail.how)).toBeVisible();
  const lines = drawer.getByTestId('cash-line');
  const n = await lines.count();
  // every line says in words whether a promise stood behind the money
  for (let i = 0; i < n; i++) await expect(lines.nth(i).getByTestId('cash-line-promise')).not.toBeEmpty();
  await expect(drawer.getByRole('button', { name: /মুছুন|যাচাই/ })).toHaveCount(0);
});

test('the KPI counts today\'s deposits; an old "deposit to verify" reminder in the inbox has no action link', async ({ page }) => {
  await login(page);
  await nav(page, cashBn.title);
  await expect(page.getByText(cashBn.kpi.depositedToday)).toBeVisible();
  await expect(page.getByText(/যাচাই বাকি/)).toHaveCount(0);

  await nav(page, inboxBn.title);
  const retired = page.locator('main li').filter({ hasText: inboxBn.retired.deposit });
  await expect(retired.first()).toBeVisible();
  await expect(retired.first().getByRole('link')).toHaveCount(0);
});

test('a collector without an ERP employee link carries a warning on the users list and in the drawer', async ({ page }) => {
  await login(page);
  await nav(page, usersBn.title);
  const badge = page.getByTestId('erp-link-missing');
  // the one unlinked collector may be on a later page
  for (let i = 0; i < 8 && !(await badge.first().isVisible()); i++) {
    await expect(page.locator('tbody tr').first()).toBeVisible();
    if (await badge.first().isVisible()) break;
    const next = page.getByRole('button', { name: commonBn.table.next });
    if (await next.isDisabled()) break;
    await next.click();
    await page.waitForTimeout(400);
  }
  await expect(badge.first()).toContainText(usersBn.erpLinkMissingShort);
  await badge.first().locator('xpath=ancestor::tr').locator('td').first().click();
  await expect(page.getByRole('dialog').getByTestId('erp-link-missing')).toHaveText(usersBn.erpLinkMissing);
});
