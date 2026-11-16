import { describe, expect, it } from 'vitest';
import { byMethod, collected, jointWeight, sortRows, targetRatio, totals, visitCredit, visitsTakenPart } from '../model/staff';

const a = { userId: 'a', name: 'Arif', collectedPoisha: { total: 900000, cash: 600000, bkash: 300000, nagad: 0 }, targetPoisha: 1000000, visits: 12, collectionsCount: 6, promisesDue: 4, promisesKept: 3, promiseFulfilmentRate: 0.75 };
const b = { userId: 'b', name: 'Babul', collectedPoisha: { total: 1500000, bkash: 500000, cash: 900000, upay: 100000 }, targetPoisha: 1000000, visits: 9, collectionsCount: 8, promisesDue: 2, promisesKept: 1, promiseFulfilmentRate: 0.5 };

describe('staff performance model', () => {
  it('reads the collected total and target ratio', () => {
    expect(collected(a)).toBe(900000);
    expect(targetRatio(a)).toBe(0.9);
    expect(targetRatio(b)).toBe(1.5);
    expect(targetRatio({ collectedPoisha: { total: 5 }, targetPoisha: 0 })).toBeNull();
  });
  it('orders methods, drops zeros and keeps unknown methods last', () => {
    expect(byMethod(a)).toEqual([{ method: 'cash', poisha: 600000 }, { method: 'bkash', poisha: 300000 }]);
    expect(byMethod(b).map((x) => x.method)).toEqual(['cash', 'bkash', 'upay']);
  });
  it('sums the branch totals', () => {
    expect(totals([a, b])).toEqual({ collectedPoisha: 2400000, targetPoisha: 2000000, visits: 21, collections: 14, promisesDue: 6, promisesKept: 4 });
  });
  it('sorts by the chosen measure', () => {
    expect(sortRows([a, b], 'collected').map((r) => r.userId)).toEqual(['b', 'a']);
    expect(sortRows([a, b], 'visits').map((r) => r.userId)).toEqual(['a', 'b']);
    expect(sortRows([b, a], 'name').map((r) => r.userId)).toEqual(['a', 'b']);
  });
  it('sorts by visit credit, so joint visits count for every participant', () => {
    const solo = { userId: 's', name: 'Solo', visits: 8, soloVisits: 8, coWorkVisits: 0, visitCredit: 8 };
    const partner = { userId: 'p', name: 'Partner', visits: 1, soloVisits: 1, coWorkVisits: 9, visitCredit: 10 };
    expect(sortRows([solo, partner], 'visits').map((r) => r.userId)).toEqual(['p', 's']);
  });
  it('reads co-work visit figures (FR-CW-005)', () => {
    const r = { visits: 5, soloVisits: 3, coWorkVisits: 4, visitCredit: 5 };
    expect(visitsTakenPart(r)).toBe(7);
    expect(visitCredit(r)).toBe(5);
    expect(jointWeight(r)).toBe(0.5);
    expect(jointWeight({ soloVisits: 3, coWorkVisits: 0, visitCredit: 3 })).toBeNull();
    // an older server without the split: what the person recorded
    expect(visitsTakenPart({ visits: 6 })).toBe(6);
    expect(visitCredit({ visits: 6 })).toBe(6);
  });
});
