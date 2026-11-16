import type { ErpStatus, SyncState } from '../api/system';

export type Level = 'ok' | 'warn' | 'bad';

/** Same bands as the header dot: under 15 minutes is fine, under an hour is a warning. */
export function erpLevel(e: Pick<ErpStatus, 'lagSec' | 'circuit' | 'mode' | 'outboxFailed'> | undefined): Level {
  if (!e) return 'warn';
  if (e.circuit === 'open' || (e.lagSec ?? 0) >= 3600) return 'bad';
  if (e.circuit === 'half_open' || (e.lagSec ?? 0) >= 900 || (e.outboxFailed ?? 0) > 0 || e.mode === 'record_only') return 'warn';
  return 'ok';
}

export const STUCK_MIN = 60;

const minutesAgo = (iso: string | undefined, now: Date) => (iso ? Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000)) : null);

/** bad: the phone reported an error, or holds unsent work and has not pushed for an hour. warn: unsent work, or silent for an hour. */
export function syncLevel(s: SyncState, now: Date = new Date()): Level {
  const push = minutesAgo(s.lastPushAt, now);
  const pull = minutesAgo(s.lastPullAt, now);
  const pending = s.pendingReported ?? 0;
  if (s.lastError || (pending > 0 && (push === null || push >= STUCK_MIN))) return 'bad';
  if (pending > 0 || pull === null || pull >= STUCK_MIN) return 'warn';
  return 'ok';
}

export function sortSync(rows: SyncState[], now: Date = new Date()): SyncState[] {
  const rank = { bad: 0, warn: 1, ok: 2 } as const;
  return [...rows].sort((a, b) => rank[syncLevel(a, now)] - rank[syncLevel(b, now)] || (b.pendingReported ?? 0) - (a.pendingReported ?? 0) || (a.userName ?? '').localeCompare(b.userName ?? ''));
}

export function syncCounts(rows: SyncState[] | undefined, now: Date = new Date()): Record<Level, number> & { pending: number } {
  const out = { ok: 0, warn: 0, bad: 0, pending: 0 };
  for (const r of rows ?? []) {
    out[syncLevel(r, now)]++;
    out.pending += r.pendingReported ?? 0;
  }
  return out;
}
