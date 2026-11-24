/**
 * FR-W-064 dashboard figures worked out from per-day collections (reports/branch-trends, granularity day).
 * Pure functions: the page and the tests agree on what "this month vs last month" means.
 */
import { DateTime } from 'luxon';
import { DHAKA, addDays } from '@/shared/lib/time';

export interface DayPoint {
  period?: string;
  totalPoisha?: number;
  cashPoisha?: number;
  mobilePoisha?: number;
  count?: number;
  visits?: number;
}

export interface Day {
  date: string;
  total: number;
  cash: number;
  mobile: number;
  count: number;
  visits: number;
}

/** One entry per calendar day from `from` to `to` (days without collections are zero). */
export function fillDays(points: DayPoint[] | undefined, from: string, to: string): Day[] {
  const by = new Map((points ?? []).filter((p) => p.period).map((p) => [p.period!.slice(0, 10), p]));
  const out: Day[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const p = by.get(d);
    out.push({ date: d, total: p?.totalPoisha ?? 0, cash: p?.cashPoisha ?? 0, mobile: p?.mobilePoisha ?? 0, count: p?.count ?? 0, visits: p?.visits ?? 0 });
  }
  return out;
}

export interface MonthCompare {
  /** collected from the 1st of this month to today */
  monthToDate: number;
  /** collected over the same days of last month (1st to the same day number, cut at the month's end) */
  lastMonthSameDays: number;
  /** whole of last month */
  lastMonthTotal: number;
  /** ratio change, null when last month had nothing to compare with */
  delta: number | null;
  /** running totals per day of the month: this month up to today, last month for every day it has */
  cumulative: { day: number; thisMonth: number | null; lastMonth: number | null }[];
  thisMonthStart: string;
  lastMonthStart: string;
  lastMonthEnd: string;
}

export function monthCompare(days: Day[], today: string): MonthCompare {
  const t = DateTime.fromISO(today, { zone: DHAKA });
  const thisStart = t.startOf('month').toISODate()!;
  const lm = t.minus({ months: 1 });
  const lastStart = lm.startOf('month').toISODate()!;
  const lastEnd = lm.endOf('month').toISODate()!;
  const dayNo = t.day;
  const lastDays = lm.daysInMonth ?? 31;
  const inThis = days.filter((d) => d.date >= thisStart && d.date <= today);
  const inLast = days.filter((d) => d.date >= lastStart && d.date <= lastEnd);
  const sameCut = lm.set({ day: Math.min(dayNo, lastDays) }).toISODate()!;
  const monthToDate = inThis.reduce((s, d) => s + d.total, 0);
  const lastMonthSameDays = inLast.filter((d) => d.date <= sameCut).reduce((s, d) => s + d.total, 0);
  const lastMonthTotal = inLast.reduce((s, d) => s + d.total, 0);
  const cumulative: MonthCompare['cumulative'] = [];
  let a = 0;
  let b = 0;
  const byThis = new Map(inThis.map((d) => [Number(d.date.slice(8, 10)), d.total]));
  const byLast = new Map(inLast.map((d) => [Number(d.date.slice(8, 10)), d.total]));
  for (let n = 1; n <= Math.max(lastDays, t.daysInMonth ?? 31); n++) {
    a += byThis.get(n) ?? 0;
    b += byLast.get(n) ?? 0;
    cumulative.push({ day: n, thisMonth: n <= dayNo ? a : null, lastMonth: n <= lastDays ? b : null });
  }
  return {
    monthToDate,
    lastMonthSameDays,
    lastMonthTotal,
    delta: lastMonthSameDays > 0 ? monthToDate / lastMonthSameDays - 1 : null,
    cumulative,
    thisMonthStart: thisStart,
    lastMonthStart: lastStart,
    lastMonthEnd: lastEnd,
  };
}

/** Promise keeping this month from per-person rows: kept ÷ due, null without any promise due. */
export function promiseRate(rows: { promisesDue?: number; promisesKept?: number }[] | undefined): { due: number; kept: number; rate: number | null } {
  let due = 0;
  let kept = 0;
  for (const r of rows ?? []) {
    due += r.promisesDue ?? 0;
    kept += r.promisesKept ?? 0;
  }
  return { due, kept, rate: due > 0 ? kept / due : null };
}

/** Share of each part of a whole; parts with nothing are kept so the legend stays complete. */
export function shares<K extends string>(parts: Record<K, number>): { key: K; n: number; share: number }[] {
  const keys = Object.keys(parts) as K[];
  const total = keys.reduce((s, k) => s + Math.max(0, parts[k]), 0);
  return keys.map((k) => ({ key: k, n: parts[k], share: total ? Math.max(0, parts[k]) / total : 0 }));
}

export interface ApiLink {
  path: string;
  query?: Record<string, string>;
}

/** API query keys → the admin page's own link keys, per list (FR-DSH-002 links, 1.45.0). */
const PAGES: Record<string, { page: string; keys: Record<string, string | null> }> = {
  '/collections': { page: '/collections/', keys: { from: 'from', to: 'to', method: 'method', status: 'status', collectorId: 'collectorId', flag: 'flag', branchId: 'branch' } },
  '/visits': { page: '/visits/', keys: { from: 'from', to: 'to', date: null, outcome: 'outcome', userId: 'userId', coWork: null, branchId: 'branch' } },
  '/promises': { page: '/promises/', keys: { from: 'from', to: 'to', status: 'status', createdBy: 'staff', brokenWithoutFollowUp: 'nofollow', branchId: 'branch' } },
  '/customers': { page: '/customers/', keys: { filter: 'filter', payState: 'pay', invoiceKind: 'kind', paidThisMonth: 'paid', branchId: 'branch' } },
  '/prospects': { page: '/prospects/', keys: { from: 'from', to: 'to', status: 'status', createdBy: 'staff', branchId: 'branch' } },
  '/location-proposals': { page: '/pin-approvals/', keys: { status: 'status', branchId: 'branch' } },
  '/cowork/sessions': { page: '/cowork/', keys: { from: 'from', to: 'to', userId: 'userId', branchId: 'branch' } },
  '/attendance/days': { page: '/attendance/', keys: { branchId: 'branch' } },
  '/cash/positions': { page: '/cash/', keys: { branchId: 'branch' } },
  // 1.48.0 requestStats: the inbox opens on the queue the number counts (see requestsHref for the special values)
  '/requests': { page: '/requests/', keys: { queue: 'queue', status: 'status', priority: 'priority', branchId: 'branch' } },
};

const ACTIVE_REQUESTS = 'open,in_progress,forwarded,reopened';

/**
 * Turns the list link the server gives with a dashboard number into the admin page that shows those rows, with the
 * page's filters set (a key the page does not know is dropped; `brokenWithoutFollowUp=true` becomes `nofollow=1`).
 * Unknown lists fall back to `fallback`.
 */
export function pageHref(link: ApiLink | null | undefined, fallback: string): string {
  if (!link?.path) return fallback;
  const path = link.path.replace(/^\/api\/v1/, '').replace(/\/$/, '');
  const m = PAGES[path];
  if (!m) return fallback;
  const out = new URLSearchParams();
  if (path === '/requests') return requestsHref(link.query ?? {}, m.page);
  for (const [k, v] of Object.entries(link.query ?? {})) {
    const key = m.keys[k];
    if (!key || v === '' || v == null) continue;
    if (k === 'brokenWithoutFollowUp') {
      if (v === 'true') out.set(key, '1');
      continue;
    }
    if (k === 'status' && path === '/location-proposals' && v === 'pending') continue;
    out.set(key, v);
  }
  const qs = out.toString();
  return qs ? `${m.page}?${qs}` : m.page;
}

/**
 * The requests inbox's own link for a requestStats number (FR-W-070): a queue opens that queue tab; `queue=assignee`
 * (waiting with a person) opens All with the "with a person" filter; no queue opens All; the "not finished" statuses are
 * the page's default and are left out; one status stays as it is.
 */
function requestsHref(query: Record<string, string>, page: string): string {
  const out = new URLSearchParams();
  const queue = query.queue;
  if (queue === 'area_manager' || queue === 'super_admin') out.set('queue', queue);
  else {
    out.set('queue', 'all');
    if (queue === 'assignee') out.set('where', 'assignee');
  }
  if (query.status && query.status !== ACTIVE_REQUESTS) out.set('status', query.status.includes(',') ? 'any' : query.status);
  if (query.priority) out.set('priority', query.priority);
  if (query.branchId) out.set('branch', query.branchId);
  return `${page}?${out.toString()}`;
}
