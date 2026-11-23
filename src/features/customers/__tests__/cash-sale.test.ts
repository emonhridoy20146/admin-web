import { describe, expect, it } from 'vitest';
import type { components } from '@/shared/api/schema';
import { creditTerm, filterInvoices, invoiceCounts, kindOf, nextDue, planPayState, sortInvoices, stateOf } from '../model/invoice';
import { frequencyLabel, isCashLike, isCollectable, sortPlans } from '../model/plan';

type Plan = components['schemas']['Plan'];
const T = '2026-11-23';
const cashPaid: Plan = { erpPlanId: 's1', kind: 'cash', invoiceNo: 'INV-S1', status: 'completed', totalPayablePoisha: 380_000, paidPoisha: 380_000, outstandingPoisha: 0, saleDate: '2026-11-01', schedule: [] };
const cashLeft: Plan = { erpPlanId: 's2', kind: 'cash', invoiceNo: 'INV-S2', status: 'closed', totalPayablePoisha: 250_000, paidPoisha: 200_000, outstandingPoisha: 50_000, saleDate: '2026-10-20', schedule: [] };
const inst: Plan = { erpPlanId: 'i1', kind: 'installment', status: 'active', outstandingPoisha: 100_000, frequency: 'monthly', schedule: [{ seq: 1, dueDate: '2026-12-01', amountPoisha: 100_000, paidPoisha: 0 }] };
// a kind this build does not know (field-api may add more): treated like cash, never crashes
const future = { ...cashLeft, erpPlanId: 'x1', kind: 'layaway' } as unknown as Plan;

describe('cash sales (contract 1.44.0, field-api ADR-057)', () => {
  it('a cash sale is its own kind; an unknown kind is treated like cash; no kind is an installment sale (old server)', () => {
    expect(kindOf(cashPaid)).toBe('cash');
    expect(kindOf(future)).toBe('cash');
    expect(kindOf({ kind: undefined })).toBe('installment');
    expect(kindOf(inst)).toBe('installment');
    expect(isCashLike(future)).toBe(true);
    expect(isCashLike(inst)).toBe(false);
  });

  it('is never open, due, overdue or collectable: paid when completed, otherwise closed', () => {
    for (const p of [cashPaid, cashLeft, future]) {
      expect(isCollectable(p)).toBe(false);
      expect(planPayState(p, T)).toBeNull();
      expect(nextDue(p, T)).toBeNull();
      expect(creditTerm(p, T)).toBeNull();
      expect(frequencyLabel(p)).toBeNull();
    }
    expect(stateOf(cashPaid)).toBe('paid');
    expect(stateOf(cashLeft)).toBe('closed');
    expect(stateOf(future)).toBe('closed');
  });

  it('counts and filters cash sales on their own, after the open invoices', () => {
    const all = [cashLeft, cashPaid, inst, future];
    expect(invoiceCounts(all).kinds).toEqual({ all: 4, installment: 1, credit: 0, cash: 3 });
    expect(invoiceCounts(all).states).toEqual({ all: 4, open: 1, paid: 1, closed: 2 });
    expect(filterInvoices(all, 'cash', 'all').map((p) => p.erpPlanId)).toEqual(['s2', 's1', 'x1']);
    expect(filterInvoices(all, 'all', 'open').map((p) => p.erpPlanId)).toEqual(['i1']);
    expect(sortInvoices(all, T)[0]!.erpPlanId).toBe('i1');
    expect(sortPlans(all)[0]!.erpPlanId).toBe('i1');
  });
});
