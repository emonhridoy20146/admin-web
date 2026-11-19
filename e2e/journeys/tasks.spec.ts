import { expect, test } from '@playwright/test';
import tasksBn from '../../src/features/tasks/i18n/bn.json' with { type: 'json' };
import { login } from '../fixtures';

/** FR-TASK-001..004: the manager gives a task, verifies one request, sends another back with a reason and cancels a task. */
test('tasks: give a task with a note, verify a resolve request, send one back, cancel (FR-TASK-001..004)', async ({ page }) => {
  await login(page, 'manager');
  await page.goto('/tasks/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(tasksBn.title);
  const tab = (name: string) => page.getByRole('group', { name: tasksBn.tabs }).getByRole('button', { name: new RegExp(name) });
  const rows = page.locator('tbody tr');
  const dialog = () => page.getByRole('dialog').last();

  // two requests are waiting for the manager's branch; the newest one has a note from the staff member
  await tab(tasksBn.tab.resolve_requested).click();
  await page.waitForURL(/status=resolve_requested/);
  await expect(rows).toHaveCount(2);
  await rows.first().locator('td').first().getByRole('button').click();
  await expect(dialog().getByRole('heading', { name: tasksBn.drawer.staffSays })).toBeVisible();
  await expect(dialog().getByText(/তিনটি দোকানেই বলে এসেছি/).first()).toBeVisible(); // also in the history below

  // verify: names the staff member and the task, then the task is resolved
  await dialog().getByRole('button', { name: tasksBn.actions.verify }).click();
  await expect(dialog().getByRole('heading', { name: tasksBn.verify.title })).toBeVisible();
  await dialog().getByRole('button', { name: tasksBn.verify.confirm }).click();
  await expect(dialog().getByText(tasksBn.status.resolved).first()).toBeVisible();
  await expect(dialog().getByRole('button', { name: tasksBn.actions.verify })).toHaveCount(0); // nothing left to decide
  await page.keyboard.press('Escape');
  await expect(rows).toHaveCount(1);

  // send the other one back: a reason is required and the staff member sees it
  await rows.first().locator('td').first().getByRole('button').click();
  await dialog().getByRole('button', { name: tasksBn.actions.reject }).click();
  await dialog().locator('textarea').fill('না');
  await dialog().getByRole('button', { name: tasksBn.reject.confirm }).click();
  await expect(dialog().getByRole('heading', { name: tasksBn.reject.title })).toBeVisible(); // too short: still open
  await dialog().locator('textarea').fill('কাগজগুলো কার হাতে দিলেন সেটা লিখে জানান');
  await dialog().getByRole('button', { name: tasksBn.reject.confirm }).click();
  await expect(dialog().getByText(tasksBn.drawer.rejectedReason)).toBeVisible();
  await expect(dialog().getByText(/কাগজগুলো কার হাতে দিলেন/).first()).toBeVisible();
  await page.keyboard.press('Escape');

  // give a new task with a note; it opens in the drawer, in progress
  await page.getByRole('button', { name: tasksBn.new }).click();
  await dialog().getByLabel(tasksBn.form.assignee).selectOption({ index: 1 });
  await dialog().getByLabel(tasksBn.form.title).fill('গুদামের চাবি অফিসে জমা দিন');
  await dialog().getByLabel(tasksBn.form.note).fill('সন্ধ্যা ৬টার আগে, ম্যানেজারের টেবিলে রেখে যাবেন।');
  await dialog().getByRole('button', { name: tasksBn.form.submit }).click();
  await expect(dialog().getByText('সন্ধ্যা ৬টার আগে')).toBeVisible();
  await expect(dialog().getByText(tasksBn.status.open).first()).toBeVisible();
  await expect(dialog().getByRole('button', { name: tasksBn.actions.verify })).toHaveCount(0); // nothing to verify before the staff asks

  // cancel it: a destructive confirm with a reason
  await dialog().getByRole('button', { name: tasksBn.actions.cancel }).click();
  await dialog().locator('textarea').fill('এখন আর দরকার নেই');
  await dialog().getByRole('button', { name: tasksBn.cancel.confirm }).click();
  await expect(dialog().getByText(tasksBn.status.cancelled).first()).toBeVisible();
});

test('tasks: a viewer can read the list but cannot give or decide', async ({ page }) => {
  await login(page, 'viewer');
  await page.goto('/tasks/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(tasksBn.title);
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page.getByRole('button', { name: tasksBn.new })).toHaveCount(0);
  await page.locator('tbody tr').first().locator('td').first().getByRole('button').click();
  await expect(page.getByRole('dialog').getByText(tasksBn.drawer.history)).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: tasksBn.actions.cancel })).toHaveCount(0);
});
