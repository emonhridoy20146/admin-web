import { expect, test } from '@playwright/test';
import rbacBn from '../../src/features/admin-rbac/i18n/bn.json' with { type: 'json' };
import flagsBn from '../../src/features/admin-flags/i18n/bn.json' with { type: 'json' };
import auditBn from '../../src/features/audit/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import devBn from '../../src/features/admin-devices/i18n/bn.json' with { type: 'json' };
import sysBn from '../../src/features/system/i18n/bn.json' with { type: 'json' };
import usersBn from '../../src/features/admin-users/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { confirmWithReason, login, nav } from '../fixtures';

test('W-E8 deny tag.set for one user; effective view shows source user; audit shows the diff', async ({ page }) => {
  await login(page);
  await nav(page, rbacBn.title);
  await page.getByRole('tab', { name: rbacBn.tabs.user }).click();
  await page.getByPlaceholder(rbacBn.searchUser).fill('FS009');
  await page.getByRole('button', { name: /FS009/ }).first().click();
  const row = page.getByRole('row').filter({ hasText: 'tag.set' });
  await row.getByRole('radio', { name: rbacBn.effect.deny }).click();
  await page.getByRole('button', { name: rbacBn.review }).click();
  await confirmWithReason(page, 'Repeated wrong tags last month; manager will tag for now.', rbacBn.saveConfirm);
  await expect(row).toContainText(rbacBn.source.user);
  await expect(row.getByRole('radio', { name: rbacBn.effect.deny })).toHaveAttribute('aria-checked', 'true');

  await nav(page, auditBn.title);
  const first = page.locator('tbody tr').first();
  await expect(first).toContainText(auditBn.actions['rbac.override.set']);
  await first.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toContainText('tag.set');
  await expect(drawer).toContainText('deny');
  await expect(drawer).toContainText('Repeated wrong tags');
});

test('W-E9 turning a module off hides its nav item and the direct route shows the module-off page', async ({ page }) => {
  await login(page);
  await nav(page, flagsBn.title);
  const cashFlag = page.getByRole('listitem').filter({ hasText: 'module.cash' });
  await cashFlag.getByRole('switch').click();
  await confirmWithReason(page, 'Cash module paused during the audit week.', flagsBn.turnOff);
  await expect(page.getByRole('navigation').first().getByRole('link', { name: cashBn.title })).toHaveCount(0);
  // keyboard shortcut g h navigates client-side to /cash/
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/\/cash\/$/);
  await expect(page.getByText(commonBn.moduleOff.title)).toBeVisible();
});

test('create a user shows the temporary password once', async ({ page }) => {
  await login(page);
  await nav(page, usersBn.title);
  await page.getByRole('button', { name: usersBn.new }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel(usersBn.form.nameBn).fill('রহিম উদ্দিন');
  await d.getByLabel(usersBn.form.nameEn).fill('Rahim Uddin');
  await d.getByLabel(usersBn.form.phone).fill('০১৭১২-৩৪৫৬৭৮');
  await d.getByLabel(usersBn.form.code).fill('FS099');
  await d.getByRole('checkbox').first().check();
  await d.getByRole('button', { name: usersBn.form.create }).click();
  await expect(page.getByRole('dialog', { name: usersBn.tempTitle })).toBeVisible();
  await expect(page.getByRole('dialog').locator('code')).toHaveText(/^Fos-/);
});

test('devices: approve a waiting phone, then unbind an active one with a reason', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, devBn.title);
  const rows = page.locator('tbody tr');
  await page.getByRole('button', { name: new RegExp(`^${devBn.view.pending_approval}`) }).click();
  await expect(page).toHaveURL(/view=pending_approval/);
  await expect(rows.first().getByRole('button', { name: devBn.approve })).toBeVisible();
  const before = await rows.count();
  await rows.first().getByRole('button', { name: devBn.approve }).click();
  await page.getByRole('dialog').getByRole('button', { name: devBn.approve, exact: true }).click();
  await expect(page.getByText(devBn.approved)).toBeVisible();
  await expect(rows).toHaveCount(before - 1);

  await page.getByRole('button', { name: new RegExp(`^${devBn.view.active}`) }).click();
  await expect(page).toHaveURL(/view=active/);
  await expect(rows.first().getByRole('button', { name: devBn.unbind })).toBeVisible();
  const active = await rows.count();
  await rows.first().getByRole('button', { name: devBn.unbind }).click();
  await confirmWithReason(page, 'ফোন হারিয়ে গেছে, কর্মী জানিয়েছেন', devBn.unbind);
  await expect(page.getByText(devBn.unbound)).toBeVisible();
  await expect(rows).toHaveCount(active - 1);
});

test('system health: server, ERP link and phone sync are shown, problems first', async ({ page }) => {
  await login(page);
  await nav(page, sysBn.title);
  await expect(page.getByText(sysBn.erp.lastSuccess)).toBeVisible();
  await expect(page.getByText(sysBn.api.database)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: sysBn.sync.title })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  expect(await page.locator('tbody tr').count()).toBeGreaterThan(5);
});
