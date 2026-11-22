import { expect, test, type Page } from '@playwright/test';
import staffBn from '../../src/features/staff/i18n/bn.json' with { type: 'json' };
import repBn from '../../src/features/reports/i18n/bn.json' with { type: 'json' };
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import cashBn from '../../src/features/cash/i18n/bn.json' with { type: 'json' };
import promBn from '../../src/features/promises/i18n/bn.json' with { type: 'json' };
import custBn from '../../src/features/customers/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { login, nav } from '../fixtures';

/** FR-REP-003 / OD-26: a report printed to PDF has no app chrome, a masthead, and the Bangla font embedded (shaped by the browser). */
async function expectPrintablePdf(page: Page) {
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('print-masthead')).toBeVisible();
  await expect(page.locator('aside').first()).toBeHidden();
  await expect(page.locator('header').first()).toBeHidden();
  await expect(page.getByRole('button', { name: commonBn.print.button })).toBeHidden();
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  expect(pdf.byteLength).toBeGreaterThan(20_000);
  // the subset font name is written in the PDF's font dictionary
  expect(pdf.toString('latin1')).toMatch(/Noto-?Sans-?Bengali/);
  return pdf;
}

test('staff performance and reports print to a Bangla PDF with every column and no app chrome', async ({ page }) => {
  await login(page);
  await nav(page, staffBn.title);
  await expect(page.locator('tbody tr button').first()).toBeVisible();
  await expect(page.getByRole('button', { name: commonBn.print.button })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  // low-priority columns that hide on narrow screens are printed
  await expect(page.getByRole('columnheader', { name: staffBn.col.field })).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await expectPrintablePdf(page);

  await nav(page, repBn.title);
  await expect(page.getByRole('button', { name: commonBn.print.button })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.emulateMedia({ media: 'print' });
  // the chart's data table is what goes on paper
  await expect(page.locator('main table').first()).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await expectPrintablePdf(page);

  // the downloads tab explains how to get a PDF and has no print button of its own
  await page.getByRole('button', { name: repBn.tabs.exports, exact: true }).click();
  await expect(page.getByText(repBn.pdf.title)).toBeVisible();
  await expect(page.getByRole('button', { name: commonBn.print.button })).toHaveCount(0);
});

test('the list pages print too: collections, cash on hand and promises have the PDF / print button and print without app chrome (FR-W-045)', async ({ page }) => {
  await login(page);
  for (const title of [colBn.title, cashBn.title, promBn.title]) {
    await nav(page, title);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('button', { name: commonBn.print.button })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectPrintablePdf(page);
  }
});


/** FR-W-051: paper carries the data, not the controls. */
async function expectNoControlsOnPaper(page: Page) {
  await page.emulateMedia({ media: 'print' });
  const left = await page.evaluate(() => {
    const seen = (el: Element) => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0;
    };
    const q = (sel: string) => [...document.querySelectorAll(sel)].filter(seen).length;
    return {
      actionButtons: q("main [data-ui='button']:not([data-variant='link'])"),
      searchBoxes: q("main input[type='search']"),
      selects: q('main select'),
      unchosenChips: q("main [data-ui='chip'][aria-pressed='false']"),
      checkboxes: q("main [role='checkbox']"),
      rows: q('main tbody tr'),
    };
  });
  await page.emulateMedia({ media: 'screen' });
  expect(left).toMatchObject({ actionButtons: 0, searchBoxes: 0, selects: 0, unchosenChips: 0, checkboxes: 0 });
  return left;
}

test('every list prints its data without buttons, search boxes, filters or checkboxes (FR-W-051)', async ({ page }) => {
  await login(page);
  for (const title of [custBn.title, colBn.title, cashBn.title, promBn.title]) {
    await nav(page, title);
    await expect(page.locator('main tbody tr').first()).toBeVisible();
    const left = await expectNoControlsOnPaper(page);
    // the rows themselves are still there
    expect(left.rows).toBeGreaterThan(0);
  }
});
