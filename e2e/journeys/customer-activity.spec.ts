import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import { login, nav } from '../fixtures';

// Owner request 2026-11-21 (contract 1.24.0, FR-W-037/038, master FR-CUS-017/018): every customer row says what was
// done this month (visit, money, promise) and whether the pin is set, in every filter; the header counts invoices;
// the customer drawer and page show "this month".

const KINDS = ['visit', 'paid', 'promise', 'pin'];

test('customer list: four work marks on every row in every filter, a key for them, and the invoice count in the header', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.title);
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  const legend = page.getByTestId('work-marks-legend');
  for (const k of ['visit', 'paid', 'promise', 'pin'] as const) await expect(legend.getByText(custBn.marks.legend[k], { exact: true })).toBeVisible();

  const check = async () => {
    await expect(async () => {
      const rows = page.locator('tbody tr');
      const n = await rows.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < Math.min(n, 8); i++) {
        const marks = rows.nth(i).getByTestId('work-marks').locator('[data-mark]');
        expect(await marks.evaluateAll((els) => els.map((e) => e.getAttribute('data-mark')))).toEqual(KINDS);
        // every mark says what it means in words, not by colour alone
        for (const t of await marks.locator('.sr-only').allTextContents()) expect(t.trim().length).toBeGreaterThan(3);
      }
    }).toPass({ timeout: 15_000 });
  };
  await check();
  await expect(page.getByTestId('invoice-totals')).toContainText(/ইনভয়েস [০-৯,]+টি · বাকি আছে [০-৯,]+টি/);

  // another filter: the marks are still there
  await page.getByRole('button', { name: custBn.filters.no_location, exact: true }).click();
  await expect(page).toHaveURL(/filter=no_location/);
  await expect(async () => {
    const first = page.locator('tbody tr').first().locator('[data-mark=pin] .sr-only');
    await expect(first).toHaveText(custBn.marks.pinMissing, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await check();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});

test('customer drawer and page: "this month" with visits, ERP money, pending money apart, promises and the invoice count', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.title);
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  await page.locator('tbody tr').first().click();
  const drawer = page.getByRole('dialog');
  const block = drawer.getByTestId('month-activity');
  await expect(block).toBeVisible();
  for (const k of ['visits', 'paid', 'pending', 'promises'] as const) await expect(block.getByText(custBn.month[k], { exact: true })).toBeVisible();
  await expect(block).toContainText(/মোট ইনভয়েস [০-৯]+টি · বাকি আছে [০-৯]+টি/);
  expect((await new AxeBuilder({ page }).include('[data-testid=month-activity]').analyze()).violations).toEqual([]);
});

// Owner request 2026-11-21 (contract 1.29.0, FR-W-047, master FR-CUS-019): who paid something this month and who did not.
test('customer list: "paid this month" / "not paid this month" split the list and agree with the money mark on every row', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.title);
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  const group = page.getByRole('group', { name: custBn.paidMonth.label });
  await expect(group).toBeVisible();

  const marksOfRows = async () => {
    const rows = page.locator('tbody tr');
    const n = await rows.count();
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push((await rows.nth(i).locator('[data-mark=paid] .sr-only').textContent())?.trim() ?? '');
    return out;
  };

  await group.getByRole('button', { name: custBn.paidMonth.no, exact: true }).click();
  await expect(page).toHaveURL(/paid=no/);
  await expect(async () => {
    const marks = await marksOfRows();
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) expect(m).toBe(custBn.marks.paidNone);
  }).toPass({ timeout: 15_000 });

  await group.getByRole('button', { name: custBn.paidMonth.yes, exact: true }).click();
  await expect(page).toHaveURL(/paid=yes/);
  await expect(async () => {
    const marks = await marksOfRows();
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) expect(m).not.toBe(custBn.marks.paidNone);
  }).toPass({ timeout: 15_000 });

  // the control prints and reads as words, and the page stays accessible with it
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await group.getByRole('button', { name: custBn.paidMonth.all, exact: true }).click();
  await expect(page).not.toHaveURL(/paid=/);
});
