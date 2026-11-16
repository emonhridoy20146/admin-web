import type { Latest, Stop } from '../api/location';

export const FRESHNESS = ['fresh', 'stale', 'lost'] as const;
export type Freshness = (typeof FRESHNESS)[number];

/** Design token (CSS variable) for a marker by how recent the position is. */
export const FRESH_TOKEN: Record<Freshness, string> = { fresh: '--success-fg', stale: '--warning-fg', lost: '--fg-tertiary' };

export function freshnessOf(l: Pick<Latest, 'freshness'>): Freshness {
  return (FRESHNESS as readonly string[]).includes(l.freshness ?? '') ? (l.freshness as Freshness) : 'lost';
}

export function counts(rows: Latest[] | undefined): Record<Freshness, number> & { mock: number } {
  const out = { fresh: 0, stale: 0, lost: 0, mock: 0 };
  for (const r of rows ?? []) {
    out[freshnessOf(r)]++;
    if (r.mock) out.mock++;
  }
  return out;
}

/** Problems first: mock GPS, then lost, stale, fresh; inside a group the oldest position first. */
export function sortLatest(rows: Latest[]): Latest[] {
  const rank = (r: Latest) => (r.mock ? 0 : freshnessOf(r) === 'lost' ? 1 : freshnessOf(r) === 'stale' ? 2 : 3);
  return [...rows].sort((a, b) => rank(a) - rank(b) || (a.recordedAt ?? '').localeCompare(b.recordedAt ?? ''));
}

/** Battery arrives as 0…1. Returns a whole percent, or null when the phone did not report it. */
export function batteryPct(l: Pick<Latest, 'battery'>): number | null {
  return typeof l.battery === 'number' ? Math.round(Math.min(1, Math.max(0, l.battery)) * 100) : null;
}

export const LOW_BATTERY = 20;

export function hasPosition<T extends Pick<Latest, 'lat' | 'lng'>>(l: T): l is T & { lat: number; lng: number } {
  return typeof l.lat === 'number' && typeof l.lng === 'number';
}

export interface Gap {
  from: string;
  to: string;
  minutes: number;
}

/** Periods without any position (phone off, GPS off, app killed), longest first. */
export function gaps(segments: { from?: string; to?: string; kind?: string }[] | undefined): Gap[] {
  return (segments ?? [])
    .filter((s) => s.kind === 'gap' && s.from && s.to)
    .map((s) => ({ from: s.from!, to: s.to!, minutes: Math.max(0, Math.round((Date.parse(s.to!) - Date.parse(s.from!)) / 60_000)) }))
    .sort((a, b) => b.minutes - a.minutes);
}

export type StopKind = 'customer' | 'other';

export function stopKind(s: Pick<Stop, 'customerId'>): StopKind {
  return s.customerId ? 'customer' : 'other';
}

export const STOP_TOKEN: Record<StopKind, string> = { customer: '--success-fg', other: '--warning-fg' };

export function sortStops(stops: Stop[] | undefined): Stop[] {
  return [...(stops ?? [])].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
}
