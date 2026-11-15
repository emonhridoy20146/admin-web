import { expect, test } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import tagsBn from '../../src/features/tags/i18n/bn.json' with { type: 'json' };
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import promisesBn from '../../src/features/promises/i18n/bn.json' with { type: 'json' };
import visitsBn from '../../src/features/visits/i18n/bn.json' with { type: 'json' };
import attendanceBn from '../../src/features/attendance/i18n/bn.json' with { type: 'json' };
import handoversBn from '../../src/features/handovers/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import type { Page } from '@playwright/test';
import { confirmWithReason, login, nav } from '../fixtures';

async function toggleChip(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true, pressed: false }).click();
  await expect(page.getByRole('button', { name, exact: true, pressed: true })).toBeVisible();
}

/** Waits for real rows (not skeletons), then opens the first one in the drawer. */
async function openFirstRow(page: Page) {
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('W-E3 customers: filter, sort, drawer and deep link restore the same state', async ({ page }) => {
  await login(page);
  await nav(page, custBn.title);
  await toggleChip(page, custBn.filters.overdue);
  await toggleChip(page, custBn.filters.bad_suggested);
  await page.getByRole('combobox').filter({ hasText: custBn.sort['-daysOverdue'] }).selectOption('-totalOutstanding');
  await expect(page).toHaveURL(/filter=overdue(%2C|,)bad_suggested/);
  await expect(page).toHaveURL(/sort=-totalOutstanding/);
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible();
  const name = (await firstRow.locator('a').first().innerText()).trim();
  await firstRow.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toContainText(name);
  await expect(page).toHaveURL(/drawer=customer%3A|drawer=customer:/);

  // copy-paste the URL: a fresh load must open the same filters, sort and drawer
  const deepLink = page.url();
  await page.goto(deepLink);
  await expect(page.getByRole('dialog')).toContainText(name);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: custBn.filters.overdue, exact: true, pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: custBn.filters.bad_suggested, exact: true, pressed: true })).toBeVisible();
});

test('W-E4 tag a customer with a reason; history shows the previous value', async ({ page }) => {
  await login(page);
  await nav(page, custBn.title);
  await toggleChip(page, custBn.filters.bad_suggested);
  await openFirstRow(page);
  await page.getByRole('dialog').getByRole('link', { name: custBn.openFull }).click();
  await page.getByRole('tab', { name: tagsBn.tab }).click();
  await page.getByRole('button', { name: tagsBn.tagAction }).click();
  await confirmWithReason(page, 'Plan ended four months ago and the customer refuses to pay.', tagsBn.tagAction);
  await expect(page.getByText(tagsBn.tagged).first()).toBeVisible();
  // history keeps the previous value ("no tag") next to the new one, with the reason
  const panel = page.getByRole('tabpanel');
  await expect(panel).toContainText(tagsBn.history);
  await expect(panel).toContainText(tagsBn.none);
  await expect(panel).toContainText('Plan ended four months ago');
});

test('W-E4 viewer cannot tag', async ({ page }) => {
  await login(page, 'viewer');
  await nav(page, custBn.title);
  await openFirstRow(page);
  await page.getByRole('dialog').getByRole('link', { name: custBn.openFull }).click();
  await page.getByRole('tab', { name: tagsBn.tab }).click();
  await expect(page.getByText(tagsBn.noPermission)).toBeVisible();
  await expect(page.getByRole('button', { name: tagsBn.tagAction })).toHaveCount(0);
});

test('W-E5 resolve a conflict to a plan; a double click resolves it once', async ({ page }) => {
  await login(page);
  await nav(page, colBn.conflicts);
  const cards = page.locator('main [aria-label="' + colBn.fieldRecord + '"]');
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  await page.getByRole('button', { name: colBn.resolve }).first().click();
  await confirmWithReason(page, 'Customer confirmed the payment on the phone.', /সমাধান/, { double: true });
  await expect(page.getByText(colBn.resolved).first()).toBeVisible();
  await expect(cards).toHaveCount(before - 1);
});

test('W-E6 verify and reject deposits; the pending queue updates', async ({ page }) => {
  await login(page);
  await nav(page, cashBn.title);
  const queue = page.locator('#deposits ul > li');
  await expect(queue.first()).toBeVisible();
  const before = await queue.count();

  await queue.first().getByRole('button', { name: cashBn.verify, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /যাচাই করুন/ }).click();
  await expect(page.getByText(cashBn.verified).first()).toBeVisible();
  await expect(queue).toHaveCount(before - 1);

  await queue.first().getByRole('button', { name: cashBn.reject, exact: true }).click();
  await confirmWithReason(page, 'Slip amount does not match the cash counted.', cashBn.rejectConfirm);
  await expect(queue).toHaveCount(before - 2);
  await page.getByRole('button', { name: cashBn.depositStatus.rejected, exact: true }).click();
  await expect(page.locator('#deposits tbody tr').first()).toContainText(/Slip amount|কারণ/);
});

test('W-E7 create a temporary handover, see it pending, then cancel it', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, handoversBn.title);
  await expect(page.locator('tbody tr button').first()).toBeVisible();
  const before = await page.locator('tbody tr').count();
  await page.getByRole('button', { name: handoversBn.new }).click();
  const d = page.getByRole('dialog');
  // empty submit shows errors and keeps the dialog
  await d.getByRole('button', { name: handoversBn.form.submit }).click();
  await expect(d.getByText(handoversBn.errors.required).first()).toBeVisible();
  // pick a giver who has no pending handover yet (the 7th staff) and the 8th as receiver
  await d.getByLabel(handoversBn.form.from).selectOption({ index: 7 });
  await expect(d.getByRole('checkbox').first()).toBeChecked();
  await d.getByLabel(handoversBn.form.to).selectOption({ index: 7 });
  await d.getByRole('switch').click();
  const end = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  await d.getByLabel(handoversBn.form.end).fill(end);
  await d.getByLabel(handoversBn.form.reason).fill('দশ দিনের ছুটির জন্য সাময়িক কভার');
  await d.getByRole('button', { name: handoversBn.form.submit }).click();
  await expect(d).toBeHidden();
  await expect(page.locator('tbody tr')).toHaveCount(before + 1);
  // open the new one (newest first) and cancel
  await page.locator('tbody tr').first().getByRole('button').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(handoversBn.cashWarning)).toBeVisible();
  await drawer.getByRole('button', { name: handoversBn.cancel }).click();
  await page.getByRole('dialog', { name: handoversBn.cancelTitle }).getByRole('button', { name: handoversBn.cancel }).click();
  await expect(page.locator('tbody tr')).toHaveCount(before);
  await page.getByRole('group', { name: handoversBn.col.status }).getByRole('button', { name: handoversBn.group.closed }).click();
  await expect(page.getByText(commonBn.status.cancelled).first()).toBeVisible();
});

test('promises: filter by window, open one and cancel it with a reason', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, promisesBn.title);
  await page.getByRole('group', { name: promisesBn.when }).getByRole('button', { name: promisesBn.window.next7 }).click();
  await expect(page).toHaveURL(/when=next7/);
  await page.getByLabel(promisesBn.col.status).selectOption('open');
  await expect(page.locator('tbody tr button').first()).toBeVisible();
  await page.locator('tbody tr button').first().click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('button', { name: promisesBn.cancel }).click();
  await confirmWithReason(page, 'গ্রাহক আজই পুরো টাকা দিয়েছেন', promisesBn.cancel);
  await expect(page.getByText(promisesBn.cancelled)).toBeVisible();
});

test('visits: filter by outcome, open a visit with photos and view one', async ({ page }) => {
  await login(page);
  await nav(page, visitsBn.title);
  await page.getByRole('group', { name: visitsBn.range.label }).getByRole('button', { name: visitsBn.range['7d'] }).click();
  await page.getByLabel(visitsBn.col.outcome).selectOption('not_home');
  await expect(page).toHaveURL(/outcome=not_home/);
  await expect(page.locator('tbody tr button').first()).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText(visitsBn.outcome.not_home);
  // a row that has photos
  const row = page.locator('tbody tr', { has: page.locator('svg.lucide-camera') }).first();
  await row.getByRole('button').first().click();
  await page.getByRole('dialog').getByRole('button', { name: /ছবি .* খুলুন/ }).first().click();
  await expect(page.getByRole('img', { name: /ভিজিটের ছবি/ })).toBeVisible();
});

test('attendance: day list, correct an entry with a reason, month matrix', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, attendanceBn.title);
  await page.getByRole('button', { name: attendanceBn.prevDay }).click();
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
  await expect(page.locator('tbody tr').first().getByRole('button', { name: new RegExp(attendanceBn.correct) })).toBeVisible();
  await page.locator('tbody tr').first().getByRole('button', { name: new RegExp(attendanceBn.correct) }).click();
  const d = page.getByRole('dialog');
  await d.getByRole('button', { name: attendanceBn.correction.save }).click();
  await expect(d.getByText(attendanceBn.errors.time)).toBeVisible();
  await d.getByLabel(attendanceBn.correction.time).fill('09:05');
  await d.getByLabel(attendanceBn.correction.reason).fill('ফোন বন্ধ ছিল, অফিসে এসে জানিয়েছেন');
  await d.getByRole('button', { name: attendanceBn.correction.save }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText(attendanceBn.correction.saved)).toBeVisible();
  await page.getByRole('group', { name: attendanceBn.view.label }).getByRole('button', { name: attendanceBn.view.month }).click();
  await expect(page.getByRole('table')).toContainText(attendanceBn.col.lateMin);
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
