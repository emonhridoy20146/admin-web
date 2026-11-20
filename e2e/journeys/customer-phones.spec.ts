import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import { login, nav } from '../fixtures';

// Owner request 2026-11-21 (contract 1.23.0, FR-CUS-016): add several phone numbers to a customer at once, see
// which number is the ERP's and which were added, remove an added one.

async function openFirstCustomer(page: import('@playwright/test').Page) {
  await nav(page, custBn.title);
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  await page.locator('tbody tr').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  return drawer;
}

test('phones: add two numbers at once, they show as added after the ERP number, then remove one', async ({ page }) => {
  await login(page, 'manager');
  const drawer = await openFirstCustomer(page);
  const list = drawer.getByTestId('customer-phones');
  await expect(list.getByText(custBn.phone.erpMain)).toHaveCount(1);
  const before = await list.locator('li').count();

  await drawer.getByRole('button', { name: custBn.phone.add }).click();
  const dialog = page.getByRole('dialog', { name: custBn.phone.addTitle });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(custBn.phone.keptHere)).toBeVisible();

  // nothing typed: asks for a number and stays open
  await dialog.getByRole('button', { name: custBn.phone.save }).click();
  await expect(dialog.getByText(custBn.phone.err.empty)).toBeVisible();

  // a bad number is named under its field
  await dialog.getByRole('textbox', { name: 'নম্বর ১' }).fill('01234');
  await dialog.getByRole('button', { name: custBn.phone.save }).click();
  await expect(dialog.getByText(custBn.phone.err.invalid)).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[role=dialog]').analyze()).violations).toEqual([]);

  await dialog.getByRole('textbox', { name: 'নম্বর ১' }).fill('+880 1811-000004');
  await dialog.getByLabel(custBn.phone.whose).first().fill('স্ত্রী');
  await dialog.getByRole('button', { name: custBn.phone.another }).click();
  await dialog.getByRole('textbox', { name: 'নম্বর ২' }).fill('01811000004');
  await expect(dialog.getByText(custBn.phone.err.repeated)).toBeVisible(); // typed twice
  await dialog.getByRole('textbox', { name: 'নম্বর ২' }).fill('০১৩১১০০০০০৫'); // Bangla digits
  await dialog.getByRole('button', { name: custBn.phone.save }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('২টি নম্বর যোগ হয়েছে।')).toBeVisible();

  await expect(list.locator('li')).toHaveCount(before + 2);
  await expect(list.getByText('01811000004')).toBeVisible();
  await expect(list.getByText('01311000005')).toBeVisible();
  await expect(list.getByText(custBn.phone.added)).toHaveCount(2);
  await expect(list.getByText('স্ত্রী')).toBeVisible();
  // the ERP number is still first
  await expect(list.locator('li').first().getByText(custBn.phone.erpMain)).toBeVisible();

  // remove one of the added numbers (an ERP number has no remove button)
  await expect(list.locator('li').first().getByRole('button')).toHaveCount(0);
  await list.getByRole('button', { name: custBn.phone.removeAria.replace('{{number}}', '01311000005') }).click();
  const confirm = page.getByRole('dialog', { name: custBn.phone.removeTitle });
  await expect(confirm.getByText('01311000005')).toBeVisible();
  await confirm.getByRole('button', { name: custBn.phone.removeConfirm }).click();
  await expect(confirm).toBeHidden();
  await expect(list.locator('li')).toHaveCount(before + 1);
  await expect(list.getByText('01311000005')).toHaveCount(0);
});

test('phones: a viewer sees the numbers and their marks but cannot add or remove', async ({ page }) => {
  await login(page, 'viewer');
  const drawer = await openFirstCustomer(page);
  await expect(drawer.getByTestId('customer-phones').getByText(custBn.phone.erpMain)).toBeVisible();
  await expect(drawer.getByRole('button', { name: custBn.phone.add })).toHaveCount(0);
});
