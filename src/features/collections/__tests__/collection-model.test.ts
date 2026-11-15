import { describe, expect, it } from 'vitest';
import { canVoid, orderedTotals, presetFor, rangeFor } from '../model/collection';

describe('collection model', () => {
  it('builds Dhaka business-date ranges', () => {
    expect(rangeFor('today', '2026-11-15')).toEqual({ from: '2026-11-15', to: '2026-11-15' });
    expect(rangeFor('7d', '2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(rangeFor('yesterday', '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-02-28' });
    expect(presetFor('2026-11-09', '2026-11-15', '2026-11-15')).toBe('7d');
    expect(presetFor('2026-11-01', '2026-11-15', '2026-11-15')).toBeNull();
  });
  it('allows voiding only before ERP posting', () => {
    expect(canVoid('received')).toBe(true);
    expect(canVoid('posting_failed')).toBe(true);
    expect(canVoid('posted')).toBe(false);
    expect(canVoid('resolved_posted')).toBe(false);
    expect(canVoid(undefined)).toBe(false);
  });
  it('orders totals in the fixed payment-method order', () => {
    const r = orderedTotals({ nagad: 100, cash: 300 });
    expect(r.map((x) => x.method)).toEqual(['cash', 'nagad']);
    expect(r[0]!.share).toBeCloseTo(0.75);
  });
});
