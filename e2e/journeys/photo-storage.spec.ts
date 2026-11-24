import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import systemBn from '../../src/features/system/i18n/bn.json' with { type: 'json' };
import attendanceBn from '../../src/features/attendance/i18n/bn.json' with { type: 'json' };
import { login, nav, S } from '../fixtures';

// Owner request 2026-11-22 (FR-W-054/055, master FR-MED-002..004, field-api 1.37.0 ADR-050): photos live in Cloudinary;
// from the 5th the previous months' photos can be deleted in one go after typing DELETE <YYYY-MM>; an admin deletes the
// attendance photos of a staff member's day and a log stays where each photo was.

const serious = async (page: import('@playwright/test').Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);

test('photo storage: alert from the 5th, typed confirmation, deletes every previous month with progress', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-22T10:00:00+06:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, 'admin');
  // the dashboard card turns into the alert
  await expect(page.getByTestId('purge-alert').first()).toBeVisible();

  await nav(page, systemBn.photos.title, S.admin);
  await expect(page.getByTestId('photo-store')).toHaveText(systemBn.photos.store.cloudinary);
  await expect(page.getByTestId('purge-alert')).toBeVisible();
  const months = page.getByTestId('purge-months');
  await expect(months.locator('tbody tr')).toHaveCount(3);
  await expect(months.locator('tfoot')).toContainText('৮৯৫'); // 95 + 388 + 412 photos

  // money proofs only on request, with a warning
  await page.getByRole('checkbox', { name: systemBn.photos.old.moneyProofs }).click();
  await expect(page.getByText(systemBn.photos.old.moneyProofsWarning)).toBeVisible();
  await expect(months.locator('tfoot')).toContainText('৯২৩'); // + 28 proofs
  await page.getByRole('checkbox', { name: systemBn.photos.old.moneyProofs }).click();
  await expect(months.locator('tfoot')).toContainText('৮৯৫');
  expect(await serious(page)).toEqual([]);

  await page.getByRole('button', { name: systemBn.photos.old.delete }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: systemBn.photos.confirm.title });
  const confirm = dialog.getByRole('button', { name: /৮৯৫/ });
  await expect(confirm).toBeDisabled();
  const box = dialog.getByRole('textbox');
  await box.fill('delete 2026-11'); // not exact: still off
  await expect(confirm).toBeDisabled();
  await box.fill('DELETE 2026-11');
  await expect(confirm).toBeEnabled();
  expect(await serious(page)).toEqual([]);
  await confirm.click();
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId('purge-done')).toContainText('৮৯৫');
  await expect(page.getByText(systemBn.photos.old.empty)).toBeVisible();
  await expect(page.getByTestId('purge-alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: systemBn.photos.old.delete })).toBeDisabled();
});

test('photo storage is not offered to a manager (media.delete is super admin only)', async ({ page }) => {
  await login(page, 'manager');
  await expect(page.getByRole('navigation').first().getByRole('link', { name: new RegExp(`^${systemBn.photos.title}`) })).toHaveCount(0);
  // FR-W-069: photos is a tab of Admin; the manager sees the Admin section (users) without it
  await page.getByRole('navigation').first().getByRole('link', { name: S.admin }).click();
  await expect(page.getByTestId('section-tabs')).toBeVisible();
  await expect(page.getByTestId('section-tabs').getByRole('link', { name: new RegExp(`^${systemBn.photos.title}`) })).toHaveCount(0);
  await expect(page.getByTestId('purge-alert')).toHaveCount(0);
});

test('attendance: an admin deletes the photos of a staff member\'s day and the log stays where each photo was', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, 'admin');
  await nav(page, attendanceBn.title, S.staff);
  // A past working day: yesterday, or the day before when yesterday was Friday (the weekly day off: nobody
  // worked, no photos). The mock's day status is a hash of staff member and date, so whoever is first in the
  // list may be absent or on leave that day; only rows with clock times are tried.
  const prev = page.getByRole('button', { name: attendanceBn.prevDay });
  const dateInput = page.getByLabel(attendanceBn.date, { exact: true });
  await prev.click();
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
  if (new Date(`${await dateInput.inputValue()}T12:00:00Z`).getUTCDay() === 5) {
    const friday = await dateInput.inputValue();
    await prev.click();
    await expect(dateInput).not.toHaveValue(friday);
  }
  const button = page.getByRole('dialog').getByRole('button', { name: attendanceBn.events.deletePhotos.button });
  // the first staff member with photos that day (the drawer reads the page's date, so a row still on screen
  // from the day before only opens that person's day here)
  const rows = page.locator('tbody tr').filter({ hasText: /AM|PM/ });
  await expect(rows.first()).toBeVisible();
  let found = false;
  for (let i = 0; i < Math.min(8, await rows.count()); i++) {
    await rows.nth(i).locator('td').nth(3).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('ol li').first().or(drawer.getByText(attendanceBn.events.empty))).toBeVisible();
    if (await button.isVisible()) {
      found = true;
      break;
    }
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  }
  expect(found).toBe(true);
  await button.click();
  const confirm = page.getByRole('dialog').filter({ hasText: attendanceBn.events.deletePhotos.title });
  await confirm.getByRole('textbox').fill('DELETE');
  await confirm.getByRole('button', { name: /মুছুন/ }).last().click();
  await expect(confirm).toBeHidden();

  const drawer = page.getByRole('dialog');
  const logs = drawer.getByTestId('selfie-deleted');
  await expect(logs.first()).toBeVisible();
  const [before, after] = attendanceBn.events.deletedBy.split('{{name}}').map((x) => x.trim());
  await expect(logs.first()).toContainText(before!);
  await expect(logs.first()).toContainText(after!);
  await expect(drawer.getByText(attendanceBn.events.photoDeleted).first()).toBeVisible();
  await expect(drawer.getByRole('button', { name: attendanceBn.events.deletePhotos.button })).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
});
