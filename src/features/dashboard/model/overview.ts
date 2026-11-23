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
