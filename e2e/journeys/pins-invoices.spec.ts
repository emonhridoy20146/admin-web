import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import { login, nav } from '../fixtures';

// Owner request 2026-11-18 (contract 1.14.0, ADR-W18, FR-W-028): the map opens on Patuakhali district and moves
// freely, pins are coloured by payment state, the customer pages filter by installment / credit invoices and an
// invoice can be read line by line.

const atOf = (url: string) => {
  const v = new URL(url).searchParams.get('at');
  const [lat, lng, zoom] = (v ?? '').split(',').map(Number);
  return { lat: lat!, lng: lng!, zoom: zoom! };
};

async function waitForRows(page: Page) {
  await expect(page.locator('tbody tr a').first()).toBeVisible();
}

test('map: opens on Patuakhali district, keeps the place the user moved to, colour legend filters', async ({ page }) => {
  await login(page);
  await nav(page, custBn.map.title);
  await expect(page).toHaveURL(/[?&]at=/);
  const first = atOf(page.url());
  // Patuakhali district (not Barishal city at 22.70, 90.37)
  expect(first.lat).toBeGreaterThan(21.9);
  expect(first.lat).toBeLessThan(22.5);
  expect(first.zoom).toBeLessThan(13);

  // the user drags the map; it stays where they left it
  const map = page.getByRole('application', { name: custBn.map.title });
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 - 120, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => atOf(page.url()).lng).toBeLessThan(first.lng - 0.01);
  const moved = atOf(page.url());
  await page.waitForTimeout(1500);
  expect(atOf(page.url())).toEqual(moved);

  // legend = filter (several colours at once), invoice kind beside it
  const legend = page.getByRole('group', { name: custBn.pay.legend });
  await legend.getByRole('button', { name: new RegExp(custBn.pay.state.missed_many) }).click();
  await expect(page).toHaveURL(/pay=missed_many/);
  await legend.getByRole('button', { name: new RegExp(custBn.pay.state.bad) }).click();
  await expect(page).toHaveURL(/pay=missed_many%2Cbad|pay=missed_many,bad/);
  await page.getByRole('group', { name: custBn.invoiceKind.label }).getByRole('button', { name: custBn.invoiceKind.installment }).click();
  await expect(page).toHaveURL(/kind=installment/);
  await legend.getByRole('button', { name: custBn.pay.allColours }).click();
  await expect(page).not.toHaveURL(/pay=/);
});

test('map: Google-style pins coloured by payment state, list beside the map, a pin opens the customer', async ({ page }) => {
  await login(page);
  await page.goto('/map/?at=22.35960,90.32990,14');
  const pins = page.locator('.leaflet-marker-icon .fos-pin:not(.is-branch)'); // branch pins (FR-W-034) are not customers
  await expect(pins.first()).toBeVisible();
  expect(await pins.count()).toBeGreaterThan(5);
  // the worst first in the list, each with its colour badge in words
  const list = page.getByRole('region', { name: custBn.map.inView });
  await expect(list.getByRole('button').first()).toContainText(custBn.pay.state.bad);
  await page.locator('.leaflet-marker-icon:has(.fos-pin:not(.is-branch))').nth(3).click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/drawer=customer/);
  await expect(page.locator('.fos-pin.is-selected:not(.is-branch)')).toHaveCount(1);
});

test('customers: installment / credit invoice filter, colour filter, colour badge and open invoices per row', async ({ page }) => {
  await login(page);
  await nav(page, custBn.title);
  await waitForRows(page);
  await page.getByRole('group', { name: custBn.pay.legend }).getByRole('button', { name: new RegExp(custBn.pay.state.missed_one) }).click();
  await expect(page).toHaveURL(/pay=missed_one/);
  await waitForRows(page);
  await expect(page.locator('tbody tr').first()).toContainText(custBn.pay.missedN.replace('{{n}}', '১'));

  await page.getByRole('group', { name: custBn.pay.legend }).getByRole('button', { name: custBn.pay.allColours }).click();
  await page.getByRole('group', { name: custBn.invoiceKind.label }).getByRole('button', { name: custBn.invoiceKind.credit }).click();
  await expect(page).toHaveURL(/kind=credit/);
  await waitForRows(page);
  const rows = page.locator('tbody tr');
  const n = await rows.count();
  for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText(new RegExp(custBn.openInv.credit.replace('{{n}}', '[০-৯]+')));
});

test('invoice viewer: credit invoice terms, installment schedule with paid-on dates and receipts, Back closes it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await nav(page, custBn.title);
  await waitForRows(page);
  await page.getByRole('group', { name: custBn.invoiceKind.label }).getByRole('button', { name: custBn.invoiceKind.credit }).click();
  await waitForRows(page);
  await page.locator('tbody tr').first().click();
  await page.getByRole('dialog').getByRole('link', { name: custBn.openFull }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f]+\/$/);

  // overview card → the full invoice
  await page.getByRole('button', { name: custBn.invoice.openFull }).first().click();
  await expect(page).toHaveURL(/tab=invoices&invoice=|invoice=.+tab=invoices/);
  await expect(page.getByRole('heading', { level: 2, name: /^INV-/ })).toBeVisible();
  await page.getByRole('button', { name: custBn.invoice.back }).click();
  await expect(page).not.toHaveURL(/invoice=/);

  const tab = page.getByRole('tabpanel');
  await tab.getByRole('group', { name: custBn.invoiceKind.label }).getByRole('button', { name: new RegExp(custBn.invoiceKind.credit) }).click();
  await expect(page).toHaveURL(/invKind=credit/);
  await tab.getByRole('list', { name: custBn.tabs.invoices }).getByRole('button').first().click();
  await expect(page.getByRole('heading', { level: 2, name: /^INV-C/ })).toBeVisible();
  await expect(page.getByText(custBn.invoice.creditTitle)).toBeVisible();
  await expect(page.getByText(new RegExp(custBn.invoice.creditDue.replace('{{date}}', '.+')))).toBeVisible();
  await expect(page.getByText(custBn.invoice.leftErp)).toBeVisible();
  // a pushed history entry: the browser's Back returns to the list
  await page.goBack();
  await expect(page).not.toHaveURL(/invoice=/);

  await tab.getByRole('group', { name: custBn.invoiceKind.label }).getByRole('button', { name: new RegExp(custBn.invoiceKind.installment) }).click();
  await tab.getByRole('list', { name: custBn.tabs.invoices }).getByRole('button').first().click();
  const schedule = page.getByRole('table', { name: new RegExp(custBn.invoice.schedule) });
  await expect(schedule).toBeVisible();
  await expect(schedule.getByRole('columnheader', { name: custBn.invoice.paidOnCol })).toBeVisible();
  await expect(schedule.getByText(/^PAY-\d{8}-\d{5}$/).first()).toBeVisible();
  await expect(page.getByText(custBn.invoice.terms)).toBeVisible();
  await expect(page.getByRole('button', { name: /PDF/ })).toBeVisible();

  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== 'running'));
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});
