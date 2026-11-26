import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import tagsBn from '../../src/features/tags/i18n/bn.json' with { type: 'json' };
import { confirmWithReason, login } from '../fixtures';

/**
 * FR-W-072 (owner request 2026-11-26): a customer tagged bad or legal has a border in the colour of its reason
 * (03 §2.3b), with a reason chip next to the name, in the table (≥ 640 px) and the card list (< 640 px).
 */
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

/** The colour a token resolves to on this page, as the browser writes it (rgb(...)). */
async function tokenColour(page: Page, cssVar: string) {
  return page.evaluate((v) => {
    const el = document.createElement('span');
    el.style.color = `var(${v})`;
    document.body.append(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }, cssVar);
}

for (const width of [390, 1440]) {
  test.describe(`bad-tag border at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 640 ? 844 : 900 } });

    test('tagged customers show a reason-coloured border and chip; axe clean', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await login(page);
      await page.goto('/customers/?filter=tagged_bad');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const scope = width < 640 ? page.locator('ul.sm\\:hidden') : page.locator('table');
      const bordered = scope.locator('[data-tag-border="true"]');
      await expect(bordered.first()).toBeVisible();

      // the absconded customer: strongest border, its own colour, chip "পলাতক"
      const absconded = bordered.filter({ has: page.locator('[data-tag="absconded"]') }).first();
      await expect(absconded).toBeVisible();
      await expect(absconded.getByTestId('tag-chip')).toHaveText(commonBn.tagLook.absconded);
      const colour = await tokenColour(page, '--st-tag-absconded');
      if (width < 640) {
        const s = await absconded.evaluate((el) => { const c = getComputedStyle(el); return { w: parseFloat(c.borderInlineStartWidth), c: c.borderInlineStartColor, top: c.borderTopColor }; });
        expect(s.w).toBeGreaterThanOrEqual(4);
        expect(s.c).toBe(colour);
        expect(s.top).toBe(colour);
      } else {
        const shadow = await absconded.locator('td').first().evaluate((el) => getComputedStyle(el).boxShadow);
        expect(shadow).toContain(colour);
        expect(shadow).toMatch(/inset/);
      }

      // a legal tag has its own colour, different from absconded and from the generic bad colour
      const legal = bordered.filter({ has: page.locator('[data-tag="legal"]') }).first();
      await expect(legal.getByTestId('tag-chip')).toHaveText(commonBn.tagLook.legal);
      expect(await tokenColour(page, '--st-tag-legal')).not.toBe(colour);
      expect(await tokenColour(page, '--st-tag-bad')).not.toBe(colour);

      await settle(page);
      // Known, older than this change and not caused by it (reported in the PR): below 640 px the DataTable card is a
      // role=button that holds the name link (axe nested-interactive, on every card). Everything else must be clean.
      expect((await seriousAxe(page)).filter((v) => !(width < 640 && v.startsWith('nested-interactive')))).toEqual([]);

      // the drawer header carries the same border and chip
      await absconded.click();
      const header = page.locator('[data-drawer-header]');
      await expect(header.getByTestId('tag-chip')).toHaveText(commonBn.tagLook.absconded);
      await expect(header).toHaveClass(/fos-tag--absconded/);
      expect(await header.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(colour);
      await settle(page);
      // the header this change draws (the drawer body has an older definition-list finding, reported in the PR)
      expect(await seriousAxe(page, '[data-drawer-header]')).toEqual([]);
    });
  });
}

test('the tag dialog shows each reason with its colour; tagging borders the customer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/customers/?filter=overdue');
  const rows = page.locator('tbody tr:not([data-tag-border])');
  await expect(rows.first()).toBeVisible();
  // the first overdue customer that is not tagged yet (watch tags have no border but cannot be tagged again)
  const hrefs = await Promise.all((await rows.all()).slice(0, 8).map((r) => r.getByRole('link').first().getAttribute('href')));
  const tagBtn = page.getByRole('button', { name: tagsBn.tagAction });
  let found = false;
  for (const href of hrefs) {
    await page.goto(`${href}?tab=tag`);
    await tagBtn.or(page.getByRole('button', { name: tagsBn.untagAction })).first().waitFor();
    found = await tagBtn.isVisible();
    if (found) break;
  }
  expect(found).toBe(true);
  await expect(page.locator('header[data-tag-border]')).toHaveCount(0);
  await page.getByRole('button', { name: tagsBn.tagAction }).click();

  const dialog = page.getByRole('dialog');
  const options = dialog.getByTestId('reason-options').locator('label[data-code]');
  await expect(options).toHaveCount(6);
  for (const o of await options.all()) {
    const code = (await o.getAttribute('data-code'))!;
    const cssVar = `--st-tag-${code.replace(/_/g, '-')}`;
    const colour = await tokenColour(page, cssVar);
    expect(await o.evaluate((el) => getComputedStyle(el).borderInlineStartColor)).toBe(colour);
    expect(await o.getByTestId('reason-swatch').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(colour);
  }
  await dialog.getByRole('radio', { name: tagsBn.codes.absconded }).check();
  await expect(dialog.getByTestId('tag-preview').getByTestId('tag-chip')).toHaveText(commonBn.tagLook.absconded);
  await settle(page);
  expect(await seriousAxe(page, '[role=dialog]')).toEqual([]);

  await confirmWithReason(page, 'Left the village with the fridge, phone off for weeks.', tagsBn.tagAction);
  const header = page.locator('header[data-tag-border="true"]');
  await expect(header).toBeVisible();
  await expect(header.getByTestId('tag-chip')).toHaveText(commonBn.tagLook.absconded);
});
