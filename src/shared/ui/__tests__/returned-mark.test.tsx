import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { initI18n, i18n } from '@/shared/i18n';
import { ReturnedMark, StatusBadge } from '../badge';
import { opensCustomer, returnedMark, STATUS } from '../status';
import { pinIconHtml } from '../../map/pin-icon';

beforeAll(() => {
  initI18n({}, 'en');
});
afterEach(cleanup);

/** FR-W-074 (contract 1.53.0): the returned marker of customer rows, map pins and ⌘K hits. */
describe('returnedMark', () => {
  it('is nothing without returned invoices, also when an older server leaves the fields out', () => {
    expect(returnedMark(undefined)).toBeNull();
    expect(returnedMark({})).toBeNull();
    expect(returnedMark({ returnedInvoiceCount: 0, onlyReturned: false })).toBeNull();
  });
  it('counts returned invoices next to counted ones, and says "only returned" when every invoice was returned', () => {
    expect(returnedMark({ returnedInvoiceCount: 2 })).toEqual({ status: 'returned_count', n: 2 });
    expect(returnedMark({ returnedInvoiceCount: 1, onlyReturned: true })).toEqual({ status: 'only_returned', n: 1 });
  });
  it('has a colour, its own icon and a label for every returned status', () => {
    for (const s of ['returned', 'returned_count', 'only_returned', 'returned_payment']) {
      expect(STATUS[s]?.tone).toBeTruthy();
      expect(STATUS[s]?.icon).toBeTruthy();
      expect(STATUS[s]?.label).toBe(`status.${s}`);
    }
  });
});

/** FR-W-074 (owner decision 2026-11-26): an only-returned customer does not open in admin either. */
describe('opensCustomer', () => {
  it('opens customers without returned invoices, with some returned, and from older servers', () => {
    expect(opensCustomer(undefined)).toBe(true);
    expect(opensCustomer({})).toBe(true);
    expect(opensCustomer({ returnedInvoiceCount: 2, onlyReturned: false })).toBe(true);
  });
  it('does not open a customer whose every invoice was returned', () => {
    expect(opensCustomer({ returnedInvoiceCount: 1, onlyReturned: true })).toBe(false);
  });
  it('has the reason in both languages', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('status.only_returned_hint')).toBe('Returned product customer: no open invoices');
    await i18n.changeLanguage('bn');
    expect(i18n.t('status.only_returned_hint')).toBe('ফেরত পণ্যের customer: কোনো খোলা চালান নেই');
    await i18n.changeLanguage('en');
  });
});

describe('<ReturnedMark>', () => {
  it('renders "Returned ×N" with an icon (colour + icon + label)', async () => {
    await i18n.changeLanguage('en');
    render(<ReturnedMark of={{ returnedInvoiceCount: 3 }} />);
    const mark = screen.getByTestId('returned-mark');
    expect(mark).toHaveTextContent('Returned ×3');
    expect(mark.className).toMatch(/bg-st-returned-bg/);
    expect(mark.querySelector('svg')).not.toBeNull();
    expect(mark.dataset.status).toBe('returned_count');
  });
  it('renders the returned product customer label in both languages', async () => {
    await i18n.changeLanguage('en');
    render(<ReturnedMark of={{ returnedInvoiceCount: 1, onlyReturned: true }} />);
    expect(screen.getByTestId('returned-mark')).toHaveTextContent('Returned product customer');
    cleanup();
    await i18n.changeLanguage('bn');
    render(<ReturnedMark of={{ returnedInvoiceCount: 1, onlyReturned: true }} />);
    expect(screen.getByTestId('returned-mark')).toHaveTextContent('ফেরত পণ্যের customer');
    await i18n.changeLanguage('en');
  });
  it('renders nothing for a customer without returned invoices', () => {
    const { container } = render(<ReturnedMark of={{ returnedInvoiceCount: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('StatusBadge keeps its plain markup when no test id is asked for', () => {
    render(<StatusBadge status="overdue" />);
    expect(screen.getByText('Overdue').closest('[data-status]')).toBeNull();
  });
});

describe('map pin corner mark', () => {
  it('draws the corner mark from tokens only when asked', () => {
    const plain = pinIconHtml({ fill: '--ps-on-track-pin', edge: '--ps-on-track-fg', glyph: 'check' });
    expect(plain).not.toContain('fos-pin-corner');
    const marked = pinIconHtml({ fill: '--ps-on-track-pin', edge: '--ps-on-track-fg', glyph: 'check', corner: { fill: '--st-returned-fg', edge: '--neutral-0' } });
    expect(marked).toContain('fos-pin-corner');
    expect(marked).toContain('--pin-corner-fill:var(--st-returned-fg)');
    expect(marked).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
