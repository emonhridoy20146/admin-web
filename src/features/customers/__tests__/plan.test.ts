import { describe, expect, it } from 'vitest';
import type { components } from '@/shared/api/schema';
import { frequencyLabel, guarantorPhones, isCollectable, itemLabel, rolledCount, sortPlans, visibleLines } from '../model/plan';

type Plan = components['schemas']['Plan'];
const plan = (p: Partial<Plan>): Plan => ({ erpPlanId: 'P-1', status: 'active', finalDueDate: '2027-01-01', schedule: [], ...p });

describe('plan model (contract 1.13.0, real ERP shape)', () => {
  it('hides lines the ERP rolled forward and counts them', () => {
    const p = plan({
      schedule: [
        { seq: 1, dueDate: '2026-09-15', amountPoisha: 0, paidPoisha: 0, status: 'paid', rolled: true },
        { seq: 2, dueDate: '2026-10-15', amountPoisha: 400_000, paidPoisha: 0, status: 'overdue', lateFeePoisha: 5_000 },
        { seq: 3, dueDate: '2026-11-15', amountPoisha: 200_000, paidPoisha: 0, status: 'due' },
      ],
    });
    expect(visibleLines(p).map((l) => l.seq)).toEqual([2, 3]);
    expect(rolledCount(p)).toBe(1);
    expect(rolledCount(plan({ schedule: undefined }))).toBe(0);
  });

  it('treats returned (closed) and cancelled invoices as not collectable and lists them last', () => {
    expect(isCollectable(plan({ status: 'closed' }))).toBe(false);
    expect(isCollectable(plan({ status: 'cancelled' }))).toBe(false);
    expect(isCollectable(plan({ status: 'defaulted' }))).toBe(true);
    const sorted = sortPlans([
      plan({ erpPlanId: 'returned', status: 'closed', finalDueDate: '2027-06-01' }),
      plan({ erpPlanId: 'old', status: 'completed', finalDueDate: '2025-01-01' }),
      plan({ erpPlanId: 'new', status: 'active', finalDueDate: '2027-03-01' }),
    ]);
    expect(sorted.map((p) => p.erpPlanId)).toEqual(['new', 'old', 'returned']);
  });

  it('labels how often installments fall due; credit sales have none', () => {
    expect(frequencyLabel(plan({ frequency: 'monthly' }))).toEqual({ key: 'frequency.monthly' });
    expect(frequencyLabel(plan({ frequency: 'weekly' }))).toEqual({ key: 'frequency.weekly' });
    expect(frequencyLabel(plan({ frequency: 'custom', customDays: 15 }))).toEqual({ key: 'frequency.everyNDays', n: 15 });
    expect(frequencyLabel(plan({ frequency: 'custom' }))).toEqual({ key: 'frequency.custom' });
    expect(frequencyLabel(plan({ kind: 'credit', frequency: 'monthly' }))).toBeNull();
    expect(frequencyLabel(plan({}))).toBeNull();
  });

  it('names products with model and quantity', () => {
    expect(itemLabel({ name: 'Walton fridge', model: 'WFC-3F5', qty: 2 })).toBe('Walton fridge WFC-3F5 ×2');
    expect(itemLabel({ name: 'Ceiling fan', model: null, qty: 1 })).toBe('Ceiling fan');
  });

  it('shows each guarantor phone once, falling back to the single phone', () => {
    expect(guarantorPhones({ name: 'G', phone: '01711000001', phones: ['01711000001', '01811000002', '01711000001'] })).toEqual(['01711000001', '01811000002']);
    expect(guarantorPhones({ name: 'G', phone: '01711000001' })).toEqual(['01711000001']);
    expect(guarantorPhones(null)).toEqual([]);
  });
});
