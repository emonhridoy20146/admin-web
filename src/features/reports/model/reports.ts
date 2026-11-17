import { addDays } from '@/shared/lib/time';
import type { DataQualityIssue, ExportBody, ExportFormat, ExportType, Granularity, Mismatch, Recon, Trends } from '../api/reports';

export const TABS = ['trends', 'reconciliation', 'exports'] as const;
export type Tab = (typeof TABS)[number];

export const RANGES = ['7d', '30d', '90d'] as const;
export type Range = (typeof RANGES)[number];

/** The window ends today; 90 days are shown by week (weeks start on Saturday on the server). */
export function rangeWindow(range: Range, today: string): { from: string; to: string; granularity: Granularity } {
  const days = range === '7d' ? 6 : range === '30d' ? 29 : 89;
  return { from: addDays(today, -days), to: today, granularity: range === '90d' ? 'week' : 'day' };
}

type CollectionPoint = NonNullable<Trends['collection']>[number];

export interface CollectionTotals {
  totalPoisha: number;
  cashPoisha: number;
  mobilePoisha: number;
  count: number;
  visits: number;
}

export function collectionTotals(points: CollectionPoint[] | undefined): CollectionTotals {
  const out = { totalPoisha: 0, cashPoisha: 0, mobilePoisha: 0, count: 0, visits: 0 };
  for (const p of points ?? []) {
    out.totalPoisha += p.totalPoisha ?? 0;
    out.cashPoisha += p.cashPoisha ?? 0;
    out.mobilePoisha += p.mobilePoisha ?? 0;
    out.count += p.count ?? 0;
    out.visits += p.visits ?? 0;
  }
  return out;
}

export const BUCKETS = ['d1_30', 'd31_60', 'd61_90', 'd90p'] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface OverdueView {
  date: string;
  totalPoisha: number;
  totalCount: number;
  buckets: { key: Bucket; poisha: number; count: number; share: number }[];
  badSuggested: number;
  tagged: number;
  /** change of the overdue amount against the first snapshot in the window; null with a single snapshot */
  changePoisha: number | null;
  since: string | null;
}

/** Latest overdue snapshot of the window (ERP figures, frozen nightly) with the movement since the first one. */
export function overdueView(rows: Trends['overdue']): OverdueView | null {
  const sorted = [...(rows ?? [])].filter((r) => r.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const last = sorted.at(-1);
  if (!last) return null;
  const first = sorted[0]!;
  const total = last.totalOverdue?.amountPoisha ?? 0;
  const buckets = BUCKETS.map((key) => {
    const b = last.buckets?.[key];
    return { key, poisha: b?.amountPoisha ?? 0, count: b?.count ?? 0, share: total > 0 ? (b?.amountPoisha ?? 0) / total : 0 };
  });
  return {
    date: last.date!, totalPoisha: total, totalCount: last.totalOverdue?.count ?? 0, buckets, badSuggested: last.badSuggested ?? 0, tagged: last.tagged ?? 0,
    changePoisha: sorted.length > 1 ? total - (first.totalOverdue?.amountPoisha ?? 0) : null, since: sorted.length > 1 ? first.date! : null,
  };
}

export const MISMATCH_KINDS = ['not_posted', 'missing_in_erp', 'missing_in_fos', 'amount_differs', 'reversed_in_erp', 'voided_in_fos'] as const;
export type MismatchKind = (typeof MISMATCH_KINDS)[number];

export function kindCounts(rows: Mismatch[] | undefined): { kind: MismatchKind; count: number }[] {
  return MISMATCH_KINDS.map((kind) => ({ kind, count: (rows ?? []).filter((m) => m.kind === kind).length })).filter((k) => k.count > 0);
}

/** FOS minus ERP for one row; null when either side is missing. */
export function difference(m: Pick<Mismatch, 'fosAmountPoisha' | 'erpAmountPoisha'>): number | null {
  return typeof m.fosAmountPoisha === 'number' && typeof m.erpAmountPoisha === 'number' ? m.fosAmountPoisha - m.erpAmountPoisha : null;
}

/** Posted field money minus what the ERP reported for the day. Both sides are shown too; this is only the gap. */
export function reconGap(r: Pick<Recon, 'totals'> | undefined): number {
  return (r?.totals?.fosPostedPoisha ?? 0) - (r?.totals?.erpPoisha ?? 0);
}

export const EXPORT_TYPES = ['collections', 'staff_performance', 'attendance', 'overdue_customers', 'cash_positions', 'data_quality', 'audit'] as const satisfies readonly ExportType[];
export type OfferedType = (typeof EXPORT_TYPES)[number];
/** `pdf` (contract 1.10.0) is built by the server: A4 landscape with the Bangla font embedded. */
export const EXPORT_FORMATS = ['xlsx', 'csv', 'pdf'] as const satisfies readonly ExportFormat[];
export type OfferedFormat = (typeof EXPORT_FORMATS)[number];

/** Longest range the server accepts per type, in days (contract 1.6.0). */
export const MAX_DAYS: Partial<Record<OfferedType, number>> = { collections: 92, attendance: 62, audit: 31 };
/** Permission a type needs on top of `report.export` (contract 1.7.1: the audit export needs `audit.view`). */
export const TYPE_PERMISSION: Partial<Record<OfferedType, string>> = { audit: 'audit.view' };
export const needsRange = (t: OfferedType) => t === 'collections' || t === 'attendance' || t === 'audit';
export const needsPeriod = (t: OfferedType) => t === 'staff_performance';
/** data_quality (1.10.0) can be narrowed to one issue; empty means every issue. */
export const takesIssue = (t: OfferedType) => t === 'data_quality';

export interface ExportForm {
  type: OfferedType;
  format: OfferedFormat;
  from: string;
  to: string;
  period: 'daily' | 'monthly';
  date: string;
  issue?: DataQualityIssue | '';
}

export type ExportError = 'order' | 'future' | 'tooLong';

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function validateExport(f: ExportForm, today: string): ExportError | null {
  if (needsRange(f.type)) {
    if (f.from > f.to) return 'order';
    if (f.to > today) return 'future';
    if (daysBetween(f.from, f.to) > (MAX_DAYS[f.type] ?? Infinity)) return 'tooLong';
  }
  if (needsPeriod(f.type) && f.date > today) return 'future';
  return null;
}

export function exportBody(f: ExportForm, branchId: string | undefined, locale: 'bn' | 'en'): ExportBody {
  const scope = branchId ? { branchId } : {};
  const params = needsRange(f.type)
    ? { from: f.from, to: f.to, ...scope }
    : needsPeriod(f.type)
      ? { period: f.period, date: f.date, ...scope }
      : takesIssue(f.type) && f.issue
        ? { ...scope, issue: f.issue }
        : scope;
  return { type: f.type, format: f.format, params, locale };
}
