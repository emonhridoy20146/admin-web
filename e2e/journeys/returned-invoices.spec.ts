import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import commonEn from '../../src/shared/i18n/common.en.json' with { type: 'json' };
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import { login } from '../fixtures';

/**
 * FR-W-074 (owner request 2026-11-26; contract 1.53.0, field-api FR-CUS-024 / ADR-071): invoices returned in the ERP are
 * shown again, marked, and never counted. Mock data: the customer with mixed invoices owns the returned invoice
 * INV-91018 next to counted ones; "রহিমা খাতুন" has only the returned invoice INV-R77001.
 *
 * Owner decision 2026-11-26 (reverses the coordinator's choice in PR #44, ADR-W31): as in the staff app, an only-returned
 * customer's row, card, map pin and ⌘K hit do not open; they stay listed with the marker and say why. A mixed customer
 * still opens everywhere; a direct `/customers/{id}/` link still works.
 */
const MIXED_INVOICE = 'INV-91018';
const ONLY_NAME = 'রহিমা খাতুন';
const ONLY_INVOICE = 'INV-R77001';

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity));
}
async function seriousAxe(page: Page, include?: string) {
  let b = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  if (include) b = b.include(include);
  const r = await b.analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`);
}
/** The customer rows: the table at ≥ 640 px, the card list below. */
const listOf = (page: Page, width: number): Locator => (width < 640 ? page.locator('ul.sm\\:hidden > li') : page.locator('table tbody tr'));
/** Opens the first row: the card's open button below 640 px (data-card-open, #43), the table row above. */
async function openRow(rows: Locator, width: number) {
  if (width < 640) await rows.first().locator('button[data-card-open]').click();
  else await rows.first().click({ position: { x: 8, y: 8 } });
}
/** The customer's id, from the table row (rendered at every width; hidden below 640 px). */
const rowId = async (page: Page) => (await page.locator('table tbody tr').first().getAttribute('data-row-key'))!;

for (const width of [390, 1440]) {
  test.describe(`returned invoices at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 640 ? 844 : 900 } });

    test('mixed customer: "Returned ×1" in the list; returned section, viewer, payments and timeline marked; axe clean', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await login(page);
      // a returned invoice number finds its customer (1.53.0)
      await page.goto(`/customers/?q=${MIXED_INVOICE}`);
      const rows = listOf(page, width);
      await expect(rows).toHaveCount(1);
      const mark = rows.first().getByTestId('returned-mark');
      await expect(mark).toHaveAttribute('data-status', 'returned_count');
      await expect(mark).toHaveText(commonBn.status.returned_count.replace('{{n}}', '১'));
      await expect(mark.locator('svg')).toHaveCount(1);
      await settle(page);
      expect(await seriousAxe(page)).toEqual([]);

      // a mixed customer still opens: the row (≥ 640 px) or the card's open button (< 640 px) opens the drawer
      await expect(rows.first()).not.toHaveAttribute('aria-disabled', 'true');
      await openRow(rows, width);
      await expect(page).toHaveURL(/drawer=customer/);
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      const href = await rows.first().locator('a[href^="/customers/"]').first().getAttribute('href');
      expect(href).toBeTruthy();
      await page.goto(`${href}?tab=invoices`);
      const section = page.getByTestId('returned-invoices');
      await expect(section.getByRole('heading', { name: custBn.returned.title })).toBeVisible();
      const inv = section.getByTestId('returned-invoice').filter({ hasText: MIXED_INVOICE });
      await expect(inv.getByTestId('returned-chip')).toHaveText(commonBn.status.returned);
      await expect(inv.getByTestId('returned-payment').first()).toBeVisible();
      // counted invoices are still listed above, and the filter counts leave the returned one out
      await expect(page.getByRole('list', { name: custBn.tabs.invoices }).getByText(MIXED_INVOICE)).toHaveCount(0);
      await settle(page);
      expect(await seriousAxe(page)).toEqual([]);

      // the same viewer, returned mode: chip, note, its payments, no collect action
      await inv.getByRole('button', { name: new RegExp(custBn.invoice.openFull) }).click();
      await expect(page.getByRole('heading', { name: MIXED_INVOICE })).toBeVisible();
      await expect(page.getByTestId('returned-note')).toHaveText(custBn.returned.viewerNote);
      await expect(page.getByRole('table', { name: custBn.invoice.payments }).getByTestId('returned-payment-tag').first()).toBeVisible();
      await expect(page.getByRole('table', { name: custBn.invoice.schedule })).toHaveCount(0);
      await settle(page);
      expect(await seriousAxe(page, 'article')).toEqual([]);

      // main payment list and timeline: payments to the returned invoice carry the tag
      await page.goto(`${href}?tab=payments`);
      await expect(page.locator('tr[data-returned="true"]').first().getByTestId('returned-payment-tag')).toHaveText(commonBn.status.returned_payment);
      await page.goto(`${href}?tab=timeline`);
      const tagged = page.getByTestId('returned-payment-tag').first();
      await expect(tagged).toBeVisible();
      await expect(tagged.locator('xpath=ancestor::li[1]')).toContainText('ফেরত চালান');
      await settle(page);
      expect(await seriousAxe(page)).toEqual([]);
    });

    test('only-returned customer: marker everywhere, never opens from row, card, pin or ⌘K; direct link works', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await login(page);
      await page.goto(`/customers/?q=${encodeURIComponent(ONLY_NAME)}`);
      const rows = listOf(page, width);
      await expect(rows).toHaveCount(1);
      const row = rows.first();
      const mark = row.getByTestId('returned-mark');
      await expect(mark).toHaveAttribute('data-status', 'only_returned');
      await expect(mark).toHaveText(commonBn.status.only_returned);

      // owner decision 2026-11-26: the row / card stays listed, says why, and does not open
      const box = width < 640 ? row.locator('[data-inert="true"]') : row;
      await expect(box).toHaveAttribute('aria-disabled', 'true');
      await expect(box).toHaveAttribute('title', commonBn.status.only_returned_hint);
      await expect(row.locator('button[data-card-open]')).toHaveCount(0);
      await expect(row.locator('a[href^="/customers/"]')).toHaveCount(0);
      if (width >= 640) await expect(row).not.toHaveAttribute('tabindex');
      await row.click({ position: { x: 8, y: 8 }, force: true });
      await row.getByTestId('returned-mark').click({ force: true });
      await page.waitForTimeout(300);
      await expect(page).not.toHaveURL(/drawer=customer/);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // keyboard: Tab never lands on the row or card as an action (no row focus, no open button, no customer link);
      // the cells' own info tooltips (work marks) stay reachable, and Enter on them opens nothing
      await page.locator('body').focus();
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const where = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return 'none';
          if (el.matches('[data-inert]')) return 'row';
          if (el.closest('[data-inert]') && el.matches('button[data-card-open], a[href^="/customers/"]')) return 'open';
          return el.closest('[data-inert]') ? 'inside' : 'outside';
        });
        expect(where).not.toBe('row');
        expect(where).not.toBe('open');
        if (where === 'inside') {
          await page.keyboard.press('Enter');
          await expect(page).not.toHaveURL(/drawer=customer/);
        }
      }
      await expect(page).not.toHaveURL(/drawer=customer/);
      await settle(page);
      expect(await seriousAxe(page)).toEqual([]);

      // the reason in English too (Bangla is one tap away; English is the default)
      expect(commonEn.status.only_returned_hint).toBe('Returned product customer: no open invoices');

      // GET /customers/{id} is untouched: a direct link still opens the page, nothing counted, the returned invoice apart
      const id = await rowId(page);
      await page.goto(`/customers/${id}/?tab=invoices`);
      await expect(page.getByTestId('returned-invoice').filter({ hasText: ONLY_INVOICE })).toBeVisible();
      await expect(page.getByText(custBn.invoice.none)).toHaveCount(0);

      // map: the pin has the corner mark and takes no click; the list item says why and is not a button
      await page.goto('/map/?at=22.70620,90.37360,16');
      const item = page.getByRole('region', { name: custBn.map.inView }).getByRole('listitem').filter({ hasText: ONLY_NAME });
      await expect(item.getByTestId('returned-mark')).toHaveText(commonBn.status.only_returned);
      await expect(item.getByRole('button')).toHaveCount(0);
      const inertItem = item.locator('[data-inert="true"]');
      await expect(inertItem).toHaveAttribute('aria-disabled', 'true');
      await expect(inertItem).toHaveAttribute('title', commonBn.status.only_returned_hint);
      await inertItem.click({ force: true });
      const pin = page.locator('.leaflet-marker-icon.fos-marker-inert').first();
      await expect(pin).toHaveAttribute('aria-disabled', 'true');
      await expect(pin.locator('.fos-pin-corner')).toBeAttached();
      await pin.click({ force: true });
      await page.waitForTimeout(300);
      await expect(page).not.toHaveURL(/drawer=customer/);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // a pin that opens (another customer in view) still does
      await expect(page.locator('.leaflet-marker-icon:not(.fos-marker-inert) .fos-pin').first()).toBeAttached();
      await settle(page);
      expect(await seriousAxe(page, 'section')).toEqual([]);

      // ⌘K: the returned invoice number finds the customer, with the marker; the hit is disabled and does not open
      await page.getByRole('button', { name: commonBn.search.placeholder }).first().click();
      const palette = page.getByRole('dialog');
      await palette.getByRole('combobox').fill(ONLY_INVOICE);
      const hit = palette.locator('[cmdk-item]').filter({ hasText: ONLY_NAME });
      await expect(hit.getByTestId('returned-mark')).toHaveText(commonBn.status.only_returned);
      await expect(hit).toHaveAttribute('aria-disabled', 'true');
      await expect(hit).toHaveAttribute('title', commonBn.status.only_returned_hint);
      await settle(page);
      expect(await seriousAxe(page, '[role=dialog]')).toEqual([]);
      const before = page.url();
      await hit.click({ force: true });
      await palette.getByRole('combobox').press('Enter');
      await page.waitForTimeout(300);
      expect(page.url()).toBe(before);
      await expect(page).not.toHaveURL(/\/customers\/[^/]+\/$/);
    });

    test('mixed customer: the ⌘K hit still opens the customer page', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await login(page);
      await page.getByRole('button', { name: commonBn.search.placeholder }).first().click();
      const palette = page.getByRole('dialog');
      await palette.getByRole('combobox').fill(MIXED_INVOICE);
      const hit = palette.locator('[cmdk-item]').filter({ has: page.getByTestId('returned-mark') }).first();
      await expect(hit.getByTestId('returned-mark')).toHaveAttribute('data-status', 'returned_count');
      await expect(hit).not.toHaveAttribute('aria-disabled', 'true');
      await hit.click();
      await expect(page).toHaveURL(/\/customers\/[^/]+\/$/);
    });
  });
}
