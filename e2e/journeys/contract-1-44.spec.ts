import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import settingsBn from '../../src/features/admin-settings/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { login, nav } from '../fixtures';

// Contract 1.44.0 (field-api PR #40, ADR-057, FR-CUS-021, FR-ERP-008). Owner decision 2026-11-23: every ERP customer
// and every invoice, cash sales included, shows in the system; a cash sale is never due.

async function waitForRows(page: Page) {
  await expect(page.locator('tbody tr a').first()).toBeVisible();
}

test('cash sale: its own invoice kind, a neutral "নগদ বিক্রি" badge and nothing due, without a schedule', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await nav(page, custBn.title);
  await waitForRows(page);
  // the mock gives the open-credit customers cash sales too
  await page.getByRole('group', { name: custBn.invoiceKind.label }).getByRole('button', { name: custBn.invoiceKind.credit }).click();
  await expect(page).toHaveURL(/kind=credit/);
  // the list keeps the previous rows while the filtered page loads: wait for a row with an open credit invoice
  const credit = new RegExp(custBn.openInv.credit.replace('{{n}}', '[০-৯]+'));
  await expect(page.locator('tbody tr').first()).toContainText(credit, { timeout: 15_000 });
  await page.locator('tbody tr').first().click();
  await page.getByRole('dialog').getByRole('link', { name: custBn.openFull }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f]+\/$/);
  // the overview cards: a cash sale says nothing is due and is not "not collectable"
  await expect(page.getByText(custBn.kind.cash, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: custBn.invoice.openFull }).first().click();
  await page.getByRole('button', { name: custBn.invoice.back }).click();
  const tab = page.getByRole('tabpanel');
  await tab.getByRole('group', { name: custBn.invoiceKind.label }).getByRole('button', { name: new RegExp(custBn.invoiceKind.cash) }).click();
  await expect(page).toHaveURL(/invKind=cash/);
  const list = tab.getByRole('list', { name: custBn.tabs.invoices });
  await expect(list.getByRole('button')).toHaveCount(2);
  await expect(list.getByText(custBn.invoice.nothingDue)).toHaveCount(2);
  await list.getByRole('button').first().click();
  await expect(page.getByRole('heading', { level: 2, name: /^INV-S/ })).toBeVisible();
  await expect(page.getByTestId('cash-sale-badge')).toHaveText(custBn.invoice.kindCash);
  await expect(page.getByTestId('cash-sale-note')).toHaveText(custBn.invoice.cashNote);
  await expect(page.getByRole('table', { name: new RegExp(custBn.invoice.schedule) })).toHaveCount(0);
  await expect(page.getByText(custBn.invoice.terms)).toHaveCount(0);

  await page.waitForLoadState('networkidle');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});

test('who did it: the list names the last visitor, "this month" names who visited and who took the money', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.title);
  await waitForRows(page);
  const by = new RegExp(custBn.who.by.replace('{{name}}', '.+'));
  await expect(page.locator('tbody').getByText(by).first()).toBeVisible();

  // a row whose visit mark is on was visited this month: its drawer names who
  const visited = page.locator('tbody tr').filter({ has: page.locator('[data-mark=visit][data-on=true]') }).first();
  await visited.click();
  const block = page.getByRole('dialog').getByTestId('month-activity');
  await expect(block).toBeVisible();
  const who = block.getByTestId('month-visits').getByTestId('who-list');
  await expect(who).toBeVisible();
  await expect(who.locator('[data-who=person]').first()).not.toBeEmpty();
  // field money not in the ERP yet is labelled and listed apart from the ERP money
  const pendingWho = block.getByTestId('month-pending').getByTestId('who-list');
  if (await pendingWho.count()) await expect(pendingWho.getByText(custBn.who.notInErp).first()).toBeVisible();
  await expect(block.getByTestId('month-paid').getByText(custBn.who.notInErp)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[data-testid=month-activity]').analyze()).violations).toEqual([]);
});

test('settings: "Customers pulled from the ERP" is editable, every customer by default, in Bangla', async ({ page }) => {
  await login(page);
  await nav(page, settingsBn.title);
  const field = page.getByLabel(settingsBn.fields['erp.customerScope'].label);
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('all');
  await expect(field.locator('option')).toHaveText([settingsBn.enum.erpScopeAll, settingsBn.enum.erpScopeReceivables]);
  await expect(page.getByRole('heading', { level: 2, name: settingsBn.sections.erp.title })).toBeVisible();
});

test('Sync from ERP: calls until done and shows the skipped rows and failed branches', async ({ page }) => {
  await login(page);
  const btn = page.getByRole('button', { name: commonBn.erp.syncAria });
  await btn.click();
  // the mock's cut first call skipped one row; its last call had one failed branch
  await expect(page.getByText(commonBn.erp.syncSkipped.replace('{{n}}', '১'))).toBeVisible();
  await expect(page.getByText(commonBn.erp.syncFailedBranches.replace('{{n}}', '১'))).toBeVisible();
  await expect(btn).toBeEnabled();
});
