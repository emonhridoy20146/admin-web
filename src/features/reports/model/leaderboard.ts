import type { LeaderboardRow, LeaderMetric, LeaderPeriod } from '../api/reports';

export const PERIODS: LeaderPeriod[] = ['day', 'month'];
export const METRICS: LeaderMetric[] = ['collected', 'visit_credit', 'promises_kept', 'target_achievement'];

/** The API takes YYYY-MM-DD for a day and YYYY-MM for a month. */
export function periodDate(period: LeaderPeriod, date: string): string {
  return period === 'month' ? date.slice(0, 7) : date;
}

/** Ranks held by more than one person (the server gives equal values the same rank: 1, 2, 2, 4). */
export function sharedRanks(rows: Pick<LeaderboardRow, 'rank'>[]): Set<number> {
  const seen = new Map<number, number>();
  for (const r of rows) if (r.rank != null) seen.set(r.rank, (seen.get(r.rank) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}

/** Ranked rows first in server order, then the unranked ones (too few present days, or no target for achievement). */
export function splitRanked<T extends Pick<LeaderboardRow, 'rank'>>(rows: T[]): { ranked: T[]; unranked: T[] } {
  return { ranked: rows.filter((r) => r.rank != null), unranked: rows.filter((r) => r.rank == null) };
}

/** Visit credit can carry a fraction when joint visits are weighted below 100 %. */
export function creditDecimals(v: number): number {
  return Number.isInteger(v) ? 0 : 2;
}
