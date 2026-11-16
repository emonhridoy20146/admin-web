import { describe, expect, it } from 'vitest';
import { collectionTotals, daysBetween, difference, exportBody, kindCounts, overdueView, rangeWindow, reconGap, validateExport, type ExportForm } from '../model/reports';

const form: ExportForm = { type: 'collections', format: 'xlsx', from: '2026-11-01', to: '2026-11-16', period: 'daily', date: '2026-11-16' };

describe('reports', () => {
  it('builds the trend window', () => {
    expect(rangeWindow('7d', '2026-11-16')).toEqual({ from: '2026-11-10', to: '2026-11-16', granularity: 'day' });
    expect(rangeWindow('90d', '2026-11-16')).toEqual({ from: '2026-08-19', to: '2026-11-16', granularity: 'week' });
  });

  it('totals field collections', () => {
    expect(collectionTotals([{ totalPoisha: 500, cashPoisha: 300, mobilePoisha: 200, count: 2, visits: 5 }, { totalPoisha: 100, cashPoisha: 100, count: 1 }])).toEqual({ totalPoisha: 600, cashPoisha: 400, mobilePoisha: 200, count: 3, visits: 5 });
  });

  it('reads the latest overdue snapshot and its movement', () => {
    const v = overdueView([
      { date: '2026-11-16', totalOverdue: { count: 10, amountPoisha: 1000 }, buckets: { d1_30: { count: 6, amountPoisha: 250 }, d90p: { count: 4, amountPoisha: 750 } }, badSuggested: 3, tagged: 1 },
      { date: '2026-11-10', totalOverdue: { count: 12, amountPoisha: 1400 } },
    ])!;
    expect(v.date).toBe('2026-11-16');
    expect(v.changePoisha).toBe(-400);
    expect(v.since).toBe('2026-11-10');
    expect(v.buckets.map((b) => b.share)).toEqual([0.25, 0, 0, 0.75]);
    expect(overdueView([])).toBeNull();
    expect(overdueView([{ date: '2026-11-16', totalOverdue: { amountPoisha: 5 } }])!.changePoisha).toBeNull();
  });

  it('summarises reconciliation', () => {
    expect(kindCounts([{ kind: 'not_posted' }, { kind: 'amount_differs' }, { kind: 'not_posted' }])).toEqual([{ kind: 'not_posted', count: 2 }, { kind: 'amount_differs', count: 1 }]);
    expect(difference({ fosAmountPoisha: 500, erpAmountPoisha: 450 })).toBe(50);
    expect(difference({ fosAmountPoisha: 500, erpAmountPoisha: null })).toBeNull();
    expect(reconGap({ totals: { fosPostedPoisha: 900, erpPoisha: 1000 } })).toBe(-100);
  });

  it('validates an export request against the server limits', () => {
    expect(daysBetween('2026-11-01', '2026-11-16')).toBe(16);
    expect(validateExport(form, '2026-11-16')).toBeNull();
    expect(validateExport({ ...form, from: '2026-11-17' }, '2026-11-16')).toBe('order');
    expect(validateExport({ ...form, to: '2026-11-20' }, '2026-11-16')).toBe('future');
    expect(validateExport({ ...form, from: '2026-08-01' }, '2026-11-16')).toBe('tooLong');
    expect(validateExport({ ...form, type: 'attendance', from: '2026-09-01' }, '2026-11-16')).toBe('tooLong');
    expect(validateExport({ ...form, type: 'cash_positions', from: '2030-01-01' }, '2026-11-16')).toBeNull();
  });

  it('sends only the params the type needs', () => {
    expect(exportBody(form, 'b1', 'bn')).toEqual({ type: 'collections', format: 'xlsx', params: { from: '2026-11-01', to: '2026-11-16', branchId: 'b1' }, locale: 'bn' });
    expect(exportBody({ ...form, type: 'staff_performance', period: 'monthly' }, undefined, 'en')).toEqual({ type: 'staff_performance', format: 'xlsx', params: { period: 'monthly', date: '2026-11-16' }, locale: 'en' });
    expect(exportBody({ ...form, type: 'overdue_customers', format: 'csv' }, undefined, 'bn')).toEqual({ type: 'overdue_customers', format: 'csv', params: {}, locale: 'bn' });
  });
});
