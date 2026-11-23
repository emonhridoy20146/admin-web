import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import actBn from '../../src/features/activity/i18n/bn.json' with { type: 'json' };
import { login } from '../fixtures';

/** FR-W-046 (contract 1.28.0): what staff are doing, with its own bell that clears when the feed is opened. */
test('staff activity: the bell counts new lines, the feed names person and customer, filters by type and person, and opening it clears the bell', async ({ page }) => {
  await login(page);
  const bell = page.getByRole('link', { name: new RegExp(`^${actBn.bell}: `) });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole('heading', { level: 1, name: actBn.title })).toBeVisible();
  const lines = page.locator('main ol > li');
  await expect(lines.first()).toBeVisible();
  // the first line has a person (a button that filters) and a new mark
  await expect(lines.first().getByRole('img', { name: actBn.new })).toBeVisible();
  // opening the page cleared the bell
  // (the header bell and the nav entry both lose their count)
  await expect(page.getByRole('link', { name: new RegExp(`^${actBn.bell}: `) })).toHaveCount(0);
  await expect(page.getByRole('link', { name: actBn.bell, exact: true })).toHaveCount(2);

  await page.getByRole('button', { name: actBn.type.collection, exact: true }).click();
  await page.waitForURL(/type=collection/);
  await expect(lines.first()).toContainText(actBn.line.collection);
  await expect(lines.first().getByRole('link')).toHaveAttribute('href', /\/collections\/\?drawer=collection:/);

  // the person's name is a button that shows only their work
  await lines.first().getByRole('button').first().click();
  await page.waitForURL(/userId=/);
  // the staff filter (FR-W-063) now shows that person; every line is theirs
  const userId = new URL(page.url()).searchParams.get('userId')!;
  await expect(page.getByTestId('staff-select')).toHaveValue(userId);
  await expect(lines.first()).toBeVisible();
  const names = await lines.evaluateAll((els) => els.map((e) => e.querySelector('button')?.textContent?.trim() ?? ''));
  expect(new Set(names).size).toBe(1);

  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});
