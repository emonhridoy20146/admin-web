import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import tagsBn from '../../src/features/tags/i18n/bn.json' with { type: 'json' };
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import promisesBn from '../../src/features/promises/i18n/bn.json' with { type: 'json' };
import visitsBn from '../../src/features/visits/i18n/bn.json' with { type: 'json' };
import attendanceBn from '../../src/features/attendance/i18n/bn.json' with { type: 'json' };
import staffBn from '../../src/features/staff/i18n/bn.json' with { type: 'json' };
import areasBn from '../../src/features/assignments/i18n/bn.json' with { type: 'json' };
import locBn from '../../src/features/location/i18n/bn.json' with { type: 'json' };
import repBn from '../../src/features/reports/i18n/bn.json' with { type: 'json' };
import handoversBn from '../../src/features/handovers/i18n/bn.json' with { type: 'json' };
import coworkBn from '../../src/features/cowork/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import type { Page } from '@playwright/test';
import { confirmWithReason, login, nav, pickRange } from '../fixtures';

async function toggleChip(page: Page, name: string | RegExp) {
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

test('W-E5b a refund needs a photo of the proof before it can be confirmed', async ({ page }) => {
  await login(page);
  await nav(page, colBn.conflicts);
  const cards = page.locator('main [aria-label="' + colBn.fieldRecord + '"]');
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  await page.getByLabel(colBn.action, { exact: true }).first().selectOption('refund');
  const resolveBtn = page.getByRole('button', { name: colBn.resolve, exact: true }).first();
  await expect(resolveBtn).toBeDisabled();

  // a small JPEG made in the browser stands in for the camera photo
  const jpeg = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const x = c.getContext('2d')!;
    x.fillStyle = 'gray';
    x.fillRect(0, 0, 64, 48);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]!;
  });
  await page.locator('main input[type=file]').first().setInputFiles({ name: 'refund.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
  await expect(page.getByText(colBn.proof.ready, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: colBn.proof.preview })).toBeVisible();
  await expect(resolveBtn).toBeEnabled();

  await resolveBtn.click();
  await expect(page.getByRole('dialog')).toContainText(colBn.proof.attached);
  await confirmWithReason(page, 'Customer asked for the money back at the branch.', /সমাধান/);
  await expect(page.getByText(colBn.resolved).first()).toBeVisible();
  await expect(cards).toHaveCount(before - 1);
});

test('cash on hand: a row opens the collections the cash came from, with customer, invoice and receipt', async ({ page }) => {
  await login(page);
  await nav(page, cashBn.title);
  const row = page.locator('#positions tbody tr').first();
  await expect(row).toContainText('৳'); // the loaded row, not a loading placeholder
  await row.locator('td').nth(1).click();
  await expect(page).toHaveURL(/hand=/);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(cashBn.inHand.subtitle)).toBeVisible();
  const items = drawer.getByRole('list', { name: cashBn.inHand.list }).getByRole('listitem');
  await expect(items.first()).toBeVisible();
  // each line names the customer (a link to the customer page), the invoice and the receipt
  await expect(items.first().getByRole('link')).toHaveAttribute('href', /\/customers\/.+\//);
  await expect(items.first()).toContainText(cashBn.inHand.invoice.replace('{{no}}', '').trim());
  await expect(items.first()).toContainText(/[A-Z]{3}\d{2}-[A-Z]{2}\d{3}-\d{6}-\d{4}/);
  await expect(drawer.getByText(cashBn.inHand.how)).toBeVisible();
  const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page).not.toHaveURL(/hand=/);
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
  await pickRange(page, commonBn.range.next7);
  await expect(page).toHaveURL(/range=next7/);
  await page.getByLabel(promisesBn.col.status).selectOption('open');
  await expect(page).toHaveURL(/status=open/);
  await page.waitForLoadState('networkidle');
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
  await pickRange(page, commonBn.range['7d']);
  await expect(page).toHaveURL(/range=7d/);
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
  // contract 1.25.0: overtime in the month, and how many absent days the late days count as
  const head = page.getByRole('table').getByRole('columnheader');
  await expect(head.filter({ hasText: attendanceBn.col.overtime })).toBeVisible();
  await expect(head.filter({ hasText: attendanceBn.col.lateAbsences })).toBeVisible();
  // every two late days of a month are one absent day: check it on each row from the numbers shown,
  // in last month (a whole month, so there are late days whatever today's date is)
  await page.getByRole('button', { name: attendanceBn.prevMonth }).click();
  // wait until the table really is last month: one column per day of it (staff + days + 7 totals), rows loaded
  const dhaka = new Date(Date.now() + 6 * 3_600_000); // the app's business date, whatever the runner's time zone
  const lastMonthDays = new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), 0)).getUTCDate();
  await expect(head).toHaveCount(lastMonthDays + 8);
  await expect(page.getByRole('table').locator('tbody tr').first().locator('th, td')).toHaveCount(lastMonthDays + 8);
  await page.waitForLoadState('networkidle');
  const bn = (t: string) => Number(t.replace(/[০-৯]/g, (c) => String('০১২৩৪৫৬৭৮৯'.indexOf(c))).replace('—', '0'));
  const cols = await head.allTextContents();
  const lateCol = cols.indexOf(attendanceBn.status.late);
  const absCol = cols.indexOf(attendanceBn.col.lateAbsences);
  expect(lateCol).toBeGreaterThan(0);
  const rows = page.getByRole('table').locator('tbody tr');
  const n = await rows.count();
  expect(n).toBeGreaterThan(3);
  let counted = 0;
  for (let i = 0; i < n; i++) {
    const cells = await rows.nth(i).locator('th, td').allTextContents();
    expect(bn(cells[absCol]!)).toBe(Math.floor(bn(cells[lateCol]!) / 2));
    counted += bn(cells[absCol]!);
  }
  expect(counted).toBeGreaterThan(0);
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('staff: performance list, month view, drawer and jump to the staff member\'s visits', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, staffBn.title);
  await expect(page.locator('tbody tr button').first()).toBeVisible();
  await page.getByRole('group', { name: staffBn.period.label }).getByRole('button', { name: staffBn.period.monthly }).click();
  await expect(page).toHaveURL(/period=monthly/);
  await expect(page.getByRole('columnheader', { name: staffBn.col.days })).toBeVisible();
  await page.locator('tbody tr button').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(staffBn.byMethod)).toBeVisible();
  await drawer.getByRole('link', { name: staffBn.link.visits }).click();
  await expect(page).toHaveURL(/\/visits\/\?userId=/);
  // the staff filter (FR-W-063) shows the person from the link
  await expect(page.getByTestId('staff-select')).toHaveValue(new URL(page.url()).searchParams.get('userId')!);
});

test('customer map: pins listed beside the map, filter, open a customer', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.map.title);
  const list = page.getByRole('region', { name: custBn.map.inView });
  await expect(list.getByRole('button').first()).toBeVisible();
  await expect(page.getByRole('application', { name: custBn.map.title })).toBeVisible();
  await toggleChip(page, custBn.filters.overdue);
  await expect(page).toHaveURL(/filter=overdue/);
  await expect(list.getByRole('button').first()).toBeVisible();
  await list.getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/drawer=customer/);
});

test('pin approvals: approve one proposal and reject another with a reason', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.pins.title);
  const cards = page.locator('main ul > li');
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  await cards.first().getByRole('button', { name: new RegExp(`${custBn.pins.approve}$`) }).click();
  await page.getByRole('dialog').getByRole('button', { name: custBn.pins.approve, exact: true }).click();
  await expect(page.getByText(custBn.pins.approved)).toBeVisible();
  await expect(cards).toHaveCount(before - 1);
  await cards.first().getByRole('button', { name: new RegExp(`${custBn.pins.reject}$`) }).click();
  await confirmWithReason(page, 'পিন রাস্তার ওপর পড়েছে, বাড়িতে নয়', custBn.pins.reject);
  await expect(cards).toHaveCount(before - 2);
});

test('areas: assign a staff member, remove an assignee and create an area', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, areasBn.title);
  const cards = page.locator('main ul.grid > li');
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  const card = cards.first();
  const chips = card.locator('ul > li');
  const had = await chips.count();

  await card.getByRole('button', { name: new RegExp(areasBn.assign) }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: areasBn.assign, exact: true }).click();
  await expect(dialog.getByText(areasBn.errors.required)).toBeVisible();
  await dialog.getByRole('combobox').selectOption({ index: 1 });
  await dialog.getByRole('button', { name: areasBn.assign, exact: true }).click();
  await expect(page.getByText(areasBn.assigned)).toBeVisible();
  await expect(chips).toHaveCount(had + 1);

  await chips.first().getByRole('button').click();
  await page.getByRole('dialog').getByRole('button', { name: areasBn.remove, exact: true }).click();
  await expect(page.getByText(areasBn.removed)).toBeVisible();
  await expect(chips).toHaveCount(had);

  await page.getByRole('button', { name: areasBn.new }).click();
  const form = page.getByRole('dialog');
  await form.getByRole('button', { name: areasBn.form.save }).click();
  await expect(form.getByText(areasBn.errors.required).first()).toBeVisible();
  await form.getByLabel(areasBn.form.nameBn).fill('নতুন বাজার');
  await form.getByLabel(areasBn.form.nameEn).fill('Notun Bazar');
  await form.getByLabel(areasBn.form.code).fill('TST-NB');
  await form.getByLabel(areasBn.erpCodes).fill('NB1, NB2');
  await form.getByRole('button', { name: areasBn.form.save }).click();
  await expect(page.getByText(areasBn.saved)).toBeVisible();
  await expect(cards).toHaveCount(before + 1);
  await expect(page.getByRole('heading', { level: 2, name: 'নতুন বাজার' })).toBeVisible();
});

test('live map: staff list with freshness, filter, expand one and jump to the route', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, locBn.live.title);
  const list = page.getByRole('region', { name: locBn.live.list });
  const rows = list.locator('ul > li');
  await expect(rows.first()).toBeVisible();
  const all = await rows.count();
  expect(all).toBeGreaterThan(3);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await toggleChip(page, new RegExp(`^${locBn.freshness.fresh}`));
  await expect(page).toHaveURL(/show=fresh/);
  await expect.poll(() => rows.count()).toBeLessThan(all);
  await rows.first().getByRole('button').click();
  await expect(page).toHaveURL(/staff=/);
  await expect(rows.first().getByText(locBn.live.collectedToday)).toBeVisible();
  await rows.first().getByRole('link', { name: locBn.live.seeRoute }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(locBn.routes.title);
  await expect(page).toHaveURL(/user=/);
});

test.describe('maps show the branch and where the admin is (FR-W-034)', () => {
  test.use({ geolocation: { latitude: 22.7031, longitude: 90.3712, accuracy: 25 }, permissions: ['geolocation'] });

  test('live map: branch pin and the "my location" button', async ({ page }) => {
    await login(page, 'manager');
    await nav(page, locBn.live.title);
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('.leaflet-marker-icon .fos-pin.is-branch').first()).toBeVisible(); // branch pin (staff are dots)
    const paths = page.locator('.leaflet-overlay-pane path');
    await expect(paths.first()).toBeVisible();
    const before = await paths.count();
    await page.getByRole('button', { name: commonBn.map.myLocation }).click();
    await expect.poll(() => paths.count()).toBe(before + 2); // accuracy circle + dot
    await expect(page.getByText(commonBn.map.locationDenied)).toHaveCount(0);
  });

  test('customer map: the same button, and a clear message when the browser blocks location', async ({ page, context }) => {
    await context.clearPermissions();
    await login(page, 'manager');
    await nav(page, custBn.map.title);
    await page.getByRole('button', { name: commonBn.map.myLocation }).click();
    await expect(page.getByText(commonBn.map.locationDenied)).toBeVisible();
  });
});

test('route history: pick a staff member and a day, see summary, stops and select a stop', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, locBn.routes.title);
  await expect(page.getByText(locBn.routes.pick)).toBeVisible();
  await page.getByLabel(locBn.routes.staff, { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: locBn.routes.prevDay }).click();
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByText(locBn.routes.distance)).toBeVisible();
  const stops = page.getByRole('region', { name: locBn.routes.stopsTitle }).locator('ol > li');
  await expect(stops.first()).toBeVisible();
  await stops.first().getByRole('button').click();
  await expect(stops.first().getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.leaflet-container path').first()).toBeAttached();
});

test('W-E12 reports: trends by range, reconciliation for a past day, build and download an export', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, repBn.title);
  await expect(page.getByText(repBn.trends.overdueTotal)).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle path').first()).toBeAttached();
  await page.getByRole('button', { name: repBn.range['7d'], exact: true }).click();
  await expect(page).toHaveURL(/range=7d/);
  await page.getByRole('button', { name: commonBn.chart.showTable }).click();
  await expect(page.locator('tbody tr')).toHaveCount(7);

  await page.getByRole('button', { name: repBn.tabs.reconciliation, exact: true }).click();
  await expect(page).toHaveURL(/tab=reconciliation/);
  await page.getByRole('button', { name: repBn.recon.prevDay }).click();
  await expect(page.getByText(repBn.recon.unbalanced, { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: repBn.recon.kind.amount_differs })).toHaveCount(1);

  await page.getByRole('button', { name: repBn.tabs.exports, exact: true }).click();
  await page.getByLabel(repBn.exports.from).fill('2026-01-01');
  await page.getByRole('button', { name: repBn.exports.create }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'সর্বোচ্চ' })).toBeVisible();
  await page.getByLabel(repBn.exports.type).selectOption('cash_positions');
  await page.getByRole('button', { name: repBn.exports.create }).click();
  const link = page.getByRole('link', { name: new RegExp(repBn.exports.download) });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await expect(link).toHaveAttribute('href', /cash_positions\.xlsx$/);
});

test('bulk assign: select customers in the list and give them to one staff member', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.title);
  const rows = page.locator('tbody tr');
  await expect(rows.first().locator('a').first()).toBeVisible();
  await rows.nth(0).getByRole('checkbox').click();
  await rows.nth(1).getByRole('checkbox').click();
  await page.getByRole('button', { name: areasBn.bulk.open }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: areasBn.bulk.confirm, exact: true }).click();
  await expect(dialog.getByText(areasBn.errors.required)).toBeVisible();
  await dialog.getByRole('combobox').selectOption({ index: 1 });
  await dialog.getByRole('button', { name: areasBn.bulk.confirm, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: areasBn.bulk.open })).toBeHidden();
});

test('attendance photos: open a staff member\'s day, see each event with its photo and enlarge one', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, attendanceBn.title);
  // go back until a worked day is found (today may not have started, Friday is the weekly off)
  // an auto-closed day has no work-out event by design, so pick a day the person closed themselves
  const worked = page.locator('tbody tr').filter({ hasText: new RegExp(`${attendanceBn.status.present}|${attendanceBn.status.late}`) }).filter({ hasNotText: attendanceBn.autoClosed });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: attendanceBn.prevDay }).click();
    // the previous day's rows stay on screen while the new day loads, so wait for a worked row instead of counting at once
    if (await worked.first().waitFor({ timeout: 4000 }).then(() => true, () => false)) break;
  }
  await worked.first().click();
  await expect(page).toHaveURL(/drawer=/);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(attendanceBn.event.work_in)).toBeVisible();
  await expect(drawer.getByText(attendanceBn.event.work_out)).toBeVisible();
  const photo = drawer.getByRole('button', { name: new RegExp(attendanceBn.event.work_in) });
  if (await photo.count()) {
    await photo.click();
    await expect(page.getByRole('dialog').last().locator('img')).toBeVisible();
  } else {
    await expect(drawer.getByText(attendanceBn.events.flag.no_selfie)).toBeVisible();
  }
});

test('co-work: sessions with members and timeline, their joint visits, the visit kind filter and staff credit', async ({ page }) => {
  await login(page);
  await nav(page, coworkBn.title);
  await pickRange(page, commonBn.range['30d']);
  await page.waitForURL(/range=30d/);
  const withVisits = page.locator('tbody a[href*="/visits/?session="]');
  await expect(withVisits.first()).toBeVisible();

  // a session opens in the drawer with its members, its visits and what happened when
  await page.locator('tbody tr').filter({ has: page.locator('a[href*="/visits/?session="]') }).first().locator('td').first().getByRole('button').click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: coworkBn.members })).toBeVisible();
  await expect(drawer.getByRole('heading', { name: coworkBn.timeline.title })).toBeVisible();
  await expect(drawer.getByText(/রেকর্ড করেছেন/).first()).toBeVisible();

  // its visits in the visits list: every row is joint, and a row links back to the group
  await drawer.getByRole('link', { name: coworkBn.openVisits }).click();
  await page.waitForURL(/\/visits\/\?session=/);
  await expect(page.getByText(visitsBn.cowork.sessionFilter)).toBeVisible();
  await expect(page.locator('tbody tr a, tbody tr button').first()).toBeVisible();
  const rows = page.locator('tbody tr');
  const n = await rows.count();
  await expect(rows.filter({ hasText: visitsBn.cowork.joint })).toHaveCount(n);
  await rows.first().locator('td').first().getByRole('button').click();
  await expect(page.getByRole('dialog').getByText(visitsBn.col.with)).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: visitsBn.cowork.openSession }).click();
  await page.waitForURL(/\/cowork\/\?drawer=/);
  await expect(page.getByRole('dialog').getByRole('heading', { name: coworkBn.members })).toBeVisible();
  await page.keyboard.press('Escape');

  // visits: only joint ones
  await nav(page, visitsBn.title);
  await pickRange(page, commonBn.range['30d']);
  await page.waitForURL(/range=30d/);
  await page.getByLabel(visitsBn.cowork.kind).selectOption('joint');
  await page.waitForURL(/kind=joint/);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('tbody tr').first()).toContainText(visitsBn.cowork.joint);

  // staff: single and joint visits apart, with the credit targets use
  await nav(page, staffBn.title);
  await expect(page.getByRole('columnheader', { name: staffBn.col.credit })).toBeVisible();
});


const tail = (s: string) => new RegExp(`${s.split('}}').pop()!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

test('map pin: from the data-quality list, set a missing pin by moving the map and by pasting coordinates (FR-CUS-011)', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, repBn.dq.title);
  const link = page.locator('tbody tr').first().getByRole('link');
  await expect(link).toHaveAttribute('href', /\/customers\/.+\/\?action=pin$/);
  await link.click();
  const dialog = page.getByRole('dialog', { name: tail(custBn.setPin.titleNew) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(custBn.setPin.noPinYet)).toBeVisible();

  // ride-app style: the pin stays in the middle, the map moves under it
  const map = dialog.getByRole('application');
  const readout = dialog.locator('span.font-mono').first();
  await expect(readout).toHaveText(/^\d+\.\d{5}, \d+\.\d{5}$/);
  const start = await readout.innerText();
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await expect(readout).not.toHaveText(start);

  // coordinates from elsewhere (lng first by mistake is swapped back)
  await dialog.getByLabel(custBn.setPin.paste).fill('nonsense');
  await dialog.getByRole('button', { name: custBn.setPin.go }).click();
  await expect(dialog.getByText(custBn.setPin.pasteError)).toBeVisible();
  await dialog.getByLabel(custBn.setPin.paste).fill('90.36002, 22.71001');
  await dialog.getByRole('button', { name: custBn.setPin.go }).click();
  await expect(readout).toHaveText('22.71001, 90.36002');
  await dialog.getByLabel(custBn.setPin.note).fill('দোকানের সাইনবোর্ড থেকে');
  await dialog.getByRole('button', { name: custBn.setPin.save }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(tail(custBn.setPin.saved))).toBeVisible();
  await expect(page.getByText('22.71001, 90.36002')).toBeVisible();
  await expect(page).not.toHaveURL(/action=pin/);
  await expect(page.getByRole('button', { name: custBn.setPin.openMove })).toBeVisible();

  // it is in the pin history as set by a manager
  await nav(page, custBn.pins.title);
  await page.getByRole('button', { name: custBn.pins.tab.approved, exact: true }).click();
  await expect(page.locator('main ul > li').first().getByText(custBn.pins.direct)).toBeVisible();
});

test('assign one customer: give an unassigned customer to a staff member, then end the direct assignment (FR-ASG-002)', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, custBn.title);
  await toggleChip(page, custBn.filters.unassigned);
  await expect(page.locator('tbody tr a')).toHaveCount(3);
  await openFirstRow(page);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(custBn.nobodyAssigned, { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: custBn.assign.open }).click();

  const dialog = page.getByRole('dialog', { name: tail(areasBn.one.title) });
  await expect(dialog.getByText(areasBn.one.viaNone)).toBeVisible();
  await dialog.getByRole('button', { name: areasBn.one.confirm, exact: true }).click();
  await expect(dialog.getByText(areasBn.errors.required)).toBeVisible();
  const select = dialog.getByRole('combobox');
  await select.selectOption({ index: 1 });
  const staff = (await select.locator('option:checked').innerText()).split(' · ')[0]!.trim();
  await dialog.getByRole('button', { name: areasBn.one.confirm, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(drawer.getByText(staff, { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr a')).toHaveCount(2); // no longer unassigned

  await drawer.getByRole('button', { name: custBn.assign.change }).click();
  const again = page.getByRole('dialog', { name: tail(areasBn.one.titleChange) });
  await expect(again.getByText(areasBn.one.viaDirect)).toBeVisible();
  await again.getByRole('button', { name: areasBn.one.end }).click();
  await expect(again).toBeHidden();
  await expect(drawer.getByText(custBn.nobodyAssigned, { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr a')).toHaveCount(3);
});
