import { describe, expect, it } from 'vitest';
import { canCancel, chainOf, chainsOf, daysTo, isLate, needsFollowUp, paidRatio, windowFor } from '../model/promise';

const T = '2026-11-15';

describe('promise model', () => {
  it('builds promised-date windows around today', () => {
    expect(windowFor('today', T)).toEqual({ from: T, to: T });
    expect(windowFor('next7', T)).toEqual({ from: '2026-11-16', to: '2026-11-22' });
    expect(windowFor('last7', T)).toEqual({ from: '2026-11-08', to: '2026-11-14' });
    expect(windowFor('last30', T)).toEqual({ from: '2026-10-16', to: '2026-11-14' });
  });
  it('counts days to the promised date', () => {
    expect(daysTo(T, T)).toBe(0);
    expect(daysTo('2026-11-18', T)).toBe(3);
    expect(daysTo('2026-11-13', T)).toBe(-2);
  });
  it('marks only open promises in the past as late', () => {
    expect(isLate({ status: 'open', promisedDate: '2026-11-14' }, T)).toBe(true);
    expect(isLate({ status: 'open', promisedDate: T }, T)).toBe(false);
    expect(isLate({ status: 'broken', promisedDate: '2026-11-10' }, T)).toBe(false);
  });
  it('computes the paid share and clamps it', () => {
    expect(paidRatio({ promisedAmountPoisha: 500000, paidTowardsPoisha: 200000 })).toBe(0.4);
    expect(paidRatio({ promisedAmountPoisha: 500000, paidTowardsPoisha: 900000 })).toBe(1);
    expect(paidRatio({ promisedAmountPoisha: 0 })).toBe(0);
  });
  it('only open promises can be cancelled', () => {
    expect(canCancel('open')).toBe(true);
    expect(canCancel('kept')).toBe(false);
  });
});

describe('promise chains (FR-PRM-006, 1.45.0)', () => {
  const p = (id: string, status: string, followUpOf: string | null, createdAt: string) => ({ id, status, followUpOf, followUpId: null, attempt: 1, createdAt }) as never;
  const all = [p('a', 'broken', null, '2026-11-01'), p('b', 'broken', 'a', '2026-11-05'), p('c', 'open', 'b', '2026-11-10'), p('x', 'kept', null, '2026-11-02'), p('z', 'cancelled', 'x', '2026-11-03')];
  it('walks back to the first promise and forward to the last', () => {
    expect(chainOf('b', all).map((q: { id: string }) => q.id)).toEqual(['a', 'b', 'c']);
    expect(chainOf('a', all).map((q: { id: string }) => q.id)).toEqual(['a', 'b', 'c']);
  });
  it('leaves cancelled follow-ups out of the live chain, keeps them in the history', () => {
    expect(chainOf('x', all).map((q: { id: string }) => q.id)).toEqual(['x']);
    expect(chainsOf(all).map((c) => c.map((q: { id: string }) => q.id).join(''))).toEqual(['abc', 'xz']);
  });
  it('knows which promises need a follow-up', () => {
    expect(needsFollowUp({ status: 'broken', followUpId: null })).toBe(true);
    expect(needsFollowUp({ status: 'partially_kept' })).toBe(true);
    expect(needsFollowUp({ status: 'broken', followUpId: 'b' })).toBe(false);
    expect(needsFollowUp({ status: 'kept' })).toBe(false);
  });
});
