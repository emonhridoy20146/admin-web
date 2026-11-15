import { describe, expect, it } from 'vitest';
import { canCancel, daysTo, isLate, paidRatio, windowFor } from '../model/promise';

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
