import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { initI18n } from '@/shared/i18n';
import bn from '../i18n/bn.json';
import en from '../i18n/en.json';

/** FR-W-073 (contract 1.53.0): an ERP payment to a returned invoice is tagged on the timeline; the server's summary already says so. */
vi.mock('../api/customers', async (orig) => ({
  ...(await orig<typeof import('../api/customers')>()),
  useTimeline: () => ({
    isLoading: false,
    error: null,
    hasNextPage: false,
    data: {
      pages: [
        {
          items: [
            { kind: 'erp_payment', at: '2026-11-01T06:00:00Z', actor: { name: 'Office' }, summary: { en: 'ERP payment PAY-1', bn: 'ERP পেমেন্ট PAY-1' }, refId: 'n1', data: { amountPoisha: 500_000 } },
            { kind: 'erp_payment', at: '2026-09-01T06:00:00Z', actor: { name: 'Office' }, summary: { en: 'ERP payment PAY-2 (returned invoice)', bn: 'ERP পেমেন্ট PAY-2 (ফেরত চালান)' }, refId: 'r2', data: { amountPoisha: 300_000, returned: true, erpPlanId: 'p9' } },
          ],
        },
      ],
    },
  }),
}));
const { TimelineTab } = await import('../components/timeline-tab');

beforeAll(() => {
  initI18n({ customers: { bn, en } }, 'en');
});
afterEach(cleanup);

describe('timeline', () => {
  it('tags only the payment to a returned invoice', () => {
    render(<TimelineTab customerId="c1" />);
    const tags = screen.getAllByTestId('returned-payment-tag');
    expect(tags).toHaveLength(1);
    expect(tags[0]!.closest('li')).toHaveTextContent('ERP payment PAY-2 (returned invoice)');
    expect(screen.getByText('ERP payment PAY-1').closest('li')!.querySelector('[data-testid="returned-payment-tag"]')).toBeNull();
  });
});
