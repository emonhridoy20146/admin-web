import { expect, test } from '@playwright/test';
import placesBn from '../../src/features/places/i18n/bn.json' with { type: 'json' };
import { login } from '../fixtures';

/** FR-PLC-001..006: the manager decides two move requests, adds a place, renames one and removes it. */
test('places: reject and approve move requests, add, rename and remove a place (FR-PLC-002..006)', async ({ page }) => {
  await login(page, 'manager');
  await page.goto('/places/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(placesBn.title);
  const rows = page.locator('tbody tr');
  await expect(rows.filter({ hasText: 'করিম স্টোর' })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'পটুয়াখালী বাস স্ট্যান্ড' })).toHaveCount(0); // another branch
  await expect(rows.filter({ hasText: 'নতুন বাজার' })).toContainText(placesBn.status.movePending);
  const dialog = () => page.getByRole('dialog').last();

  // the queue: two requests, the oldest first
  await page.getByRole('link', { name: new RegExp(placesBn.moves.link) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(placesBn.moves.title);
  const cards = page.getByRole('list', { name: placesBn.moves.title }).locator('> li');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('নতুন বাজার');
  await expect(cards.first()).toContainText('বাজারের মূল গেট রাস্তার ওপারে');

  // reject needs a reason of at least 5 characters
  await cards.first().getByRole('button', { name: placesBn.actions.reject }).click();
  await dialog().locator('textarea').fill('না');
  await dialog().getByRole('button', { name: placesBn.reject.confirm }).click();
  await expect(dialog().getByRole('heading', { name: placesBn.reject.title })).toBeVisible();
  await dialog().locator('textarea').fill('গেট এই পাশেই, আমি নিজে দেখেছি');
  await dialog().getByRole('button', { name: placesBn.reject.confirm }).click();
  await expect(cards).toHaveCount(1);

  // approve the other one
  await cards.first().getByRole('button', { name: placesBn.actions.approve }).click();
  await dialog().getByRole('button', { name: placesBn.approve.confirm }).click();
  await expect(page.getByText(placesBn.moves.empty)).toBeVisible();

  // add a place: name, kind, note; it opens in the drawer
  await page.goto('/places/');
  await page.getByRole('button', { name: placesBn.new }).click();
  await dialog().getByLabel(placesBn.form.name).fill('আলিফ মডেল স্কুল');
  await dialog().getByRole('radio', { name: placesBn.icon.school }).click();
  await dialog().getByLabel(placesBn.form.note).fill('মসজিদের পেছনের গলি');
  await dialog().getByRole('button', { name: placesBn.dialog.create }).click();
  await expect(dialog().getByRole('heading', { name: 'আলিফ মডেল স্কুল' })).toBeVisible();
  await expect(dialog().getByText('মসজিদের পেছনের গলি')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(rows.filter({ hasText: 'আলিফ মডেল স্কুল' })).toHaveCount(1);

  // rename a staff member's place, then remove it with a reason; it moves to the removed list
  await rows.filter({ hasText: 'করিম স্টোর' }).locator('td').first().getByRole('button').click();
  await dialog().getByRole('button', { name: placesBn.actions.edit }).click();
  await dialog().getByLabel(placesBn.form.name).fill('করিম জেনারেল স্টোর');
  await dialog().getByRole('button', { name: placesBn.dialog.save }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'করিম জেনারেল স্টোর' })).toBeVisible();
  await dialog().getByRole('button', { name: placesBn.actions.delete }).click();
  await dialog().getByLabel(placesBn.delete.reason).fill('দোকানটি বন্ধ হয়ে গেছে');
  await dialog().getByRole('button', { name: placesBn.delete.confirm }).click();
  await expect(rows.filter({ hasText: 'করিম জেনারেল স্টোর' })).toHaveCount(0);
  await page.getByRole('group', { name: placesBn.show }).getByRole('button', { name: placesBn.show_deleted }).click();
  await expect(rows.filter({ hasText: 'করিম জেনারেল স্টোর' })).toContainText(placesBn.status.deleted);
});

test('places on the customer map: names next to the markers, the layer can be switched off (FR-PLC-001)', async ({ page }) => {
  await login(page, 'manager');
  await page.goto('/map/?at=22.70300,90.37000,16');
  const label = page.locator('.fos-map-label', { hasText: 'বাইতুল আমান জামে মসজিদ' });
  await expect(label).toBeVisible();
  await page.getByRole('button', { name: placesBn.layer, exact: true }).click();
  await expect(label).toHaveCount(0);
});
