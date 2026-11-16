import type { PerfRow } from '../api/staff';

export const METHOD_ORDER = ['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'other_mobile'] as const;

export function collected(r: Pick<PerfRow, 'collectedPoisha'>): number {
  return r.collectedPoisha?.total ?? 0;
}

/** Share of the target reached, 0…1+ (not clamped: over-achievement is shown as such). null without a target. */
export function targetRatio(r: Pick<PerfRow, 'collectedPoisha' | 'targetPoisha'>): number | null {
  return r.targetPoisha ? collected(r) / r.targetPoisha : null;
}

/** Collected amount per payment method, in display order, zero amounts dropped. */
export function byMethod(r: Pick<PerfRow, 'collectedPoisha'>): { method: string; poisha: number }[] {
  const m = r.collectedPoisha ?? {};
  const known = METHOD_ORDER.filter((k) => (m[k] ?? 0) > 0).map((k) => ({ method: k as string, poisha: m[k]! }));
  const other = Object.keys(m).filter((k) => k !== 'total' && !(METHOD_ORDER as readonly string[]).includes(k) && (m[k] ?? 0) > 0).map((k) => ({ method: k, poisha: m[k]! }));
  return [...known, ...other];
}

export interface Totals {
  collectedPoisha: number;
  targetPoisha: number;
  visits: number;
  collections: number;
  promisesDue: number;
  promisesKept: number;
}

export function totals(rows: PerfRow[] | undefined): Totals {
  const t: Totals = { collectedPoisha: 0, targetPoisha: 0, visits: 0, collections: 0, promisesDue: 0, promisesKept: 0 };
  for (const r of rows ?? []) {
    t.collectedPoisha += collected(r);
    t.targetPoisha += r.targetPoisha ?? 0;
    t.visits += r.visits ?? 0;
    t.collections += r.collectionsCount ?? 0;
    t.promisesDue += r.promisesDue ?? 0;
    t.promisesKept += r.promisesKept ?? 0;
  }
  return t;
}

export const SORTS = ['collected', 'visits', 'promises', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export function sortRows(rows: PerfRow[], sort: Sort): PerfRow[] {
  const by: Record<Sort, (a: PerfRow, b: PerfRow) => number> = {
    collected: (a, b) => collected(b) - collected(a),
    visits: (a, b) => visitCredit(b) - visitCredit(a),
    promises: (a, b) => (b.promiseFulfilmentRate ?? -1) - (a.promiseFulfilmentRate ?? -1),
    name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
  };
  return [...rows].sort((a, b) => by[sort](a, b) || (a.name ?? '').localeCompare(b.name ?? ''));
}

type VisitFigures = Pick<PerfRow, 'visits' | 'soloVisits' | 'coWorkVisits' | 'visitCredit'>;

/**
 * FR-CW-005: visits this person took part in, alone or as part of a co-work group (a joint visit counts once per person).
 * A server without co-work figures only has the visits the person recorded.
 */
export function visitsTakenPart(r: VisitFigures): number {
  return r.soloVisits == null && r.coWorkVisits == null ? (r.visits ?? 0) : (r.soloVisits ?? 0) + (r.coWorkVisits ?? 0);
}

/** The visit figure targets use: single + joint × the `cowork.visitCredit` weight (computed by the server). */
export function visitCredit(r: VisitFigures): number {
  return r.visitCredit ?? visitsTakenPart(r);
}

/** What one joint visit was worth for this row (0…1), read back from the server's figures; null without joint visits. */
export function jointWeight(r: VisitFigures): number | null {
  if (!r.coWorkVisits) return null;
  const w = (visitCredit(r) - (r.soloVisits ?? 0)) / r.coWorkVisits;
  return Math.min(1, Math.max(0, Math.round(w * 100) / 100));
}
