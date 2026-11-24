import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import reqBn from '../../src/features/requests/i18n/bn.json' with { type: 'json' };
import usersBn from '../../src/features/admin-users/i18n/bn.json' with { type: 'json' };
import settingsBn from '../../src/features/admin-settings/i18n/bn.json' with { type: 'json' };
import flagsBn from '../../src/features/admin-flags/i18n/bn.json' with { type: 'json' };
import rbacBn from '../../src/features/admin-rbac/i18n/bn.json' with { type: 'json' };
import dashBn from '../../src/features/dashboard/i18n/bn.json' with { type: 'json' };
import commonBn from '../../src/shared/i18n/common.bn.json' with { type: 'json' };
import { login, nav, S } from '../fixtures';

/** FR-W-070 (owner request 2026-11-24, item D; contract 1.48.0): the requests inbox, end to end in the mock. */
const drawer = (page: Page) => page.getByTestId('request-drawer');
const timeline = (page: Page) => page.getByTestId('request-timeline');

/** A reason dialog over the open drawer: fill, confirm, and see it close (the drawer stays). */
async function withNote(page: Page, title: string, note: string, confirm: string) {
  const d = page.getByRole('dialog', { name: title });
  await d.locator('textarea').fill(note);
  await d.getByRole('button', { name: confirm }).click();
  await expect(d).toBeHidden();
}

async function axeDialog(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity));
  const r = await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

test('office sends an important request; it is forwarded, assigned, commented, resolved, reopened and closed, all on the timeline', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await nav(page, reqBn.title, S.inbox);
  // queue tabs carry counts
  const queues = page.getByRole('group', { name: reqBn.queues });
  await expect(queues.getByRole('button', { name: new RegExp(reqBn.queue.all) })).toContainText(/[০-৯]/);

  // create (super admin's own queue: important)
  await page.getByRole('button', { name: reqBn.new }).click();
  const form = page.getByRole('dialog');
  await form.getByRole('button', { name: reqBn.form.submit }).click();
  await expect(form.getByText(reqBn.form.errors.title)).toBeVisible();
  await form.getByLabel(reqBn.form.priority).selectOption('important');
  await form.getByLabel(reqBn.form.titleLabel).fill('শোরুমের সামনে ভিড়, নিরাপত্তা দরকার');
  await form.getByLabel(reqBn.form.body).fill('প্রতি বৃহস্পতিবার বিকেলে অনেক ভিড় হয়, একজন নিরাপত্তাকর্মী থাকলে ভালো।');
  await axeDialog(page);
  await form.getByRole('button', { name: reqBn.form.submit }).click();
  await expect(drawer(page)).toBeVisible();
  await expect(page).toHaveURL(/drawer=/);
  await expect(timeline(page).getByRole('listitem')).toHaveCount(1);
  await axeDialog(page);

  // comment
  await drawer(page).getByLabel(reqBn.drawer.commentLabel).fill('কাল সকালে দেখছি।');
  await drawer(page).getByRole('button', { name: reqBn.drawer.send }).click();
  await expect(timeline(page)).toContainText('কাল সকালে দেখছি।');

  // forward to the area manager queue with a note
  await page.getByRole('button', { name: reqBn.act.forward }).click();
  const fw = page.getByRole('dialog', { name: reqBn.forward.title });
  await fw.getByLabel(reqBn.forward.queue).selectOption('area_manager');
  await fw.getByRole('button', { name: reqBn.forward.submit }).click();
  await expect(fw.getByText(reqBn.form.errors.note)).toBeVisible();
  await fw.getByLabel(reqBn.forward.note).fill('এরিয়া ম্যানেজার শাখার সঙ্গে কথা বলবেন।');
  await fw.getByRole('button', { name: reqBn.forward.submit }).click();
  await expect(fw).toBeHidden();
  await expect(timeline(page).getByRole('listitem')).toHaveCount(3);
  await expect(drawer(page)).toContainText(reqBn.where.area_manager);

  // assign to a person
  await page.getByRole('button', { name: reqBn.act.assign }).click();
  const as = page.getByRole('dialog', { name: reqBn.assign.title });
  await as.getByLabel(reqBn.assign.person).selectOption({ index: 3 });
  await as.getByRole('button', { name: reqBn.assign.submit }).click();
  await expect(as).toBeHidden();
  await expect(timeline(page).getByRole('listitem')).toHaveCount(4);

  // resolve needs a note
  await page.getByRole('button', { name: reqBn.act.resolve, exact: true }).click();
  await withNote(page, reqBn.resolve.title, 'নিরাপত্তাকর্মী বৃহস্পতিবার থাকবেন।', reqBn.resolve.confirm);
  await expect(drawer(page)).toContainText(reqBn.drawer.resolution);
  await expect(page.getByRole('dialog').first()).toContainText(reqBn.status.resolved);
  await axeDialog(page);

  // reopen, then close (note optional)
  await page.getByRole('button', { name: reqBn.act.reopen }).click();
  await withNote(page, reqBn.reopen.title, 'আবার ভিড় হচ্ছে।', reqBn.reopen.confirm);
  await page.getByRole('button', { name: reqBn.act.close }).click();
  await page.getByRole('dialog', { name: reqBn.close.title }).getByRole('button', { name: reqBn.close.confirm }).click();
  await expect(drawer(page)).toContainText(reqBn.drawer.closedNoComment);
  await expect(timeline(page).getByRole('listitem')).toHaveCount(7);
});

test('queue tabs and filters live in the link; dashboard tiles open the inbox on their queue', async ({ page }) => {
  await login(page);
  await expect(page.getByTestId('requests-card')).toBeVisible();
  await page.getByTestId('requests-card').getByRole('link', { name: new RegExp(dashBn.req.areaManagerQueue) }).click();
  await expect(page).toHaveURL(/\/requests\/\?queue=area_manager/);
  const queues = page.getByRole('group', { name: reqBn.queues });
  await expect(queues.getByRole('button', { name: new RegExp(reqBn.queue.area_manager) })).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel(reqBn.priority.label).selectOption('important');
  await expect(page).toHaveURL(/priority=important/);
  await page.getByLabel(reqBn.statusFilter).selectOption('any');
  await expect(page).toHaveURL(/status=any/);
  await queues.getByRole('button', { name: new RegExp(reqBn.queue.all) }).click();
  await expect(page).toHaveURL(/queue=all/);
  await expect(page).toHaveURL(/priority=important/);
});

test.describe('area manager (contract 1.48.0, ADR-065)', () => {
  test('works their queue; cannot move a super-admin-level request; no user create, password reset, flags or settings', async ({ page }) => {
    await login(page, 'area');
    await nav(page, reqBn.title, S.inbox);
    // "my queue" is the area manager queue
    await expect(page.getByText(reqBn.queueHelp.mine)).toBeVisible();
    // a request waiting at super admin level: no forward or resolve for an area manager
    await page.getByRole('group', { name: reqBn.queues }).getByRole('button', { name: new RegExp(reqBn.queue.super_admin) }).click();
    await expect(page).toHaveURL(/queue=super_admin/);
    await expect(page.locator('main tbody tr[tabindex="0"]').first()).toContainText(reqBn.where.super_admin);
    await page.locator('main tbody tr[tabindex="0"]').first().click();
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByRole('button', { name: reqBn.act.forward })).toHaveCount(0);
    await expect(page.getByRole('button', { name: reqBn.act.resolve, exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Admin: users are visible, but no create; the drawer has no password reset; settings and flags are not tabs
    await nav(page, usersBn.title, S.admin);
    await expect(page.getByRole('button', { name: usersBn.new })).toHaveCount(0);
    const tabs = page.getByTestId('section-tabs');
    await expect(tabs.getByRole('link', { name: new RegExp(`^${settingsBn.title}`) })).toHaveCount(0);
    await expect(tabs.getByRole('link', { name: new RegExp(`^${flagsBn.title}`) })).toHaveCount(0);
    await page.locator('main tbody tr[tabindex="0"]').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: usersBn.drawer.reset })).toHaveCount(0);

    // a direct link still gets the calm forbidden page (the server would answer 403 too)
    await page.goto('/admin/flags/');
    await expect(page.getByText(commonBn.forbidden.title)).toBeVisible();
  });

  test('the role is offered by a super admin, and the permissions matrix shows it with locked keys', async ({ page }) => {
    await login(page);
    await nav(page, usersBn.title, S.admin);
    await page.getByRole('button', { name: usersBn.new }).click();
    await expect(page.getByRole('dialog').getByLabel(usersBn.form.role).locator('option[value=area_manager]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await nav(page, rbacBn.title, S.admin);
    await expect(page.getByRole('columnheader', { name: commonBn.role.area_manager })).toBeVisible();
    await expect(page.getByRole('row', { name: /user\.manage/ }).getByText(rbacBn.never)).toBeVisible();
  });
});
