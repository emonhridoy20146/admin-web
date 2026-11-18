import { describe, expect, it } from 'vitest';
import type { components } from '@/shared/api/schema';
import { creditTerm, filterInvoices, invoiceCounts, lineRows, linesByPayment, missedOf, nextDue, penaltyPercent, planPayState, sortInvoices, stateOf, usualInstallment } from '../model/invoice';

type Plan = components['schemas']['Plan'];
const T = '2026-11-18';
const pay = (id: string, date: string, amount: number) => ({ erpPaymentId: id, date, amountPoisha: amount, receiptNo: `PAY-${date.replace(/-/g, '')}-${id}` });

// an older server: no 1.14.0 fields, so the viewer reads the lines itself
const plan = (over: Partial<Plan> = {}): Plan => ({
  erpPlanId: '55021', kind: 'installment', invoiceNo: 'INV-55021', status: 'active', totalPayablePoisha: 500_000, downPaymentPoisha: 100_000, paidPoisha: 250_000, outstandingPoisha: 250_000,
  finalDueDate: '2027-01-10',
  schedule: [
    { seq: 1, dueDate: '2026-08-10', amountPoisha: 50_000, paidPoisha: 50_000, payments: [pay('9100', '2026-08-09', 50_000)] },
    { seq: 2, dueDate: '2026-09-10', amountPoisha: 50_000, paidPoisha: 50_000, payments: [pay('9230', '2026-09-14', 30_000), pay('9361', '2026-09-20', 20_000)] },
    { seq: 3, dueDate: '2026-10-10', amountPoisha: 0, paidPoisha: 0, rolled: true },
    { seq: 4, dueDate: '2026-11-10', amountPoisha: 102_000, lateFeePoisha: 2_000, paidPoisha: 50_000, payments: [pay('9480', '2026-11-12', 50_000)] },
    { seq: 5, dueDate: '2026-11-18', amountPoisha: 50_000, paidPoisha: 0 },
    { seq: 6, dueDate: '2026-12-10', amountPoisha: 50_000, paidPoisha: 0 },
    { seq: 7, dueDate: '2027-01-10', amountPoisha: 48_000, paidPoisha: 0 },
  ],
  ...over,
});

describe('invoice viewer model (FR-W-028)', () => {
  it('reads every line: paid on time, paid late from two payments, rolled forward, part-paid and missed, due today, upcoming', () => {
    const rows = lineRows(plan(), T);
    expect(rows.map((r) => r.state)).toEqual(['paid', 'paid_late', 'rolled', 'missed', 'due_today', 'upcoming', 'upcoming']);
    expect(rows[1]).toMatchObject({ paidOn: '2026-09-20', daysLate: 10, leftPoisha: 0 });
    expect(rows[2]).toMatchObject({ movedTo: 4, daysLate: 0 });
    expect(rows[3]).toMatchObject({ leftPoisha: 52_000, lateFeePoisha: 2_000, daysLate: 8, paidOn: null });
    expect(linesByPayment(rows).get('9480')).toEqual([4]);
  });
  it('prefers the server fields when it sends them (1.14.0)', () => {
    const p = plan();
    p.schedule![3] = { ...p.schedule![3]!, outstandingPoisha: 52_000, missed: true, daysLate: 8 };
    p.schedule![0] = { ...p.schedule![0]!, paidOn: '2026-08-09', daysLate: 0 };
    const rows = lineRows({ ...p, payState: 'missed_many', missedCount: 2, nextDueDate: '2026-11-18', nextDuePoisha: 50_000 }, T);
    expect(rows[0]!.state).toBe('paid');
    expect(planPayState({ ...p, payState: 'missed_many' }, T)).toBe('missed_many');
    expect(missedOf({ ...p, missedCount: 2 }, T)).toBe(2);
    expect(nextDue({ ...p, nextDueDate: '2026-11-18', nextDuePoisha: 50_000 }, T)).toEqual({ date: '2026-11-18', amountPoisha: 50_000 });
  });
  it('works out the colour from the lines on an older server; closed invoices have none', () => {
    expect(planPayState(plan(), T)).toBe('missed_one');
    expect(planPayState(plan({ badSuggested: true }), T)).toBe('bad');
    expect(planPayState(plan({ outstandingPoisha: 0 }), T)).toBe('paid_off');
    expect(planPayState(plan({ status: 'closed' }), T)).toBeNull();
    expect(lineRows(plan({ status: 'closed' }), T)[3]!.state).toBe('closed');
    expect(nextDue(plan(), T)).toEqual({ date: '2026-11-18', amountPoisha: 50_000 });
  });
  it('credit terms: days left, due today, overdue, settled', () => {
    const credit = (due: string, left = 100_000): Plan => ({ erpPlanId: 'c1', kind: 'credit', status: 'active', creditDueDate: due, outstandingPoisha: left, schedule: [] });
    expect(creditTerm(credit('2026-11-30'), T)).toEqual({ dueDate: '2026-11-30', days: 12, settled: false });
    expect(creditTerm(credit('2026-11-18'), T)!.days).toBe(0);
    expect(creditTerm(credit('2026-10-24'), T)!.days).toBe(-25);
    expect(creditTerm(credit('2026-10-24', 0), T)!.settled).toBe(true);
    expect(creditTerm({ erpPlanId: 'x', kind: 'credit', finalDueDate: '2026-12-01' }, T)!.dueDate).toBe('2026-12-01');
  });
  it('late fee rate is a fraction in the ERP; the usual installment ignores the odd last line', () => {
    expect(penaltyPercent('0.0200')).toBe(2);
    expect(penaltyPercent('0.025')).toBe(2.5);
    expect(penaltyPercent('5')).toBe(5);
    expect(penaltyPercent(undefined)).toBeNull();
    expect(penaltyPercent('')).toBeNull();
    expect(usualInstallment(plan())).toBe(50_000);
  });
  it('filters by kind and state, counts both, and lists open invoices first', () => {
    const plans: Plan[] = [
      plan({ erpPlanId: 'paid', outstandingPoisha: 0, saleDate: '2026-01-01' }),
      plan({ erpPlanId: 'ret', status: 'closed' }),
      { erpPlanId: 'cr', kind: 'credit', status: 'active', outstandingPoisha: 90_000, creditDueDate: '2026-12-01', schedule: [{ seq: 1, dueDate: '2026-12-01', amountPoisha: 90_000, paidPoisha: 0 }] },
      plan({ erpPlanId: 'open' }),
    ];
    expect(stateOf(plans[1]!)).toBe('closed');
    expect(sortInvoices(plans, T).map((p) => p.erpPlanId)).toEqual(['open', 'cr', 'paid', 'ret']);
    expect(filterInvoices(plans, 'credit', 'all').map((p) => p.erpPlanId)).toEqual(['cr']);
    expect(filterInvoices(plans, 'installment', 'open').map((p) => p.erpPlanId)).toEqual(['open']);
    expect(invoiceCounts(plans)).toEqual({ kinds: { all: 4, installment: 3, credit: 1 }, states: { all: 4, open: 2, paid: 1, closed: 1 } });
  });
});
