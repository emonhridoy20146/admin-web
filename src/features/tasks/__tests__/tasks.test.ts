import { describe, expect, it } from 'vitest';
import type { Task } from '../api/tasks';
import { actionsFor, dueKind, emptyTask, formOf, history, tabQuery, toCreate, toEdit, validateTask } from '../model/tasks';

const task = (p: Partial<Task> = {}): Task => ({
  id: 't1',
  branchId: 'b1',
  assignee: { id: 'u1', name: 'Rakib', employeeCode: 'FS014' },
  createdBy: { id: 'm1', name: 'Manager' },
  title: 'Collect the key',
  note: 'at the tea stall',
  dueDate: '2026-11-20',
  status: 'open',
  overdue: false,
  events: [],
  createdAt: '2026-11-15T04:00:00.000Z',
  updatedAt: '2026-11-15T04:00:00.000Z',
  ...p,
});

describe('task form (FR-TASK-001)', () => {
  const ok = { ...emptyTask('b1'), assigneeId: 'u1', title: 'Collect the key' };

  it('needs a branch, a person and a title; a due date cannot be in the past', () => {
    expect(validateTask(ok, '2026-11-18')).toEqual({});
    expect(validateTask(emptyTask(), '2026-11-18')).toEqual({ branchId: 'errors.required', assigneeId: 'errors.required', title: 'errors.required' });
    expect(validateTask({ ...ok, title: 'x'.repeat(121) }, '2026-11-18').title).toBe('errors.tooLong');
    expect(validateTask({ ...ok, note: 'x'.repeat(2001) }, '2026-11-18').note).toBe('errors.tooLong');
    expect(validateTask({ ...ok, dueDate: '2026-11-17' }, '2026-11-18').dueDate).toBe('errors.past');
    expect(validateTask({ ...ok, dueDate: '2026-11-18' }, '2026-11-18')).toEqual({});
    expect(validateTask({ ...ok, dueDate: '18/11/2026' }, '2026-11-18').dueDate).toBe('errors.badDate');
  });

  it('an edit does not ask for the branch or person again', () => {
    expect(validateTask({ ...emptyTask(), title: 'Fix' }, '2026-11-18', true)).toEqual({});
  });

  it('builds the create body with the idempotency id and drops empty optional fields', () => {
    expect(toCreate({ ...ok, note: '  ', dueDate: '' }, 'c1')).toEqual({ clientId: 'c1', assigneeId: 'u1', branchId: 'b1', title: 'Collect the key' });
    expect(toCreate({ ...ok, title: ' Key ', note: ' call me ', dueDate: '2026-11-19' }, 'c1')).toMatchObject({ title: 'Key', note: 'call me', dueDate: '2026-11-19' });
  });

  it('sends only the fields that changed, and null to clear', () => {
    const t = task();
    expect(toEdit(formOf(t), t)).toEqual({});
    expect(toEdit({ ...formOf(t), title: 'New' }, t)).toEqual({ title: 'New' });
    expect(toEdit({ ...formOf(t), note: '', dueDate: '' }, t)).toEqual({ note: null, dueDate: null });
  });
});

describe('what an admin can do (FR-TASK-003)', () => {
  it('follows the state table', () => {
    expect(actionsFor('open')).toEqual({ edit: true, verify: false, reject: false, cancel: true });
    expect(actionsFor('resolve_requested')).toEqual({ edit: false, verify: true, reject: true, cancel: true });
    expect(actionsFor('resolved')).toEqual({ edit: false, verify: false, reject: false, cancel: false });
    expect(actionsFor('cancelled')).toEqual({ edit: false, verify: false, reject: false, cancel: false });
  });
});

describe('list helpers', () => {
  it('maps tabs to the query; late is a filter, not a state', () => {
    expect(tabQuery('open')).toEqual({ status: 'open' });
    expect(tabQuery('resolve_requested')).toEqual({ status: 'resolve_requested' });
    expect(tabQuery('overdue')).toEqual({ overdue: true });
  });

  it('reads due dates against the Dhaka date', () => {
    expect(dueKind(task({ dueDate: null }), '2026-11-18')).toBe('none');
    expect(dueKind(task({ dueDate: '2026-11-17' }), '2026-11-18')).toBe('late');
    expect(dueKind(task({ dueDate: '2026-11-18' }), '2026-11-18')).toBe('today');
    expect(dueKind(task({ dueDate: '2026-11-20' }), '2026-11-18')).toBe('soon');
    expect(dueKind(task({ dueDate: '2026-11-25' }), '2026-11-18')).toBe('later');
    expect(dueKind(task({ dueDate: '2026-11-01', status: 'resolved' }), '2026-11-18')).toBe('later'); // finished work is never late
  });

  it('puts the history in time order', () => {
    const ev = (at: string, type: 'created' | 'verified') => ({ type, at, by: { id: 'x', name: 'x' }, note: null });
    expect(history({ events: [ev('2026-11-16T00:00:00Z', 'verified'), ev('2026-11-15T00:00:00Z', 'created')] }).map((e) => e.type)).toEqual(['created', 'verified']);
  });
});
