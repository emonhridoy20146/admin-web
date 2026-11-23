import { describe, expect, it } from 'vitest';
import { lastPaidBy, monthPeople, type Activity } from '../model/activity';

const base: Activity = { month: '2026-11', visitCount: 3, visitedToday: false, lastVisitAt: '2026-11-20T04:00:00Z', paidPoisha: 700_000, lastPaidDate: '2026-11-20', pendingPoisha: 150_000, promisesMade: 1, promisesKept: 0, promisesBroken: 0 };

describe('who did the month (contract 1.44.0, FR-CUS-021)', () => {
  const a: Activity = {
    ...base,
    visitedBy: [{ userId: 'u1', name: 'Rakib Hossain', count: 2, lastAt: '2026-11-20T04:00:00Z' }, { userId: 'u9', name: '', count: 1, lastAt: '2026-11-03T04:00:00Z' }],
    promisedBy: [{ userId: 'u1', name: 'Rakib Hossain', count: 1, lastAt: '2026-11-18T04:00:00Z' }],
    paidBy: [
      { name: 'Rakib Hossain', source: 'staff', userId: 'u1', amountPoisha: 150_000, lastDate: '2026-11-22', pending: true },
      { name: 'Shahid Ullah', source: 'erp_referrer', amountPoisha: 500_000, lastDate: '2026-11-20', pending: false },
      { name: '', source: 'unknown', amountPoisha: 200_000, lastDate: '2026-11-05', pending: false },
    ],
    lastVisitByName: 'Rakib Hossain',
    lastPaidByName: 'Rakib Hossain',
  };

  it('keeps ERP money and field money not in the ERP apart; never adds them together', () => {
    const w = monthPeople(a);
    expect(w.paid.map((x) => x.amountPoisha)).toEqual([500_000, 200_000]);
    expect(w.paid.reduce((s, x) => s + (x.amountPoisha ?? 0), 0)).toBe(a.paidPoisha);
    expect(w.pending.map((x) => [x.name, x.amountPoisha])).toEqual([['Rakib Hossain', 150_000]]);
  });

  it('an unknown payer is the office; an empty staff name is a former user', () => {
    const w = monthPeople(a);
    expect(w.paid[1]).toMatchObject({ office: true, name: '' });
    expect(w.paid[0]).toMatchObject({ office: false, name: 'Shahid Ullah' });
    expect(w.visits.map((x) => [x.name, x.count, x.removed])).toEqual([['Rakib Hossain', 2, false], ['', 1, true]]);
    expect(w.promises[0]).toMatchObject({ name: 'Rakib Hossain', count: 1 });
  });

  it('a future payer source with a name shows the name', () => {
    const w = monthPeople({ ...base, paidBy: [{ name: 'Mitu', source: 'agent' as 'staff', amountPoisha: 1, lastDate: '2026-11-01', pending: false }] });
    expect(w.paid[0]).toMatchObject({ office: false, name: 'Mitu' });
  });

  it('an older server (no lists) gives empty lists; the last payer falls back to the office', () => {
    expect(monthPeople(base)).toEqual({ visits: [], promises: [], paid: [], pending: [] });
    expect(monthPeople(undefined).paid).toEqual([]);
    expect(lastPaidBy(a)).toMatchObject({ name: 'Rakib Hossain' });
    expect(lastPaidBy({ ...a, lastPaidByName: null, paidBy: [a.paidBy![2]!] })).toMatchObject({ office: true });
    expect(lastPaidBy({ ...base, lastPaidByName: null })).toBeNull();
  });
});
