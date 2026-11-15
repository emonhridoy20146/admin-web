import type { Locale } from '@/shared/lib/format';
import type { CustomerListItem } from '../api/customers';

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
  openPromise: { date: string; amountPoisha: number } | null;
  hasLocation: boolean;
  asOf: string | null;
  /** 0 (calm) … 3 (most urgent), drives row emphasis */
  urgency: 0 | 1 | 2 | 3;
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
    openPromise: c.openPromise ? { date: c.openPromise.promisedDate, amountPoisha: c.openPromise.promisedAmountPoisha } : null,
    hasLocation: c.location?.status === 'ok' && c.location.lat != null,
    asOf: c.erpFetchedAt ?? null,
    urgency,
  };
}
