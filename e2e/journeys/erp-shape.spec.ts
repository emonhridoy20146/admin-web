import { expect, test } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import usersBn from '../../src/features/admin-users/i18n/bn.json' with { type: 'json' };
import settingsBn from '../../src/features/admin-settings/i18n/bn.json' with { type: 'json' };
import { login, nav } from '../fixtures';

// Contract 1.13.0: the shape of the real Laravel ERP (field-api ADR-033).

test('customer: plans show the ERP invoice number and products, payments the ERP receipt numbers', async ({ page }) => {
  await login(page);
  await nav(page, custBn.title);
  await expect(page.locator('tbody tr a').first()).toBeVisible();
  await page.locator('tbody tr').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/^INV-\d+$/).first()).toBeVisible();
  await drawer.getByRole('link', { name: custBn.openFull }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f]+\/$/);
  await expect(page.getByText(/^INV-\d+$/).first()).toBeVisible();
  await expect(page.getByText(custBn.items, { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: custBn.tabs.payments }).click();
  await expect(page.getByText(/^PAY-\d{8}-\d{5}$/).first()).toBeVisible();
});

test('conflict "collector not linked": link the staff member to their ERP employee from the hint', async ({ page }) => {
  await login(page);
  await nav(page, colBn.conflicts);
  const link = page.getByRole('link', { name: new RegExp(colBn.conflictHint.linkStaff.replace('{{name}}', '(.+)')) }).first();
  await expect(link).toBeVisible();
  const name = (await link.innerText()).replace(colBn.conflictHint.linkStaff.replace('{{name}}', ''), '').trim();
  await link.click();
  await expect(page).toHaveURL(/\/admin\/users\/\?drawer=user/);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(usersBn.form.erpNone, { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: usersBn.drawer.edit }).click();

  const form = page.getByRole('dialog', { name: new RegExp(usersBn.form.editTitle.replace('{{name}}', '.+')) });
  const picker = form.getByLabel(usersBn.form.erpId);
  await expect(form.getByText(usersBn.form.erpNotLinked)).toBeVisible();
  // the ERP list puts the staff of this person's branch first; pick their own record by name
  const option = picker.locator('optgroup').first().locator('option', { hasText: name });
  const value = await option.getAttribute('value');
  expect(value).toMatch(/^\d+$/);
  await picker.selectOption(value!);
  await form.getByRole('button', { name: usersBn.form.save }).click();
  // the reason dialog opens over the user drawer, so it is found by its text box
  const reason = page.getByRole('dialog').filter({ has: page.locator('textarea') });
  await expect(reason).toContainText(usersBn.fields.erpEmployeeId);
  await reason.locator('textarea').fill('ইআরপি কর্মীর সাথে যুক্ত করা হলো');
  await reason.getByRole('button', { name: usersBn.form.save }).click();
  await expect(page.getByText(usersBn.form.saved)).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(new RegExp(`EMP-\\d{5} · ${name}`));
});

test('branch map point: the ERP has none, so it is set in settings (paste coordinates; outside Bangladesh is refused)', async ({ page }) => {
  await login(page);
  await nav(page, settingsBn.title);
  const card = page.locator('#set-branches');
  await expect(card.getByRole('heading', { name: settingsBn.sections.branches.title })).toBeVisible();
  await card.getByRole('button', { name: new RegExp(`${settingsBn.branchPoint.move} · ভোলা`) }).click();

  const dialog = page.getByRole('dialog', { name: settingsBn.branchPoint.title.replace('{{name}}', 'ভোলা') });
  const coords = dialog.getByLabel(settingsBn.branchPoint.paste);
  await coords.fill('51.5072, -0.1276');
  await dialog.getByRole('button', { name: settingsBn.branchPoint.go }).click();
  await expect(dialog.getByRole('alert')).toHaveText(settingsBn.branchPoint.outside);
  await expect(dialog.getByRole('button', { name: settingsBn.branchPoint.save })).toBeDisabled();

  await coords.fill('22.68712, 90.64433');
  await dialog.getByRole('button', { name: settingsBn.branchPoint.go }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: settingsBn.branchPoint.save }).click();
  await expect(page.getByText(settingsBn.branchPoint.saved.replace('{{name}}', 'ভোলা'))).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(card.getByRole('listitem').filter({ hasText: 'ভোলা' })).toContainText(/22\.68712/);

  // removing the point leaves the branch without one
  await card.getByRole('button', { name: new RegExp(`${settingsBn.branchPoint.move} · ভোলা`) }).click();
  await page.getByRole('dialog').getByRole('button', { name: settingsBn.branchPoint.remove }).click();
  await expect(card.getByRole('listitem').filter({ hasText: 'ভোলা' })).toContainText(settingsBn.branchPoint.none);
  await expect(card.getByText(new RegExp(settingsBn.branchPoint.missingCount_one.replace('{{n}}', '.')))).toBeVisible();
});
