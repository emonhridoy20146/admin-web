import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from '../fixtures';

const PAGES = ['/', '/handovers/', '/map/', '/pin-approvals/', '/areas/', '/live/', '/routes/', '/promises/', '/visits/', '/visits/?kind=joint&range=30d', '/cowork/?range=30d', '/attendance/', '/staff/', '/reports/', '/reports/?tab=reconciliation', '/reports/?tab=exports', '/targets/', '/data-quality/', '/leaderboard/', '/attendance/?view=month', '/attendance/leave/', '/attendance/calendar/', '/attendance/calendar/?tab=shifts', '/notices/', '/inbox/', '/customers/', '/customers/?pay=missed_many&kind=installment', '/map/?at=22.35960,90.32990,14', '/collections/', '/collections/conflicts/', '/cash/', '/admin/users/', '/admin/devices/', '/admin/system/', '/admin/permissions/', '/admin/settings/', '/admin/flags/', '/admin/audit/'];

test('login page has no serious axe violations', async ({ page }) => {
  await page.goto('/login/');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test('main pages have no serious axe violations', async ({ page }) => {
  test.setTimeout(180_000);
  // reduced motion turns colour transitions off (globals.css), so axe never measures a button halfway through turning enabled
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  const found: string[] = [];
  for (const path of PAGES) {
    // client-side navigation keeps the session; reloads restore it from the mock session too
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    // let state transitions (e.g. a pager button turning enabled) finish so axe sees settled colours
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity));
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    for (const v of r.violations) if (v.impact === 'serious' || v.impact === 'critical') found.push(`${path} ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`);
  }
  expect(found).toEqual([]);
});

test('map pin and assign dialogs have no serious axe violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // the manager's data-quality list opens on customers without a pin; their links open the fix dialog
  await login(page, 'manager');
  await page.goto('/data-quality/');
  const link = page.locator('tbody tr').first().getByRole('link');
  await expect(link).toHaveAttribute('href', /\?action=pin$/);
  const href = (await link.getAttribute('href'))!;
  const found: string[] = [];
  for (const action of ['pin', 'assign']) {
    await page.goto(href.replace(/action=\w+$/, `action=${action}`));
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity));
    const r = await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa']).analyze();
    for (const v of r.violations) if (v.impact === 'serious' || v.impact === 'critical') found.push(`${action} ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`);
  }
  expect(found).toEqual([]);
});
