import { addDays } from '@/shared/lib/time';
import type { Visit, VisitOutcome } from '../api/visits';

export const RANGES = ['today', 'yesterday', '7d', '30d'] as const;
export type Range = (typeof RANGES)[number];

export function rangeFor(r: Range, today: string): { from: string; to: string } {
  switch (r) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
  }
}

export const OUTCOMES: VisitOutcome[] = ['paid', 'partial_paid', 'promised', 'not_home', 'refused', 'shifted_address', 'customer_dead', 'product_returned_request', 'other'];

/** Whole minutes between check-in and check-out; null while the visit is still open. */
export function durationMin(v: Pick<Visit, 'checkInAt' | 'checkOutAt'>): number | null {
  if (!v.checkOutAt) return null;
  return Math.max(0, Math.round((Date.parse(v.checkOutAt) - Date.parse(v.checkInAt)) / 60_000));
}

export type GeoState = 'ok' | 'far' | 'mock' | 'none';

/** One location verdict per visit, worst first: fake GPS, no fix, far from the customer's pin, fine. */
export function geoState(v: Pick<Visit, 'geo' | 'flags' | 'distanceToPinM'>, farM = 300): GeoState {
  if (v.geo?.mock || v.flags?.includes('mock_location')) return 'mock';
  if (!v.geo) return 'none';
  if (v.flags?.includes('far_from_pin') || (v.distanceToPinM ?? 0) > farM) return 'far';
  return 'ok';
}

/** Visit kind filter (FR-CW-004): recorded alone, or together with co-work partners. */
export const KINDS = ['single', 'joint'] as const;

/** FR-CW-003: a joint visit, a single one, or one that claimed co-work the server could not confirm (kept as single). */
export function coWorkState(v: Pick<Visit, 'coWork' | 'flags'>): 'joint' | 'single' | 'invalid' {
  if (v.flags?.includes('cowork_invalid')) return 'invalid';
  return v.coWork ? 'joint' : 'single';
}
