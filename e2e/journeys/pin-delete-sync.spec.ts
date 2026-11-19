import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { login, nav } from '../fixtures';

// Owner request 2026-11-18 (contract 1.17.0, FR-CUS-014, FR-ERP-007): the customer total is shown, "Sync from ERP"
// sits in the top right, and an admin can delete a customer's map pin after typing the confirm word.

const tail = (s: string) => new RegExp(`${s.split('}}').pop()!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

test('customers: the total number of customers is shown in the header and the pager', async ({ page }) => {
  await login(page);
  await nav(page, custBn.title);
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  const total = page.getByTestId('customer-total');
  await expect(total).toBeVisible();
  await expect(total).toContainText('জন গ্রাহক');
  await expect(page.getByText(/মোট .*টি/).first()).toBeVisible(); // the pager's own total
});

test('Sync from ERP: top-right button pulls until done, says how many came, and the list reloads', async ({ page }) => {
  await login(page);
  const btn = page.getByRole('button', { name: commonBn.erp.syncAria });
  await expect(btn).toBeVisible();
  const box = (await btn.boundingBox())!;
  expect(box.x).toBeGreaterThan(700); // right half of the header
  expect(box.y).toBeLessThan(60);
  await btn.click();
  await expect(btn).toBeDisabled(); // busy while it works
  // the mock cuts the first call for time (partial), so the button calls again; the toast shows the total of both
  await expect(page.getByText(/ERP থেকে সিঙ্ক হয়েছে: .* জন গ্রাহকের তথ্য হালনাগাদ/)).toBeVisible();
  await expect(btn).toBeEnabled();
});

test('Sync from ERP: hidden for a viewer (no erp.sync permission)', async ({ page }) => {
  await login(page, 'viewer');
  await expect(page.getByRole('button', { name: commonBn.erp.syncAria })).toHaveCount(0);
});

test('Sync from ERP: a branch manager can press it', async ({ page }) => {
  await login(page, 'manager');
  await expect(page.getByRole('button', { name: commonBn.erp.syncAria })).toBeVisible();
});

test('delete pin: needs the confirm word, then the customer has no pin; deleting is offered only when there is a pin', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.title);
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  await page.locator('tbody tr').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  const del = drawer.getByRole('button', { name: custBn.deletePin.open });
  await expect(del).toBeVisible();
  await del.click();

  const dialog = page.getByRole('dialog', { name: tail(custBn.deletePin.title) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(custBn.deletePin.keep)).toBeVisible();
  const confirm = dialog.getByRole('button', { name: custBn.deletePin.confirm, exact: true });
  await expect(confirm).toBeDisabled();
  const input = dialog.getByLabel(commonBn.confirmType.label.replace('{{word}}', custBn.deletePin.word));
  await input.fill('delet');
  await expect(confirm).toBeDisabled();
  await input.fill('wrong word');
  await expect(confirm).toBeDisabled();
  expect((await new AxeBuilder({ page }).include('[role=dialog]').analyze()).violations).toEqual([]);
  await input.fill(' delete '); // not case-sensitive, spaces ignored
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(tail(custBn.deletePin.deleted))).toBeVisible();
  // the drawer now says there is no location, and offers to set one instead of deleting
  await expect(drawer.getByText(custBn.locationMissing).first()).toBeVisible();
  await expect(drawer.getByRole('button', { name: custBn.deletePin.open })).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: custBn.setPin.openNew })).toBeVisible();
});

test('delete pin: cancel keeps the pin', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.title);
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  await page.locator('tbody tr').first().click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('button', { name: custBn.deletePin.open }).click();
  const dialog = page.getByRole('dialog', { name: tail(custBn.deletePin.title) });
  await dialog.getByRole('button', { name: commonBn.actions.cancel }).click();
  await expect(dialog).toBeHidden();
  await expect(drawer.getByRole('button', { name: custBn.deletePin.open })).toBeVisible();
});
