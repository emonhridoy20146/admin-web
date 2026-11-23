import { expect, test } from '@playwright/test';
import coworkBn from '../../src/features/cowork/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { login, nav, pickRange } from '../fixtures';

/** FR-W-052 (master FR-CW-006): the office ends an ongoing co-work with a reason; the session stays in the list as ended. */
test('co-work: a manager ends an ongoing session with a reason, and it shows who ended it and why', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, coworkBn.title);
  await pickRange(page, commonBn.range.today);
  await page.waitForURL(/range=today/);
  const ongoing = page.locator('tbody tr').filter({ hasText: coworkBn.status.open });
  await expect(ongoing.first()).toBeVisible();
  const before = await ongoing.count();
  await ongoing.first().locator('td').first().getByRole('button').click();

  const drawer = page.getByRole('dialog').first();
  await expect(drawer.getByRole('heading', { name: coworkBn.members })).toBeVisible();
  await drawer.getByRole('button', { name: coworkBn.end.button }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: coworkBn.end.title });
  await expect(dialog.getByText(coworkBn.end.desc)).toBeVisible();
  await dialog.getByRole('combobox').selectOption('wrong_group');
  await dialog.locator('textarea').fill('দলে ভুল মানুষ ছিলেন');
  await dialog.getByRole('button', { name: coworkBn.end.confirm }).click();
  await expect(dialog).toBeHidden();

  // the drawer now says who ended it and why, and the button is gone
  const block = page.getByTestId('cowork-ended-by-office');
  await expect(block).toBeVisible();
  await expect(block).toContainText('দলে ভুল মানুষ ছিলেন');
  await expect(page.getByRole('dialog').first().getByRole('button', { name: coworkBn.end.button })).toHaveCount(0);
  await expect(page.getByRole('dialog').first().getByText(coworkBn.status.endedByOffice).first()).toBeVisible();

  // the row is still in the list, as ended by the office
  await page.keyboard.press('Escape');
  await expect(page.locator('tbody tr').filter({ hasText: coworkBn.status.endedByOffice })).toHaveCount(1);
  await expect(page.locator('tbody tr').filter({ hasText: coworkBn.status.open })).toHaveCount(before - 1);
});

test('co-work: a viewer sees the sessions but has no button to end one', async ({ page }) => {
  await login(page, 'viewer');
  await page.goto('/cowork/?range=today');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(coworkBn.title);
  const ongoing = page.locator('tbody tr').filter({ hasText: coworkBn.status.open });
  await expect(ongoing.first()).toBeVisible();
  await ongoing.first().locator('td').first().getByRole('button').click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: coworkBn.members })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: coworkBn.end.button })).toHaveCount(0);
});
