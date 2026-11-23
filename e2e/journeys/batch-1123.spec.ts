import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import promBn from '../../src/features/promises/i18n/bn.json' with { type: 'json' };
import prosBn from '../../src/features/prospects/i18n/bn.json' with { type: 'json' };
import dashBn from '../../src/features/dashboard/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { login, nav, pickRange } from '../fixtures';

// Owner requests 2026-11-23 (batch 1123) on field-api contract 1.45.0: FR-W-060..066.

const bnNum = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);

async function axe(page: Page) {
  // as the other journeys: WCAG 2 A/AA, serious and critical. The pointer leaves the table first: a hovered row's
  // tertiary text on --surface-hover is a token-level contrast question for the shared tokens (reported, not this batch).
  await page.mouse.move(1, 1);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('customers: 100 per page by default, numbered pages, jump and back, 500 per page; sort shares the chip row', async ({ page }) => {
  await login(page);
  await nav(page, custBn.title);
  const pager = page.getByTestId('pager');
  await expect(pager.getByTestId('pager-range')).toHaveText(commonBn.table.showing.replace('{{total}}', bnNum(400)).replace('{{first}}', bnNum(1)).replace('{{last}}', bnNum(100)));
  await expect(page.locator('tbody tr')).toHaveCount(100);
  // the sort is in the same row as the filter chips
  const chipRow = page.getByRole('button', { name: custBn.filters.overdue }).locator('..');
  await expect(chipRow.getByTestId('customer-sort')).toBeVisible();

  await pager.getByRole('button', { name: commonBn.table.goTo.replace('{{n}}', bnNum(3)) }).click();
  await expect(page).toHaveURL(/page=3/);
  await expect(pager.getByTestId('pager-range')).toContainText(bnNum(201));
  await expect(pager.getByRole('button', { name: commonBn.table.current.replace('{{n}}', bnNum(3)) })).toHaveAttribute('aria-current', 'page');
  await pager.getByRole('button', { name: commonBn.table.last }).click();
  await expect(page).toHaveURL(/page=4/);
  await expect(pager.getByRole('button', { name: commonBn.table.next })).toBeDisabled();
  await pager.getByRole('button', { name: commonBn.table.first }).click();
  await expect(page).not.toHaveURL(/page=/);

  await pager.getByRole('combobox').selectOption('500');
  await expect(page).toHaveURL(/size=500/);
  await expect(page.locator('tbody tr')).toHaveCount(400);
  await expect(pager.getByRole('button', { name: commonBn.table.next })).toBeDisabled();
  await axe(page);
});

test('customer map: full screen and back with the button and with Esc', async ({ page }) => {
  await login(page);
  await nav(page, custBn.map.title);
  const box = page.getByTestId('map-box');
  await page.getByRole('button', { name: commonBn.map.fullscreen }).click();
  await expect(box).toHaveAttribute('data-fullscreen', 'true');
  const size = await box.boundingBox();
  expect(size!.width).toBeGreaterThan(1400);
  await page.getByRole('button', { name: commonBn.map.exitFullscreen }).click();
  await expect(box).not.toHaveAttribute('data-fullscreen', 'true');
  await page.getByRole('button', { name: commonBn.map.fullscreen }).click();
  await expect(box).toHaveAttribute('data-fullscreen', 'true');
  await page.keyboard.press('Escape');
  await expect(box).not.toHaveAttribute('data-fullscreen', 'true');
});

test('date filter: a preset and a custom range land in the link and narrow the visits', async ({ page }) => {
  await login(page);
  await nav(page, /^ভিজিট$/);
  const trigger = page.getByTestId('date-range');
  await expect(page.locator('tbody, ul[aria-label]').first()).toBeVisible();
  await pickRange(page, commonBn.range['7d']);
  await expect(page).toHaveURL(/range=7d/);
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(commonBn.range.from).fill('2026-11-10');
  await dialog.getByLabel(commonBn.range.to).fill('2026-11-12');
  await dialog.getByRole('button', { name: commonBn.range.apply }).click();
  await expect(page).toHaveURL(/from=2026-11-10&to=2026-11-12/);
  await expect(trigger).toContainText(commonBn.range.custom);
  await axe(page);
});

test('promise follow-up: broken without a follow-up, make the next promise, see the chain', async ({ page }) => {
  await login(page);
  await nav(page, promBn.title);
  await pickRange(page, commonBn.range.all);
  await page.getByRole('button', { name: promBn.followUp.filter }).click();
  await expect(page).toHaveURL(/nofollow=1/);
  await expect(page.locator('tbody tr').first()).toContainText(promBn.followUp.none);
  await page.locator('tbody tr').first().getByRole('button').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(promBn.chain.title)).toBeVisible();
  await drawer.getByRole('button', { name: promBn.followUp.action }).click();
  const dlg = page.getByRole('dialog', { name: promBn.followUp.title });
  await dlg.locator('input[type=number]').fill('1500');
  await dlg.getByRole('button', { name: new RegExp(promBn.followUp.confirm) }).click();
  await expect(dlg).toBeHidden();
  // the drawer now shows the new promise as attempt 2 of the chain
  const steps = page.getByRole('dialog').getByRole('list', { name: promBn.chain.title }).getByRole('listitem');
  await expect(steps).toHaveCount(2);
  await expect(steps.nth(1)).toContainText(promBn.chain.attempt.replace('{{n}}', bnNum(2)));
  await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step');
  await axe(page);
});

test('possible customers: filter, open, mark contacted, convert to a customer, re-open', async ({ page }) => {
  await login(page);
  await nav(page, prosBn.title);
  await expect(page.getByTestId('prospect-total')).toContainText(bnNum(46));
  await page.getByRole('group', { name: prosBn.col.status }).getByRole('button', { name: prosBn.status.new, exact: true }).click();
  await expect(page).toHaveURL(/status=new/);
  await page.locator('tbody tr').first().click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('button', { name: prosBn.act.contacted }).click();
  await expect(page.getByTestId('prospect-history')).toContainText(prosBn.status.contacted);

  await drawer.getByRole('button', { name: prosBn.act.convert }).click();
  const conv = page.getByRole('dialog', { name: prosBn.convert.title });
  await conv.getByRole('button', { name: prosBn.convert.byCode }).click();
  await conv.getByLabel(prosBn.convert.code).fill('BRL01-100001');
  await conv.getByRole('button', { name: prosBn.convert.confirm }).click();
  await expect(conv).toBeHidden();
  await expect(page.getByTestId('prospect-history')).toContainText(prosBn.status.converted);

  await page.getByRole('dialog').getByRole('button', { name: prosBn.act.reopen }).click();
  const reason = page.getByRole('dialog', { name: prosBn.reopenTitle });
  await reason.locator('textarea').fill('Customer came back');
  await reason.getByRole('button', { name: prosBn.act.reopen }).click();
  await expect(reason).toBeHidden();
  await expect(page.getByTestId('prospect-history').locator('li').first()).toContainText(prosBn.status.new);
  await axe(page);
});

test('dashboard: period section with links to the lists, modules-off card', async ({ page }) => {
  await login(page);
  await expect(page.getByTestId('kpi-strip')).toBeVisible();
  await expect(page.getByTestId('modules-off')).toContainText(dashBn.modulesOff.action);
  const period = page.getByTestId('period');
  await expect(period.getByRole('heading', { name: dashBn.period.title })).toBeVisible();
  await period.getByRole('link', { name: new RegExp(dashBn.period.noFollowUp.replace('{{n}}', '[০-৯]+')) }).click();
  await expect(page).toHaveURL(/\/promises\/\?.*nofollow=1/);
  await expect(page.getByRole('button', { name: promBn.followUp.filter })).toHaveAttribute('aria-pressed', 'true');
});

test('pin approvals: 20 cards per page', async ({ page }) => {
  await login(page);
  await nav(page, custBn.pins.title);
  await page.getByRole('group', { name: custBn.pins.status }).getByRole('button', { name: custBn.pins.tab.approved }).click();
  const cards = page.locator('main ul.grid > li');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(20);
});
