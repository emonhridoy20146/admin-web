import { expect, test, type Page } from '@playwright/test';
import { login } from '../fixtures';

/**
 * FR-W-067 (owner request 2026-11-24): no drawer puts text against its edge. Opens one drawer of each kind that had the
 * bug (and some that did not) at 1440 px and 390 px and measures every text box inside the open drawer against the
 * drawer's own left and right edge. The shared body pads 20 px (space.20); anything under 16 px is a regression.
 */
const DRAWERS: { name: string; path: string; table?: number }[] = [
  { name: 'customer', path: '/customers/' },
  { name: 'place', path: '/places/' },
  { name: 'prospect', path: '/prospects/' },
  { name: 'collection', path: '/collections/' },
  { name: 'task', path: '/tasks/' },
  { name: 'leave', path: '/attendance/leave/' },
  { name: 'cash in hand', path: '/cash/', table: 0 },
  { name: 'deposit', path: '/cash/', table: 1 },
  { name: 'notice', path: '/notices/' },
  { name: 'user', path: '/admin/users/' },
  { name: 'audit', path: '/admin/audit/' },
  { name: 'request', path: '/requests/?queue=all' },
];

const MIN_GAP = 16;

async function openFirst(page: Page, mobile: boolean, table = 0) {
  const lists = page.locator(mobile ? 'main ul:has(li [role=button])' : 'main table:has(tbody tr[tabindex="0"])');
  const row = lists.nth(table).locator(mobile ? 'li [role=button]' : 'tbody tr[tabindex="0"]').first();
  await row.click();
  await expect(page.locator('[data-drawer-content]')).toBeVisible();
}

/** Smallest distance from any visible text box in the open drawer to the drawer's left and right edges. */
function textGaps(page: Page) {
  return page.evaluate(() => {
    const d = document.querySelector('[data-drawer-content]')!.closest('[role=dialog]')!;
    const box = d.getBoundingClientRect();
    let left = Infinity;
    let right = Infinity;
    let at = '';
    const walk = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement;
      if (!n.textContent?.trim() || !el || el.closest('.sr-only')) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const rc of r.getClientRects()) {
        if (!rc.width) continue;
        // a truncated value (ellipsis) reports its full width; measure what is actually painted
        const clip = el.closest('.truncate')?.getBoundingClientRect();
        const rr = clip ? Math.min(rc.right, clip.right) : rc.right;
        if (rc.left - box.left < left) {
          left = rc.left - box.left;
          at = n.textContent.trim().slice(0, 30);
        }
        right = Math.min(right, box.right - rr);
      }
    }
    return { left: Math.round(left), right: Math.round(right), at };
  });
}

for (const vp of [
  { label: '1440', width: 1440, height: 900 },
  { label: '390', width: 390, height: 844 },
]) {
  test.describe(`drawer padding at ${vp.label} px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`no drawer text touches the edge (${vp.label} px)`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await login(page);
      const bad: string[] = [];
      for (const d of DRAWERS) {
        await page.goto(d.path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await openFirst(page, vp.width < 640, d.table);
        const g = await textGaps(page);
        if (g.left < MIN_GAP || g.right < MIN_GAP) bad.push(`${d.name}: left ${g.left}px right ${g.right}px ("${g.at}")`);
      }
      expect(bad).toEqual([]);
    });
  });
}
