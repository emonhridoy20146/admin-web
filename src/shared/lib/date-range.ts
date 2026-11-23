/**
 * FR-W-063: one date-range model for every list that filters by day (inbox, activity, visits, co-work, promises,
 * collections, possible customers). Days are Asia/Dhaka business dates (YYYY-MM-DD), both ends included.
 *
 * In the link: `range=<preset>` for a preset (the page's default preset writes nothing), or `from` + `to` for a custom
 * range. A link with only `from`/`to` (older links, dashboard links) is read as that range, and shown as the preset
 * it matches if any.
 */
import { DateTime } from 'luxon';
import { DHAKA, addDays } from './time';

export const RANGE_PRESETS = ['all', 'today', 'yesterday', '7d', '30d', 'month', 'lastMonth', 'next7', 'next15'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export type RangeChoice = RangePreset | 'custom';

/** Presets of a list that looks back (most lists). */
export const PAST_PRESETS: RangePreset[] = ['today', 'yesterday', '7d', '30d', 'month', 'lastMonth'];
/** Feeds that are useful without a date (inbox, activity): "All time" first and the default. */
export const FEED_PRESETS: RangePreset[] = ['all', 'today', 'yesterday', '7d', '30d', 'month', 'lastMonth'];
/** Promises also look ahead. */
export const PROMISE_PRESETS: RangePreset[] = ['today', 'next7', 'next15', 'yesterday', '7d', 'month', 'lastMonth', 'all'];

export interface DayRange {
  from: string;
  to: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDay(v: string | null | undefined): v is string {
  return !!v && ISO_DAY.test(v) && DateTime.fromISO(v, { zone: DHAKA }).isValid;
}

/**
 * The days a preset covers, seen from `today` (Asia/Dhaka). "Last 7 days" ends today; "Next 7 days" starts tomorrow.
 * "All time" has empty ends: the list is asked without dates.
 */
export function presetRange(p: RangePreset, today: string): DayRange {
  const d = DateTime.fromISO(today, { zone: DHAKA });
  switch (p) {
    case 'all':
      return { from: '', to: '' };
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case 'month':
      return { from: d.startOf('month').toISODate()!, to: today };
    case 'lastMonth': {
      const m = d.minus({ months: 1 });
      return { from: m.startOf('month').toISODate()!, to: m.endOf('month').toISODate()! };
    }
    case 'next7':
      return { from: addDays(today, 1), to: addDays(today, 7) };
    case 'next15':
      return { from: addDays(today, 1), to: addDays(today, 15) };
  }
}

/** The preset among `presets` that covers exactly these days, if any. */
export function matchPreset(r: DayRange, today: string, presets: readonly RangePreset[]): RangePreset | null {
  return presets.find((p) => {
    if (p === 'all') return false;
    const x = presetRange(p, today);
    return x.from === r.from && x.to === r.to;
  }) ?? null;
}

/** Puts the two ends in order; a range longer than `maxDays` is cut at its start. */
export function normalizeRange(r: DayRange, maxDays = 366): DayRange {
  const [a, b] = r.from <= r.to ? [r.from, r.to] : [r.to, r.from];
  const min = addDays(b, -(maxDays - 1));
  return { from: a < min ? min : a, to: b };
}

export interface ResolvedRange extends DayRange {
  choice: RangeChoice;
}

/** Reads the range from link values. Unknown values fall back to the default preset. */
export function readRange(
  v: { range?: string | null; from?: string | null; to?: string | null },
  today: string,
  presets: readonly RangePreset[],
  fallback: RangePreset,
): ResolvedRange {
  const p = (presets as readonly string[]).includes(v.range ?? '') ? (v.range as RangePreset) : null;
  if (p) return { choice: p, ...presetRange(p, today) };
  if (isIsoDay(v.from)) {
    const r = normalizeRange({ from: v.from, to: isIsoDay(v.to) ? v.to : v.from });
    return { choice: matchPreset(r, today, presets) ?? 'custom', ...r };
  }
  return { choice: fallback, ...presetRange(fallback, today) };
}

/** Link values for a choice: a preset writes `range` (nothing for the default), a custom range writes `from`/`to`. */
export function rangeParams(choice: RangeChoice, r: DayRange | null, fallback: RangePreset): { range: string | null; from: string | null; to: string | null } {
  if (choice !== 'custom') return { range: choice === fallback ? null : choice, from: null, to: null };
  const n = normalizeRange(r!);
  return { range: null, from: n.from, to: n.to };
}

/** Days in a range, both ends included. */
export function daysIn(r: DayRange): number {
  return Math.round(DateTime.fromISO(r.to, { zone: DHAKA }).diff(DateTime.fromISO(r.from, { zone: DHAKA }), 'days').days) + 1;
}

/** Instants for APIs that filter by date-time (`from` 00:00 to the end of `to`, Asia/Dhaka). */
export function rangeInstants(r: DayRange): { from: string; to: string } {
  return {
    from: DateTime.fromISO(r.from, { zone: DHAKA }).startOf('day').toUTC().toISO()!,
    to: DateTime.fromISO(r.to, { zone: DHAKA }).endOf('day').toUTC().toISO()!,
  };
}
