import { expect, test } from '@playwright/test';
import rbacBn from '../../src/features/admin-rbac/i18n/bn.json' with { type: 'json' };
import flagsBn from '../../src/features/admin-flags/i18n/bn.json' with { type: 'json' };
import auditBn from '../../src/features/audit/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import devBn from '../../src/features/admin-devices/i18n/bn.json' with { type: 'json' };
import sysBn from '../../src/features/system/i18n/bn.json' with { type: 'json' };
import settingsBn from '../../src/features/admin-settings/i18n/bn.json' with { type: 'json' };
import usersBn from '../../src/features/admin-users/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { confirmWithReason, login, nav, pickRange, S } from '../fixtures';

test('W-E8 deny tag.set for one user; effective view shows source user; audit shows the diff', async ({ page }) => {
  await login(page);
  await nav(page, rbacBn.title, S.admin);
  await page.getByRole('tab', { name: rbacBn.tabs.user }).click();
  await page.getByPlaceholder(rbacBn.searchUser).fill('FS009');
  await page.getByRole('button', { name: /FS009/ }).first().click();
  const row = page.getByRole('row').filter({ hasText: 'tag.set' });
  await row.getByRole('radio', { name: rbacBn.effect.deny }).click();
  await page.getByRole('button', { name: rbacBn.review }).click();
  await confirmWithReason(page, 'Repeated wrong tags last month; manager will tag for now.', rbacBn.saveConfirm);
  await expect(row).toContainText(rbacBn.source.user);
  await expect(row.getByRole('radio', { name: rbacBn.effect.deny })).toHaveAttribute('aria-checked', 'true');

  await nav(page, auditBn.title, S.admin);
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
  await nav(page, flagsBn.title, S.admin);
  const cashFlag = page.getByRole('listitem').filter({ hasText: 'module.cash' });
  await cashFlag.getByRole('switch').click();
  await confirmWithReason(page, 'Cash module paused during the audit week.', flagsBn.turnOff);
  await expect(page.getByRole('navigation').first().getByRole('link', { name: cashBn.title })).toHaveCount(0);
  // FR-W-069: cash is a tab of the Collections section; with the module off the tab is gone and the section stays
  await nav(page, S.collections);
  await expect(page.getByTestId('section-tabs').getByRole('link', { name: new RegExp(`^${cashBn.title}`) })).toHaveCount(0);
  // keyboard shortcut g h navigates client-side to /cash/
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/\/cash\/$/);
  await expect(page.getByText(commonBn.moduleOff.title)).toBeVisible();
});

test('create a user shows the temporary password once', async ({ page }) => {
  await login(page);
  await nav(page, usersBn.title, S.admin);
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
  await nav(page, devBn.title, S.admin);
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
  await nav(page, sysBn.title, S.admin);
  await expect(page.getByText(sysBn.erp.lastSuccess)).toBeVisible();
  await expect(page.getByText(sysBn.api.database)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: sysBn.sync.title })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  expect(await page.locator('tbody tr').count()).toBeGreaterThan(5);
});

test('settings: one branch gets its own duty hours: no weekly day off and a Friday break window; the organisation keeps Friday off', async ({ page }) => {
  await login(page);
  await nav(page, settingsBn.title, S.admin);
  const off = page.getByRole('group', { name: settingsBn.fields['duty.weeklyOff'].label });
  const friday = settingsBn.weekdays[5]!;
  await expect(off.getByRole('button', { name: friday, pressed: true })).toBeVisible();

  // switch to the branch: only what a branch may override stays on the page
  await page.getByLabel(settingsBn.scope.label).selectOption({ label: 'ভোলা' });
  await expect(page.getByText(settingsBn.scope.branchNote.replace('{{name}}', 'ভোলা'))).toBeVisible();
  await expect(page.getByLabel(settingsBn.fields['app.minVersion'].label)).toHaveCount(0);
  await expect(page.getByLabel(settingsBn.fields['attendance.lateDaysPerAbsent'].label)).toHaveCount(0);

  await off.getByRole('button', { name: friday }).click();
  await expect(off.getByRole('button', { name: friday, pressed: false })).toBeVisible();
  const windows = page.getByRole('group', { name: settingsBn.fields['duty.breakWindows'].label });
  await expect(windows.getByText(settingsBn.windows.none)).toBeVisible();
  await windows.getByRole('button', { name: settingsBn.windows.add }).click();
  await expect(windows.getByLabel(settingsBn.windows.from.replace('{{n}}', '১'))).toHaveValue('12:30');
  // a window that ends before it starts is refused before anything is sent
  await windows.getByLabel(settingsBn.windows.to.replace('{{n}}', '১')).fill('11:00');
  await page.getByRole('button', { name: settingsBn.review }).click();
  await expect(page.getByText(settingsBn.errors.windowOrder)).toBeVisible();
  await windows.getByLabel(settingsBn.windows.to.replace('{{n}}', '১')).fill('15:30');

  // by keyboard: the "fix the fields" toast is still over the corner of the save bar
  await page.getByRole('button', { name: settingsBn.review }).press('Enter');
  await confirmWithReason(page, 'ভোলায় সাপ্তাহিক ছুটি নেই, শুক্রবার লম্বা বিরতি', settingsBn.saveConfirm);
  await expect(page.getByText(settingsBn.saved)).toBeVisible();
  await expect(off.getByRole('button', { name: friday, pressed: false })).toBeVisible();
  await expect(windows.getByLabel(settingsBn.windows.to.replace('{{n}}', '১'))).toHaveValue('15:30');

  // the organisation's own value did not change
  await page.getByLabel(settingsBn.scope.label).selectOption({ label: settingsBn.scope.all });
  await expect(off.getByRole('button', { name: friday, pressed: true })).toBeVisible();
  await expect(windows.getByText(settingsBn.windows.none)).toBeVisible();
});

test('settings: attendance photo is required by default; drop one moment and save with a reason', async ({ page }) => {
  await login(page);
  await nav(page, settingsBn.title, S.admin);
  const group = page.getByRole('group', { name: settingsBn.fields['attendance.selfieEvents'].label });
  for (const k of ['work_in', 'break_start', 'break_end', 'work_out'] as const) await expect(group.getByRole('button', { name: settingsBn.enum[k], pressed: true })).toBeVisible();
  await group.getByRole('button', { name: settingsBn.enum.break_start }).click();
  await expect(group.getByRole('button', { name: settingsBn.enum.break_start, pressed: false })).toBeVisible();
  await page.getByRole('button', { name: settingsBn.review }).click();
  await confirmWithReason(page, 'বিরতির সময় ছবি আপাতত লাগবে না', settingsBn.saveConfirm);
  await expect(page.getByText(settingsBn.saved)).toBeVisible();
  await expect(group.getByRole('button', { name: settingsBn.enum.break_start, pressed: false })).toBeVisible();
});

// FR-W-068 (owner request 2026-11-24, item B): the audit log has the shared date filter; the range is in the link and
// goes to the server as Asia/Dhaka day boundaries, so paging stays exact.
test('audit log: shared date filter, preset and custom range in the link, sent as Dhaka from/to', async ({ page }) => {
  await login(page);
  await page.goto('/admin/audit/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(auditBn.title);
  const trigger = page.getByTestId('date-range');
  await expect(trigger).toContainText(commonBn.range['7d']);

  const today = page.waitForRequest((r) => r.url().includes('/audit?') && r.url().includes('from='));
  await pickRange(page, commonBn.range.today);
  await expect(page).toHaveURL(/range=today/);
  const u = new URL((await today).url());
  // Dhaka midnight is 18:00 UTC the day before
  expect(u.searchParams.get('from')).toMatch(/T18:00:00\.000Z$/);
  expect(u.searchParams.get('to')).toMatch(/T17:59:59\.999Z$/);

  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(commonBn.range.from).fill('2026-11-01');
  await dialog.getByLabel(commonBn.range.to).fill('2026-11-03');
  const custom = page.waitForRequest((r) => r.url().includes('/audit?') && r.url().includes('2026-10-31T18'));
  await dialog.getByRole('button', { name: commonBn.range.apply }).click();
  await expect(page).toHaveURL(/from=2026-11-01&to=2026-11-03/);
  expect(new URL((await custom).url()).searchParams.get('to')).toBe('2026-11-03T17:59:59.999Z');

  // an old link keeps working as the same preset
  await page.goto('/admin/audit/?range=30d');
  await expect(trigger).toContainText(commonBn.range['30d']);
  await pickRange(page, commonBn.range.all);
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
