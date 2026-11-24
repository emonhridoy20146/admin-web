import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import targetsBn from '../../src/features/targets/i18n/bn.json' with { type: 'json' };
import repBn from '../../src/features/reports/i18n/bn.json' with { type: 'json' };
import staffBn from '../../src/features/staff/i18n/bn.json' with { type: 'json' };
import { confirmWithReason, login, nav, S } from '../fixtures';

test('daily targets: change the branch target, give one person their own, then return them to the branch target', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, targetsBn.title, S.staff);

  // the branch default (the card's own button; row buttons are named after the person)
  await page.getByRole('button', { name: targetsBn.edit, exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: targetsBn.dialog.branchTitle })).toBeVisible();
  await dialog.getByLabel(targetsBn.dialog.amount).fill('৩০০০০');
  await dialog.getByLabel(targetsBn.dialog.visits).fill('9');
  await dialog.locator('textarea').fill('November push before the harvest.');
  // money confirms name the amount
  await dialog.getByRole('button', { name: /৳৩০,০০০.*৯টি ভিজিট/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('“November push before the harvest.”')).toBeVisible();

  // a past start date is refused before it reaches the server
  const row = page.locator('tbody tr').filter({ hasNot: page.getByRole('button', { name: new RegExp(targetsBn.clear) }) }).first();
  const code = (await row.locator('.font-mono').first().textContent())!;
  await row.getByRole('button', { name: /লক্ষ্য বদলান/ }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(targetsBn.dialog.amount).fill('18000');
  await dialog.getByLabel(targetsBn.dialog.visits).fill('7');
  await dialog.getByLabel(targetsBn.dialog.from).fill('2020-01-01');
  await dialog.locator('textarea').fill('Smaller area this month.');
  await dialog.getByRole('button', { name: targetsBn.dialog.save, exact: true }).click();
  await expect(dialog.getByText(targetsBn.errors.past)).toBeVisible();
  await dialog.getByLabel(targetsBn.dialog.from).fill(await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())));
  await dialog.getByRole('button', { name: /৳১৮,০০০/ }).click();
  await expect(dialog).toBeHidden();

  // now a personal target: it can be cleared back to the branch target, with a reason
  const mine = page.locator('tbody tr').filter({ hasText: code });
  await mine.getByRole('button', { name: new RegExp(targetsBn.clear) }).click();
  await confirmWithReason(page, 'Area merged back, same as the others.', targetsBn.clear);
  await expect(mine.getByRole('button', { name: new RegExp(targetsBn.clear) })).toHaveCount(0);

  // the history keeps both changes
  await mine.locator('td').first().getByRole('button').click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: targetsBn.history })).toBeVisible();
  await expect(drawer.getByText(targetsBn.kind.set, { exact: true })).toBeVisible();
  await expect(drawer.getByText(targetsBn.kind.cleared, { exact: true })).toBeVisible();
  await expect(drawer.getByText('“Area merged back, same as the others.”', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');

  // staff performance measures against the target
  await nav(page, staffBn.title);
  await expect(page.getByRole('columnheader', { name: staffBn.col.target })).toBeVisible();
});

test('data quality: problems per issue, the customers behind one, and the full list as a PDF', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, repBn.dq.title, S.customers);
  const listTitle = (k: keyof typeof repBn.dq.issue) => repBn.dq.listTitle.replace('{{issue}}', repBn.dq.issue[k].label);
  // opens on the issue with the most customers
  await expect(page.getByRole('heading', { name: listTitle('no_location') })).toBeVisible();

  await page.getByRole('button', { name: new RegExp(repBn.dq.issue.unassigned.label) }).click();
  await page.waitForURL(/issue=unassigned/);
  await expect(page.getByRole('heading', { name: listTitle('unassigned') })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody tr').filter({ hasText: repBn.dq.nobody })).toHaveCount(3);

  // the server's detail is shown when it carries data, here the other customers on the same number
  await page.getByRole('button', { name: new RegExp(repBn.dq.issue.shared_phone.label) }).click();
  await page.waitForURL(/issue=shared_phone/);
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.getByText(/Same number as/).first()).toBeVisible();

  // a row opens the customer
  await expect(page.locator('tbody tr').first().getByRole('link')).toHaveAttribute('href', /\/customers\/.+\//);

  await page.getByRole('link', { name: repBn.dq.download }).click();
  await page.waitForURL(/tab=exports/);
  await expect(page.getByLabel(repBn.exports.type)).toHaveValue('data_quality');
  await expect(page.getByLabel(repBn.exports.issue, { exact: true })).toHaveValue('shared_phone');
  await page.getByLabel(repBn.exports.format).selectOption('pdf');
  await expect(page.getByText(repBn.exports.pdfHelp)).toBeVisible();
  await page.getByRole('button', { name: repBn.exports.create }).click();
  const link = page.getByRole('link', { name: new RegExp(repBn.exports.download) });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await expect(link).toHaveAttribute('href', /data_quality\.pdf$/);
});

test('leaderboard: month ranking, switch the measure and the period, equal values share a rank', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, repBn.lb.title, S.staff);
  await expect(page.getByRole('list', { name: repBn.lb.top }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('columnheader', { name: repBn.lb.metric.collected }).first()).toBeVisible();
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('১');

  // promises kept: few distinct values, so people share ranks
  await page.getByRole('group', { name: repBn.lb.by }).getByRole('button', { name: repBn.lb.metric.promises_kept }).click();
  await page.waitForURL(/metric=promises_kept/);
  await expect(page.getByText(repBn.lb.tie, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(repBn.lb.how.promises_kept)).toBeVisible();

  // one day
  await page.getByRole('group', { name: repBn.lb.period }).getByRole('button', { name: repBn.lb.periods.day }).click();
  await page.waitForURL(/period=day/);
  await expect(page.getByLabel(repBn.lb.when)).toHaveAttribute('type', 'date');
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('collection board: verified money of everyone across branches, a crown on first place, all time and one month', async ({ page }) => {
  await login(page, 'manager');
  await nav(page, repBn.lb.title, S.staff);
  await page.getByRole('group', { name: repBn.lb.board.which }).getByRole('button', { name: repBn.lb.board.tabs.collection }).click();
  await page.waitForURL(/board=collection/);
  await expect(page.getByText(repBn.lb.board.subtitle)).toBeVisible();
  await expect(page.getByLabel(repBn.lb.board.month)).toHaveAttribute('type', 'month');

  // all time (the mock has a week of collections, so there is always somebody on top)
  await page.getByRole('group', { name: repBn.lb.period }).getByRole('button', { name: repBn.lb.board.periods.all }).click();
  await page.waitForURL(/span=all/);
  await expect(page.getByLabel(repBn.lb.board.month)).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: repBn.lb.board.posted })).toBeVisible();
  // a manager of one branch sees every branch on this board
  await expect(page.getByText(repBn.lb.board.scope.all, { exact: true })).toBeVisible();
  const first = page.locator('tbody tr').first();
  await expect(first.locator('td').first()).toContainText('১');
  await expect(first.getByRole('img', { name: repBn.lb.board.first })).toBeVisible();
  await expect(page.getByRole('list', { name: repBn.lb.top }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText(repBn.lb.board.how)).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

  // back to the ranking: its own controls return
  await page.getByRole('group', { name: repBn.lb.board.which }).getByRole('button', { name: repBn.lb.board.tabs.ranking }).click();
  await expect(page.getByRole('group', { name: repBn.lb.by })).toBeVisible();
});

