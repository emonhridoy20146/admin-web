import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { initI18n, i18n } from '@/shared/i18n';
import { TooltipProvider } from '@/shared/ui/primitives';
import type { components } from '@/shared/api/schema';
import bn from '../i18n/bn.json';
import en from '../i18n/en.json';
import type { CustomerDetail } from '../api/customers';

vi.mock('@/features/shell', () => ({ useBranches: () => ({ data: [] }) }));

const { InvoiceViewer } = await import('../components/invoice-viewer');
const { PlanCard } = await import('../components/customer-parts');
const { MonthActivity } = await import('../components/work-marks');

type Plan = components['schemas']['Plan'];

beforeAll(() => {
  initI18n({ customers: { bn, en } }, 'en');
});
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(cleanup);

const cash: Plan = { erpPlanId: 's2', kind: 'cash', invoiceNo: 'INV-S2', product: 'Electric kettle', status: 'closed', totalPayablePoisha: 250_000, paidPoisha: 200_000, outstandingPoisha: 50_000, saleDate: '2026-10-20', startDate: '2026-10-20', finalDueDate: '2026-10-20', schedule: [] };
const detail = (plans: Plan[], extra: Partial<CustomerDetail> = {}) => ({ id: 'c1', name: { en: 'Abdul Karim', bn: 'আব্দুল করিম' }, plans, payments: [], pendingCollections: [], erpFetchedAt: '2026-11-23T00:00:00Z', ...extra }) as unknown as CustomerDetail;

describe('cash sale on the customer pages (contract 1.44.0)', () => {
  it('the invoice viewer shows "Cash sale" with a neutral badge and nothing due, no schedule', async () => {
    await i18n.changeLanguage('en');
    render(<TooltipProvider><InvoiceViewer c={detail([cash])} plan={cash} onBack={() => {}} /></TooltipProvider>);
    expect(screen.getAllByText('Cash sale').length).toBeGreaterThan(0);
    expect(screen.getByTestId('cash-sale-badge')).toHaveTextContent('Cash sale');
    expect(screen.getAllByText('Nothing due').length).toBeGreaterThan(0);
    expect(screen.getByTestId('cash-sale-note')).toBeInTheDocument();
    expect(screen.queryByText(en.planStatus.closed)).toBeNull();
    expect(screen.queryByText(en.invoice.schedule)).toBeNull();
  });

  it('shows Bangla "নগদ বিক্রি", and an unknown kind renders like cash instead of crashing', async () => {
    await i18n.changeLanguage('bn');
    const odd = { ...cash, kind: 'layaway' } as unknown as Plan;
    render(<TooltipProvider><InvoiceViewer c={detail([odd])} plan={odd} onBack={() => {}} /></TooltipProvider>);
    expect(screen.getByTestId('cash-sale-badge')).toHaveTextContent('নগদ বিক্রি');
    cleanup();
    render(<PlanCard plan={odd} />);
    expect(screen.getByText('নগদ বিক্রি')).toBeInTheDocument();
    expect(screen.queryByText(bn.notCollectable)).toBeNull();
    await i18n.changeLanguage('en');
  });

  it('the plan card says nothing is due on a cash sale', () => {
    render(<PlanCard plan={cash} />);
    expect(screen.getByText('Cash sale')).toBeInTheDocument();
    expect(screen.getAllByText(/Nothing due/).length).toBeGreaterThan(0);
  });
});

describe('who did this month (contract 1.44.0, FR-CUS-021)', () => {
  const c = detail([], {
    openPromise: { id: 'p1', customerId: 'c1', promisedDate: '2026-11-28', promisedAmountPoisha: 300_000, status: 'open', createdByName: 'Rakib Hossain', ownerName: 'Rakib Hossain' },
    activity: {
      month: '2026-11', visitCount: 3, visitedToday: false, lastVisitAt: '2026-11-20T04:00:00Z', paidPoisha: 700_000, lastPaidDate: '2026-11-20', pendingPoisha: 150_000, promisesMade: 1, promisesKept: 0, promisesBroken: 0,
      visitedBy: [{ userId: 'u1', name: 'Rakib Hossain', count: 2, lastAt: '2026-11-20T04:00:00Z' }, { userId: 'u2', name: 'Nasima Akter', count: 1, lastAt: '2026-11-03T04:00:00Z' }],
      promisedBy: [{ userId: 'u1', name: 'Rakib Hossain', count: 1, lastAt: '2026-11-18T04:00:00Z' }],
      paidBy: [
        { name: 'Rakib Hossain', source: 'staff', userId: 'u1', amountPoisha: 150_000, lastDate: '2026-11-22', pending: true },
        { name: 'Shahid Ullah', source: 'erp_referrer', amountPoisha: 500_000, lastDate: '2026-11-20', pending: false },
        { name: '', source: 'unknown', amountPoisha: 200_000, lastDate: '2026-11-05', pending: false },
      ],
      lastVisitByName: 'Rakib Hossain', lastPaidByName: 'Rakib Hossain',
    },
  } as Partial<CustomerDetail>);

  it('names who visited, who took the money (office for unknown) and labels field money "not in ERP yet"', async () => {
    await i18n.changeLanguage('en');
    render(<MonthActivity c={c} />);
    const visits = screen.getByTestId('month-visits');
    expect(within(visits).getByText('Rakib Hossain')).toBeInTheDocument();
    expect(within(visits).getByText('×2')).toBeInTheDocument();
    expect(within(visits).getByText('Nasima Akter')).toBeInTheDocument();
    const paid = screen.getByTestId('month-paid');
    expect(within(paid).getByText('Shahid Ullah')).toBeInTheDocument();
    expect(within(paid).getByText('Office')).toBeInTheDocument();
    expect(within(paid).queryByText('not in ERP yet')).toBeNull();
    expect(within(paid).queryByText('Rakib Hossain')).toBeNull();
    const pending = screen.getByTestId('month-pending');
    expect(within(pending).getByText('Rakib Hossain')).toBeInTheDocument();
    expect(within(pending).getByText('not in ERP yet')).toBeInTheDocument();
    expect(within(screen.getByTestId('month-promises')).getByText(/promised by Rakib Hossain/)).toBeInTheDocument();
  });

  it('says "অফিস" and "এখনো ERP-তে নেই" in Bangla', async () => {
    await i18n.changeLanguage('bn');
    render(<MonthActivity c={c} />);
    expect(within(screen.getByTestId('month-paid')).getByText('অফিস')).toBeInTheDocument();
    expect(within(screen.getByTestId('month-pending')).getByText('এখনো ERP-তে নেই')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});
