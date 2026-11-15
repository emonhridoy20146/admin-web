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
    visits: (a, b) => (b.visits ?? 0) - (a.visits ?? 0),
    promises: (a, b) => (b.promiseFulfilmentRate ?? -1) - (a.promiseFulfilmentRate ?? -1),
    name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
  };
  return [...rows].sort((a, b) => by[sort](a, b) || (a.name ?? '').localeCompare(b.name ?? ''));
}
