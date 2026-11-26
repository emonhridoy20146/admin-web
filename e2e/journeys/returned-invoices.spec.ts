import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import { login } from '../fixtures';

/**
 * FR-W-074 (owner request 2026-11-26; contract 1.53.0, field-api FR-CUS-024 / ADR-071): invoices returned in the ERP are
 * shown again, marked, and never counted. Mock data: the customer with mixed invoices owns the returned invoice
 * INV-91018 next to counted ones; "রহিমা খাতুন" has only the returned invoice INV-R77001.
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

    test('only-returned customer: marker in the list and the map, stays clickable in admin; found by ⌘K invoice search', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await login(page);
      await page.goto(`/customers/?q=${encodeURIComponent(ONLY_NAME)}`);
      const rows = listOf(page, width);
      await expect(rows).toHaveCount(1);
      const mark = rows.first().getByTestId('returned-mark');
      await expect(mark).toHaveAttribute('data-status', 'only_returned');
      await expect(mark).toHaveText(commonBn.status.only_returned);
      // coordinator decision 2026-11-26: in admin the row stays clickable (the staff app does not open it)
      // < 640 px: the card's one open button (data-card-open, #43); ≥ 640 px: the table row
      if (width < 640) await rows.first().locator('button[data-card-open]').click();
      else await rows.first().click({ position: { x: 8, y: 8 } });
      await expect(page).toHaveURL(/drawer=customer/);
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');

      // the customer page: nothing counted, the returned invoice listed apart
      const href = await rows.first().locator('a[href^="/customers/"]').first().getAttribute('href');
      await page.goto(`${href}?tab=invoices`);
      await expect(page.getByTestId('returned-invoice').filter({ hasText: ONLY_INVOICE })).toBeVisible();
      await expect(page.getByText(custBn.invoice.none)).toHaveCount(0);

      // map: the pin has the corner mark and the list says "returned product customer"
      await page.goto('/map/?at=22.70620,90.37360,16');
      const item = page.getByRole('region', { name: custBn.map.inView }).getByRole('listitem').filter({ hasText: ONLY_NAME });
      await expect(item.getByTestId('returned-mark')).toHaveText(commonBn.status.only_returned);
      await expect(page.locator('.fos-pin .fos-pin-corner').first()).toBeAttached();
      await settle(page);
      expect(await seriousAxe(page, 'section')).toEqual([]);

      // ⌘K: the returned invoice number finds the customer, with the marker; the hit still opens
      await page.getByRole('button', { name: commonBn.search.placeholder }).first().click();
      const palette = page.getByRole('dialog');
      await palette.getByRole('combobox').fill(ONLY_INVOICE);
      const hit = palette.locator('[cmdk-item]').filter({ hasText: ONLY_NAME });
      await expect(hit.getByTestId('returned-mark')).toHaveText(commonBn.status.only_returned);
      await settle(page);
      expect(await seriousAxe(page, '[role=dialog]')).toEqual([]);
      await hit.click();
      await expect(page).toHaveURL(/\/customers\/[^/]+\/$/);
    });
  });
}
