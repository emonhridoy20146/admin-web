import { describe, expect, it } from 'vitest';
import { extraStatuses, sortStatuses, toCustomerRow } from '../model/customer-row';

const base = {
  id: 'c1', code: 'BRL01-100245', name: { bn: 'মোঃ করিম উদ্দিন', en: 'Md Karim Uddin' }, phone: '01711000000',
  totalOutstandingPoisha: 850000, pendingFieldPoisha: 200000, daysOverdue: 36, nextDueDate: null,
  badges: ['overdue', 'bad_suggested'] as ('overdue' | 'bad_suggested')[], location: { lat: 22.7, lng: 90.3, status: 'ok' as const },
  openPromise: null, lastVisitAt: null, assignee: { id: 'u1', name: 'Rakib Hossain' }, erpFetchedAt: '2026-11-15T00:55:00Z',
};

describe('customer row view model', () => {
  it('localises the name and keeps the other script as alt', () => {
    expect(toCustomerRow(base, 'bn')).toMatchObject({ name: 'মোঃ করিম উদ্দিন', altName: 'Md Karim Uddin' });
    expect(toCustomerRow(base, 'en')).toMatchObject({ name: 'Md Karim Uddin', altName: 'মোঃ করিম উদ্দিন' });
  });
  it('orders statuses by consequence', () => {
    expect(sortStatuses(['current', 'overdue', 'tagged_bad', 'overdue'])).toEqual(['tagged_bad', 'overdue', 'current']);
  });
  it('keeps pending field money separate from ERP outstanding', () => {
    const r = toCustomerRow(base, 'bn');
    expect(r.outstandingPoisha).toBe(850000);
    expect(r.pendingFieldPoisha).toBe(200000);
  });
  it('derives urgency', () => {
    expect(toCustomerRow(base, 'bn').urgency).toBe(2);
    expect(toCustomerRow({ ...base, daysOverdue: 5, badges: ['overdue'] }, 'bn').urgency).toBe(1);
    expect(toCustomerRow({ ...base, daysOverdue: 0, badges: ['current'] }, 'bn').urgency).toBe(0);
    expect(toCustomerRow({ ...base, badges: ['tagged_bad'] }, 'bn').urgency).toBe(3);
  });
  it('maps the 1.2.0 area, installment and overdue amount', () => {
    const r = toCustomerRow({ ...base, areaName: { bn: 'রূপাতলী', en: 'Rupatoli' }, installmentPoisha: 250000, overduePoisha: 500000 }, 'bn');
    expect(r).toMatchObject({ areaName: 'রূপাতলী', installmentPoisha: 250000, overduePoisha: 500000 });
    expect(toCustomerRow(base, 'en')).toMatchObject({ areaName: null, installmentPoisha: null, overduePoisha: 0 });
  });
  it('1.14.0: carries the pin colour, missed count and open invoices; older servers fall back to the status', () => {
    const r = toCustomerRow({ ...base, payState: 'missed_many', missedCount: 3, openInvoices: { installment: 2, credit: 1 } }, 'bn');
    expect(r).toMatchObject({ payState: 'missed_many', missedCount: 3, openInvoices: { installment: 2, credit: 1 } });
    expect(toCustomerRow({ ...base, badges: ['overdue'] }, 'bn')).toMatchObject({ payState: 'missed_one', missedCount: null, openInvoices: null });
    expect(extraStatuses(['tagged_bad', 'overdue', 'promised_today', 'due_today', 'paid_up', 'current'])).toEqual(['tagged_bad', 'promised_today']);
  });
  it('flags missing location', () => {
    expect(toCustomerRow({ ...base, location: { lat: null, lng: null, status: 'missing' } }, 'bn').hasLocation).toBe(false);
  });
});
