import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { initI18n, i18n } from '@/shared/i18n';
import { TooltipProvider } from '@/shared/ui/primitives';
import type { components } from '@/shared/api/schema';
import bn from '../i18n/bn.json';
import en from '../i18n/en.json';
import type { CustomerDetail } from '../api/customers';

/**
 * FR-W-074 (contract 1.53.0, field-api FR-CUS-024 / ADR-071): invoices returned in the ERP are shown again, marked
 * Returned, with their payments, and counted nowhere.
 */
vi.mock('@/features/shell', () => ({ useBranches: () => ({ data: [] }) }));
const url = vi.hoisted(() => ({ params: new Map<string, string>(), set: vi.fn() }));
vi.mock('@/shared/lib/url-state', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/url-state')>()),
  useUrlState: () => ({ get: (k: string) => url.params.get(k) ?? '', getList: () => [], set: url.set }),
}));

const { InvoicesTab } = await import('../components/invoices-tab');
const { InvoiceViewer } = await import('../components/invoice-viewer');
const { PaymentsTab } = await import('../components/payments-tab');
const { returnedPlansOf, returnedPaymentsOf, invoiceCounts } = await import('../model/invoice');

type Plan = components['schemas']['Plan'];
type Payment = components['schemas']['Payment'];

beforeAll(() => {
  initI18n({ customers: { bn, en } }, 'en');
});
beforeEach(async () => {
  url.params.clear();
  url.set.mockClear();
  await i18n.changeLanguage('en');
});
afterEach(cleanup);

const open: Plan = {
  erpPlanId: 'p1', kind: 'installment', invoiceNo: 'INV-40001', product: 'Refrigerator', status: 'active', totalPayablePoisha: 6_000_000, paidPoisha: 2_000_000, outstandingPoisha: 4_000_000,
  saleDate: '2026-06-01', startDate: '2026-06-01', finalDueDate: '2027-06-01', schedule: [{ seq: 1, dueDate: '2026-12-01', amountPoisha: 500_000, paidPoisha: 0, status: 'upcoming' }],
};
const retPay: Payment = { erpPaymentId: 'r1', receiptNo: 'PAY-20260801-00001', date: '2026-08-01', amountPoisha: 400_000, method: 'cash', source: 'office', erpPlanId: 'p9', returned: true };
const retPay2: Payment = { erpPaymentId: 'r2', receiptNo: 'PAY-20260901-00002', date: '2026-09-01', amountPoisha: 300_000, method: 'bkash', source: 'office', erpPlanId: 'p9', returned: true };
const returned: Plan = {
  erpPlanId: 'p9', kind: 'installment', invoiceNo: 'INV-91018', product: 'LED TV 32"', status: 'closed', returned: true, collectable: false, totalPayablePoisha: 2_400_000, paidPoisha: 700_000,
  outstandingPoisha: 1_700_000, saleDate: '2026-08-01', startDate: '2026-08-01', finalDueDate: '2027-02-01', schedule: [], payments: [retPay, retPay2],
};
const older: Plan = { ...returned, erpPlanId: 'p8', invoiceNo: 'INV-91000', saleDate: '2026-01-01', startDate: '2026-01-01', payments: [] };
const normalPay: Payment = { erpPaymentId: 'n1', receiptNo: 'PAY-20261101-00003', date: '2026-11-01', amountPoisha: 500_000, method: 'cash', source: 'field', erpPlanId: 'p1' };
const detail = (extra: Partial<CustomerDetail>) =>
  ({ id: 'c1', name: { en: 'Abdul Karim', bn: 'আব্দুল করিম' }, plans: [open], returnedPlans: [returned], payments: [normalPay, retPay2, retPay], pendingCollections: [], erpFetchedAt: '2026-11-23T00:00:00Z', ...extra }) as unknown as CustomerDetail;

describe('returned invoices model', () => {
  it('lists returned invoices newest sale first and their payments newest first', () => {
    expect(returnedPlansOf({ returnedPlans: [older, returned] }).map((p) => p.erpPlanId)).toEqual(['p9', 'p8']);
    expect(returnedPlansOf({}).length).toBe(0);
    expect(returnedPaymentsOf(returned).map((p) => p.erpPaymentId)).toEqual(['r2', 'r1']);
  });
  it('never puts a returned invoice into the counted invoice numbers', () => {
    const c = detail({});
    expect(invoiceCounts(c.plans ?? []).states.all).toBe(1);
  });
});

describe('customer page: invoices tab', () => {
  it('lists counted invoices with counts that leave returned ones out, then a Returned invoices section with payments', () => {
    render(<TooltipProvider><InvoicesTab c={detail({})} /></TooltipProvider>);
    // the "All" filter counts only the counted invoice
    const kindGroup = screen.getByRole('group', { name: en.invoiceKind.label });
    expect(within(kindGroup).getByRole('button', { name: /All/ })).toHaveTextContent('1');
    const section = screen.getByTestId('returned-invoices');
    expect(within(section).getByRole('heading', { name: en.returned.title })).toBeInTheDocument();
    expect(within(section).getByText(en.returned.note)).toBeInTheDocument();
    const row = within(section).getByTestId('returned-invoice');
    expect(row).toHaveTextContent('INV-91018');
    expect(within(row).getByTestId('returned-chip')).toHaveTextContent('Returned');
    const pays = within(row).getAllByTestId('returned-payment');
    expect(pays.map((p) => p.textContent)).toEqual([expect.stringContaining('PAY-20260901-00002'), expect.stringContaining('PAY-20260801-00001')]);
    // no collect, promise or money action anywhere in the section
    expect(within(section).queryByRole('button', { name: /collect|promise/i })).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: new RegExp(en.invoice.openFull) }));
    expect(url.set).toHaveBeenCalledWith({ invoice: 'p9' }, { push: true });
  });

  it('a customer with only returned invoices sees just the returned section (no "no invoices" message)', () => {
    render(<TooltipProvider><InvoicesTab c={detail({ plans: [] })} /></TooltipProvider>);
    expect(screen.getByTestId('returned-invoices')).toBeInTheDocument();
    expect(screen.queryByText(en.invoice.none)).toBeNull();
  });

  it('opens a returned invoice from the link in the viewer in its returned mode', () => {
    url.params.set('invoice', 'p9');
    render(<TooltipProvider><InvoicesTab c={detail({})} /></TooltipProvider>);
    expect(screen.getByRole('heading', { name: 'INV-91018' })).toBeInTheDocument();
    expect(screen.getByTestId('returned-note')).toHaveTextContent(en.returned.viewerNote);
  });

  it('says "ফেরত চালান" in Bangla', async () => {
    await i18n.changeLanguage('bn');
    render(<TooltipProvider><InvoicesTab c={detail({})} /></TooltipProvider>);
    expect(screen.getByRole('heading', { name: 'ফেরত চালান' })).toBeInTheDocument();
    expect(screen.getByTestId('returned-chip')).toHaveTextContent('ফেরত');
  });
});

describe('invoice viewer', () => {
  it('returned mode: Returned chip and note, the invoice\'s own payments, no schedule, terms or pay colour', () => {
    render(<TooltipProvider><InvoiceViewer c={detail({})} plan={returned} returned onBack={() => {}} /></TooltipProvider>);
    expect(screen.getByTestId('returned-chip')).toHaveTextContent('Returned');
    expect(screen.getByTestId('returned-note')).toBeInTheDocument();
    expect(screen.queryByText(en.invoice.schedule)).toBeNull();
    expect(screen.queryByText(en.invoice.terms)).toBeNull();
    // only the Returned chip, not also the plain "closed" status badge
    expect(screen.getAllByText(en.planStatus.closed)).toHaveLength(1);
    const payments = screen.getByRole('table', { name: en.invoice.payments });
    expect(within(payments).getByText('PAY-20260801-00001')).toBeInTheDocument();
    expect(within(payments).getAllByTestId('returned-payment-tag')).toHaveLength(2);
  });

  it('a counted invoice never lists a payment marked returned', () => {
    const c = detail({ payments: [normalPay, { ...retPay, erpPlanId: 'p1' }] });
    render(<TooltipProvider><InvoiceViewer c={c} plan={open} onBack={() => {}} /></TooltipProvider>);
    const payments = screen.getByRole('table', { name: en.invoice.payments });
    expect(within(payments).getByText('PAY-20261101-00003')).toBeInTheDocument();
    expect(within(payments).queryByText('PAY-20260801-00001')).toBeNull();
    expect(screen.queryByTestId('returned-chip')).toBeNull();
  });
});

describe('payments tab', () => {
  it('tags payments to a returned invoice and leaves the others alone', () => {
    render(<TooltipProvider><PaymentsTab c={detail({})} /></TooltipProvider>);
    const rows = screen.getAllByRole('row').filter((r) => r.dataset.returned === 'true');
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(within(r).getByTestId('returned-payment-tag')).toHaveTextContent('Returned invoice');
    const normal = screen.getByText('PAY-20261101-00003').closest('tr')!;
    expect(within(normal).queryByTestId('returned-payment-tag')).toBeNull();
  });
});
