import { describe, expect, it } from 'vitest';
import { untouched, workMarks, type Activity } from '../model/activity';

const none: Activity = { month: '2026-11', visitCount: 0, visitedToday: false, lastVisitAt: null, paidPoisha: 0, lastPaidDate: null, pendingPoisha: 0, promisesMade: 0, promisesKept: 0, promisesBroken: 0 };
const pinned = { lat: 22.7, lng: 90.35, status: 'ok' as const, source: 'erp' as const };
const promise = { id: 'p1', promisedDate: '2026-11-25', promisedAmountPoisha: 100000 } as never;

describe('customer work marks (FR-W-037)', () => {
  it('nothing done this month', () => {
    const m = workMarks({ activity: none, openPromise: null, location: pinned });
    expect(m).toEqual({ known: true, visit: null, paid: null, promise: null, pin: true });
    expect(untouched(m)).toBe(true);
  });

  it('visit: today beats this month', () => {
    expect(workMarks({ activity: { ...none, visitCount: 2 }, location: pinned }).visit).toBe('month');
    expect(workMarks({ activity: { ...none, visitCount: 2, visitedToday: true }, location: pinned }).visit).toBe('today');
  });

  it('paid: ERP money this month, else field money still waiting; the two are not mixed', () => {
    expect(workMarks({ activity: { ...none, paidPoisha: 50000, pendingPoisha: 20000 }, location: pinned }).paid).toBe('paid');
    expect(workMarks({ activity: { ...none, pendingPoisha: 20000 }, location: pinned }).paid).toBe('pending');
  });

  it('promise: an open one first, then a broken one, then a kept one', () => {
    expect(workMarks({ activity: { ...none, promisesBroken: 1 }, openPromise: promise, location: pinned }).promise).toBe('open');
    expect(workMarks({ activity: { ...none, promisesBroken: 1, promisesKept: 1 }, location: pinned }).promise).toBe('broken');
    expect(workMarks({ activity: { ...none, promisesKept: 1 }, location: pinned }).promise).toBe('kept');
  });

  it('pin: only a usable pin counts', () => {
    expect(workMarks({ activity: none, location: { lat: null, lng: null, status: 'missing', source: 'erp' } }).pin).toBe(false);
    expect(workMarks({ activity: none, location: { ...pinned, status: 'overridden', source: 'overlay' } }).pin).toBe(true);
    expect(workMarks({ activity: none }).pin).toBe(false);
  });

  it('an older server sends no activity: the marks are unknown, not "not done"', () => {
    const m = workMarks({ openPromise: promise, location: pinned });
    expect(m.known).toBe(false);
    expect(m.promise).toBe('open');
    expect(untouched(m)).toBe(false);
  });
});
