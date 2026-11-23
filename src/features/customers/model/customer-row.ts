import type { Locale } from '@/shared/lib/format';
import type { CustomerListItem } from '../api/customers';
import { payStateOf, type PayState } from './pay-state';

/** Status display order: most urgent / most consequential first (03 §1 "status first"). */
export const STATUS_ORDER = ['tagged_bad', 'bad_suggested', 'overdue', 'promised_today', 'due_today', 'current', 'paid_up'] as const;

export interface CustomerRowVM {
  id: string;
  code: string;
  name: string;
  altName: string;
  phone: string;
  address: string;
  /** Assignment area name (1.2.0); falls back to the address when the customer is in no area */
  areaName: string | null;
  /** ERP installment amount, null when plans differ or are unknown */
  installmentPoisha: number | null;
  /** ERP overdue amount (part of outstanding, never added to it) */
  overduePoisha: number;
  assigneeName: string | null;
  outstandingPoisha: number;
  pendingFieldPoisha: number;
  daysOverdue: number;
  nextDue: string | null;
  statuses: string[];
  lastVisitAt: string | null;
  /** who made the visit at `lastVisitAt` (contract 1.44.0); null when unknown */
  lastVisitByName: string | null;
  openPromise: { date: string; amountPoisha: number; byName: string | null } | null;
  hasLocation: boolean;
  asOf: string | null;
  /** 0 (calm) … 3 (most urgent), drives row emphasis */
  urgency: 0 | 1 | 2 | 3;
  /** 1.14.0: the colour of the customer's map pin (read from the old status on an older server) */
  payState: PayState;
  missedCount: number | null;
  /** open invoices by kind; null when the server does not send them yet */
  openInvoices: { installment: number; credit: number } | null;
  /** 1.24.0: every invoice of the customer (cancelled ones not counted); null on an older server */
  invoiceTotal: number | null;
  /** the list item itself, for the work marks (FR-W-037) */
  item: CustomerListItem;
}

/** Statuses the pay-state badge already says (overdue, due today, paid up, current) are left out next to it. */
const SAID_BY_PAY_STATE = new Set(['overdue', 'due_today', 'paid_up', 'current']);
export function extraStatuses(statuses: string[]): string[] {
  return statuses.filter((s) => !SAID_BY_PAY_STATE.has(s));
}

export function sortStatuses(badges: string[]): string[] {
  const rank = (s: string) => {
    const i = (STATUS_ORDER as readonly string[]).indexOf(s);
    return i === -1 ? 99 : i;
  };
  return [...new Set(badges)].sort((a, b) => rank(a) - rank(b));
}

export function toCustomerRow(c: CustomerListItem, locale: Locale): CustomerRowVM {
  const bn = c.name?.bn ?? '';
  const en = c.name?.en ?? '';
  const statuses = sortStatuses(c.badges ?? []);
  const days = c.daysOverdue ?? 0;
  const urgency: CustomerRowVM['urgency'] = statuses.includes('tagged_bad') || days > 90 ? 3 : days > 30 || statuses.includes('bad_suggested') ? 2 : days > 0 ? 1 : 0;
  return {
    id: c.id ?? '',
    code: c.code ?? '',
    name: (locale === 'bn' ? bn || en : en || bn) ?? '',
    altName: locale === 'bn' ? en : bn,
    phone: c.phone ?? '',
    address: c.address ?? '',
    areaName: c.areaName ? (locale === 'bn' ? c.areaName.bn || c.areaName.en : c.areaName.en || c.areaName.bn) || null : null,
    installmentPoisha: c.installmentPoisha ?? null,
    overduePoisha: c.overduePoisha ?? 0,
    assigneeName: c.assignee?.name ?? null,
    outstandingPoisha: c.totalOutstandingPoisha ?? 0,
    pendingFieldPoisha: c.pendingFieldPoisha ?? 0,
    daysOverdue: days,
    nextDue: c.nextDueDate ?? null,
    statuses,
    lastVisitAt: c.lastVisitAt ?? null,
    lastVisitByName: c.lastVisitByName ?? null,
    openPromise: c.openPromise ? { date: c.openPromise.promisedDate, amountPoisha: c.openPromise.promisedAmountPoisha, byName: c.openPromise.createdByName ?? null } : null,
    hasLocation: (c.location?.status === 'ok' || c.location?.status === 'overridden') && c.location.lat != null,
    asOf: c.erpFetchedAt ?? null,
    urgency,
    payState: payStateOf(c),
    missedCount: c.missedCount ?? null,
    openInvoices: c.openInvoices ? { installment: c.openInvoices.installment ?? 0, credit: c.openInvoices.credit ?? 0 } : null,
    invoiceTotal: c.invoiceCount?.total ?? null,
    item: c,
  };
}
