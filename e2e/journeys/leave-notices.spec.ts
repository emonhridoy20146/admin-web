import { expect, test } from '@playwright/test';
import attBn from '../../src/features/attendance/i18n/bn.json' with { type: 'json' };
import noticesBn from '../../src/features/notices/i18n/bn.json' with { type: 'json' };
import usersBn from '../../src/features/admin-users/i18n/bn.json' with { type: 'json' };
import { confirmWithReason, login, nav } from '../fixtures';

const dhakaToday = (page: import('@playwright/test').Page) => page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date()));

test('leave: the manager approves one request and rejects another with a reason', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, attBn.leave.title);

  // waiting requests of the manager's branch, oldest first
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  const first = rows.first();
  const name = (await first.locator('td').first().locator('span[lang]').textContent())!.trim();

  // approve: confirmed with the dates named, cannot be undone
  await first.getByRole('button', { name: new RegExp(attBn.leave.approve) }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  await dialog.getByRole('button', { name: attBn.leave.approve, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(rows).toHaveCount(2);

  // reject: a reason of at least 5 characters, which the staff member sees in the app
  const second = rows.first();
  const name2 = (await second.locator('td').first().locator('span[lang]').textContent())!.trim();
  await second.getByRole('button', { name: new RegExp(attBn.leave.reject) }).click();
  await confirmWithReason(page, 'সাপ্তাহিক কালেকশন ড্রাইভ চলছে', attBn.leave.reject);
  await expect(rows).toHaveCount(1);

  // the decided ones are under their status, and the drawer shows the manager's reason
  await page.getByRole('group', { name: attBn.leave.filter }).getByRole('button', { name: new RegExp(attBn.leave.filters.rejected) }).click();
  const rejected = page.locator('tbody tr').filter({ hasText: name2 });
  await expect(rejected).toHaveCount(1);
  await rejected.locator('td').first().getByRole('button').click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('সাপ্তাহিক কালেকশন ড্রাইভ চলছে')).toBeVisible();
  await expect(dialog.getByRole('button', { name: attBn.leave.approve, exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('group', { name: attBn.leave.filter }).getByRole('button', { name: new RegExp(attBn.leave.filters.approved) }).click();
  await expect(page.locator('tbody tr').filter({ hasText: name })).toHaveCount(1);
});

test('work calendar: add a branch holiday and delete it, add a shift and give it to a staff member', async ({ page }) => {
  await login(page);
  await nav(page, attBn.calendar.title);

  // a holiday on the 1st of next month for one branch
  const today = await dhakaToday(page);
  const [y, m] = today.split('-').map(Number) as [number, number];
  const date = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  if (m === 12) await page.getByRole('button', { name: attBn.calendar.nextYear }).click();
  await page.getByRole('button', { name: attBn.calendar.addHoliday }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(attBn.calendar.date).fill(date);
  await dialog.getByLabel(attBn.calendar.nameBn).fill('শাখা সংস্কারের ছুটি');
  await dialog.getByRole('button', { name: attBn.calendar.scopes.branch }).click();
  // a branch holiday needs a branch
  await dialog.getByRole('button', { name: attBn.calendar.save }).click();
  await expect(dialog.getByText(attBn.calendar.errors.branch)).toBeVisible();
  await dialog.getByRole('checkbox').first().click();
  await dialog.getByRole('button', { name: attBn.calendar.save }).click();
  await expect(dialog).toBeHidden();
  const row = page.locator('tbody tr').filter({ hasText: 'শাখা সংস্কারের ছুটি' });
  await expect(row).toHaveCount(1);

  // entered by mistake: delete it
  await row.getByRole('button', { name: /মুছুন/ }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/শাখা সংস্কারের ছুটি/)).toBeVisible();
  await dialog.getByRole('button', { name: attBn.calendar.delete, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveCount(0);

  // a new shift: end before start is refused, then saved
  await page.getByRole('group', { name: attBn.calendar.title }).getByRole('button', { name: attBn.calendar.tabs.shifts }).click();
  await page.getByRole('button', { name: attBn.calendar.addShift }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(attBn.calendar.shiftName).fill('Evening market');
  await dialog.getByLabel(attBn.calendar.start).fill('14:00');
  await dialog.getByLabel(attBn.calendar.end).fill('12:00');
  await dialog.getByRole('button', { name: attBn.calendar.save }).click();
  await expect(dialog.getByText(attBn.calendar.errors.endBeforeStart)).toBeVisible();
  await dialog.getByLabel(attBn.calendar.end).fill('21:00');
  await dialog.getByRole('button', { name: attBn.calendar.save }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('tbody tr').filter({ hasText: 'Evening market' })).toContainText('14:00 – 21:00');

  // give it to a field staff member in Users (the change asks for a reason)
  await nav(page, usersBn.title);
  // a field staff member of Barishal (the row opens the drawer)
  await page.locator('tbody tr').filter({ hasText: /FS0\d\d/ }).first().locator('td').first().click();
  await page.getByRole('dialog').getByRole('button', { name: usersBn.drawer.edit }).click();
  dialog = page.getByRole('dialog').filter({ has: page.getByLabel(usersBn.form.shift) });
  await dialog.getByLabel(usersBn.form.shift).selectOption({ label: 'Evening market · 14:00–21:00' });
  await dialog.getByRole('button', { name: usersBn.form.save }).click();
  // the reason dialog sits on top of the user drawer, which stays open and shows the new shift
  const reason = page.getByRole('dialog').filter({ has: page.locator('textarea') });
  await reason.locator('textarea').fill('Moved to the evening market route');
  await reason.getByRole('button', { name: usersBn.form.save }).click();
  await expect(reason).toBeHidden();
  await expect(page.getByRole('dialog').getByText('Evening market · 14:00–21:00')).toBeVisible();
});

test('notices: send a must-read notice and see who has not read it', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, noticesBn.title);

  // an older must-read notice: the people who have not read it come first
  await page.locator('tbody tr').filter({ hasText: 'রসিদ ছাড়া টাকা নয়' }).locator('td').first().getByRole('button').click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: noticesBn.recipients.title })).toBeVisible();
  await expect(dialog.getByText(noticesBn.recipients.notRead).first()).toBeVisible();
  await dialog.getByRole('group', { name: noticesBn.recipients.show }).getByRole('button', { name: new RegExp(`^${noticesBn.recipients.read}`) }).click();
  await expect(dialog.getByText(/পড়েছেন .+/).first()).toBeVisible();
  await page.keyboard.press('Escape');

  // a new one: Bangla title and message are required
  await page.getByRole('button', { name: noticesBn.new }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: noticesBn.compose.next }).click();
  await expect(dialog.getByText(noticesBn.errors.required).first()).toBeVisible();
  await dialog.getByLabel(noticesBn.compose.titleBn).fill('আজ বিকেল ৪টায় সভা');
  await dialog.getByLabel(noticesBn.compose.bodyBn).fill('সবাই আজ বিকেল ৪টায় শাখা অফিসে আসবেন।');
  await dialog.getByRole('switch').click();
  await dialog.getByRole('button', { name: noticesBn.compose.next }).click();

  // the confirmation names who gets it, then it is sent and opens with nobody read yet
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: noticesBn.confirm.title })).toBeVisible();
  await expect(dialog.getByText(/মাঠকর্মী/)).toBeVisible();
  await dialog.getByRole('button', { name: noticesBn.confirm.send }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'আজ বিকেল ৪টায় সভা' })).toBeVisible();
  await expect(dialog.getByText(/মধ্যে ০ জন পড়েছেন/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('tbody tr').first()).toContainText('আজ বিকেল ৪টায় সভা');
});

test.describe('at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('leave and notices fit the phone width', async ({ page }) => {
    await login(page, 'manager');
    for (const path of ['/attendance/leave/', '/notices/', '/attendance/calendar/']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
