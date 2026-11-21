import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import actBn from '../../src/features/activity/i18n/bn.json' with { type: 'json' };
import colBn from '../../src/features/collections/i18n/bn.json' with { type: 'json' };
import { login } from '../fixtures';

/**
 * FR-W-050 (contract 1.33.0, master FR-COL-017): the office sees who voided a collection and how (withdrawn by the
 * collector or voided by the office), that a collection was edited and what it was before, and the activity feed
 * has the new lines. Checked by test ids and labels, so the journey does not depend on the language.
 */
test('a voided collection says who and how; an edited one says what it was; the feed filters the new lines', async ({ page }) => {
  await login(page);

  await page.goto('/collections/?status=voided&from=2020-01-01&to=2099-12-31');
  await expect(page.locator('tbody tr').first()).toContainText(/[A-Z]{3}\d{2}-FS/);
  await page.locator('tbody tr').first().click();
  const voided = page.getByTestId('voided-block');
  await expect(voided).toBeVisible();
  await expect(voided).toContainText(new RegExp(`${colBn.detail.voidKind.admin}|${colBn.detail.voidKind.withdrawn}`));
  await page.keyboard.press('Escape');

  // the list marks edited collections; the drawer says who changed it and what the amount was
  await page.goto('/collections/?from=2020-01-01&to=2099-12-31');
  const edited = page.locator('tbody tr').filter({ hasText: colBn.editedBadge }).first();
  await expect(edited).toContainText(/[A-Z]{3}\d{2}-FS/);
  await edited.click();
  const block = page.getByTestId('edited-block');
  await expect(block).toBeVisible();
  await expect(block).toContainText('৳');
  await page.keyboard.press('Escape');

  await page.goto('/activity/?type=collection_edited');
  const lines = page.locator('main ol > li');
  await expect(lines.first()).toContainText(actBn.line.collection_edited);
  await expect(page.getByRole('button', { name: actBn.type.collection_withdrawn, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: actBn.type.deposit_deleted, exact: true })).toBeVisible();

  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});
