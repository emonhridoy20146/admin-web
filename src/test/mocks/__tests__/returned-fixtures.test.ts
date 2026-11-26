import { describe, expect, it } from 'vitest';

/**
 * FR-W-074 fixtures (contract 1.53.0): the e2e journey `returned-invoices.spec.ts` needs a customer with mixed
 * invoices and an only-returned customer, and other journeys rely on exactly 400 customers. A broken seed makes the
 * whole mock app fail to start, so it is checked here too.
 */
describe('mock data: returned invoices', async () => {
  const db = await import('../db');
  it('keeps 400 customers', () => {
    expect(db.customers).toHaveLength(400);
  });
  it('never has a returned invoice in plans, and marks every returned plan and its payments', () => {
    for (const c of db.customers) {
      expect((c.detail.plans ?? []).some((p) => p.returned)).toBe(false);
      for (const p of c.detail.returnedPlans ?? []) {
        expect(p).toMatchObject({ returned: true, collectable: false, status: 'closed' });
        for (const pay of p.payments ?? []) expect(pay.returned).toBe(true);
      }
      expect(c.item.returnedInvoiceCount).toBe((c.detail.returnedPlans ?? []).length);
    }
  });
  it('has a mixed customer (INV-91018) and one only-returned customer with no collections, promises or money', () => {
    const mixed = db.customers.find((c) => c.detail.returnedPlans?.some((p) => p.invoiceNo === 'INV-91018'))!;
    expect(mixed.item.onlyReturned).toBe(false);
    expect((mixed.detail.plans ?? []).length).toBeGreaterThan(0);
    const only = db.customers.filter((c) => c.item.onlyReturned);
    expect(only).toHaveLength(1);
    const c = only[0]!;
    expect(c.item.name).toEqual(db.RETURNED_DEMO.onlyName);
    expect(c.detail.returnedPlans?.[0]?.invoiceNo).toBe(db.RETURNED_DEMO.onlyInvoiceNo);
    expect(c.detail.plans).toEqual([]);
    expect(c.item.totalOutstandingPoisha).toBe(0);
    expect(db.collections.some((x) => x.customer?.id === c.item.id)).toBe(false);
    expect(db.promises.some((x) => (x.row.customerId ?? x.row.customer?.id) === c.item.id)).toBe(false);
  });
});
