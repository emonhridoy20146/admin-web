import { describe, expect, it } from 'vitest';
import { actionsFor, dueAtOf, myQueue, queueQuery, statusQuery, validateCreate, whereNow, type Me } from '../model/requests';
import type { Request } from '../api/requests';
import bn from '../i18n/bn.json';
import en from '../i18n/en.json';

const sa: Me = { id: 'sa', canManage: true, canImportant: true };
const am: Me = { id: 'am', canManage: true, canImportant: false };
const bm: Me = { id: 'bm', canManage: false, canImportant: false };

const req = (over: Partial<Request> = {}): Request => ({
  id: 'r1', clientId: 'c', type: 'request', priority: 'normal', title: 'T', body: 'B', branchId: 'b1', createdBy: { id: 'fs', name: 'Staff' },
  createdAt: '2026-11-24T04:00:00Z', createdDate: '2026-11-24', status: 'open', currentQueue: 'area_manager', level: 'area_manager', assignee: null,
  timeline: [], version: 1, ...over,
});

/** FR-W-070 (contract 1.48.0). */
describe('requests queues', () => {
  it('"my queue" is the queue my role works, or what I sent when I work none', () => {
    expect(myQueue(sa)).toBe('super_admin');
    expect(myQueue(am)).toBe('area_manager');
    expect(queueQuery('mine', bm)).toEqual({ createdBy: 'bm' });
    expect(queueQuery('assigned', am)).toEqual({ assigneeId: 'me' });
    expect(queueQuery('all', am)).toEqual({});
  });
  it('the default status filter is "not finished"', () => {
    expect(statusQuery('active')).toEqual(['open', 'in_progress', 'forwarded', 'reopened']);
    expect(statusQuery('any')).toBeUndefined();
    expect(statusQuery('closed')).toEqual(['closed']);
  });
});

describe('who may do what', () => {
  it('an area manager works area-manager-level requests but not super-admin-level ones', () => {
    expect(actionsFor(req(), am)).toMatchObject({ forward: true, assign: true, resolve: true, close: true, reopen: false, comment: true });
    expect(actionsFor(req({ level: 'super_admin', currentQueue: 'super_admin' }), am)).toMatchObject({ forward: false, assign: false, resolve: false, close: false });
    expect(actionsFor(req({ level: 'super_admin', currentQueue: 'super_admin' }), sa)).toMatchObject({ forward: true, resolve: true });
  });
  it('the assignee may resolve; the sender may close or reopen their own', () => {
    expect(actionsFor(req({ assignee: { id: 'bm', name: 'M' }, currentQueue: 'assignee', status: 'in_progress' }), bm)).toMatchObject({ resolve: true, forward: false });
    expect(actionsFor(req({ createdBy: { id: 'bm', name: 'M' } }), bm)).toMatchObject({ close: true, resolve: false });
    expect(actionsFor(req({ createdBy: { id: 'bm', name: 'M' }, status: 'resolved' }), bm)).toMatchObject({ reopen: true, resolve: false });
  });
  it('a closed request takes no comment and cannot be closed again', () => {
    expect(actionsFor(req({ status: 'closed' }), sa)).toMatchObject({ comment: false, close: false, reopen: true, forward: false });
  });
});

describe('helpers', () => {
  it('names where a request waits now', () => {
    expect(whereNow(req())).toEqual({ kind: 'queue', queue: 'area_manager' });
    expect(whereNow(req({ currentQueue: 'assignee', assignee: { id: 'x', name: 'Rina' } }))).toEqual({ kind: 'person', name: 'Rina' });
  });
  it('a due day is the end of that Dhaka day', () => {
    expect(dueAtOf('2026-11-30')).toBe('2026-11-30T17:59:59.000Z');
    expect(dueAtOf('')).toBeUndefined();
  });
  it('the form needs a title, a message and a branch', () => {
    const v = { type: 'request' as const, priority: 'normal' as const, title: ' ', body: '', customerId: '', customerName: '', due: '', branchId: '' };
    expect(validateCreate(v)).toEqual({ title: 'form.errors.title', body: 'form.errors.body', branchId: 'form.errors.branch' });
    expect(validateCreate({ ...v, title: 'x', body: 'y', branchId: 'b' })).toEqual({});
  });
  it('labels every status, priority, kind and timeline entry in both languages', () => {
    for (const m of [bn, en]) {
      for (const s of ['open', 'in_progress', 'forwarded', 'reopened', 'resolved', 'closed']) expect(m.status[s as keyof typeof m.status]).toBeTruthy();
      for (const k of ['created', 'comment', 'forwarded', 'assigned', 'status_changed', 'resolved', 'reopened', 'closed']) expect(m.tl[k as keyof typeof m.tl]).toBeTruthy();
      for (const k of ['request', 'report', 'inform', 'complaint']) expect(m.type[k as keyof typeof m.type]).toBeTruthy();
    }
  });
});
