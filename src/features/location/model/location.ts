import type { Latest, RouteEvent, Stop } from '../api/location';

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

export interface WorkEvent {
  kind: 'visit' | 'collection';
  at: string;
  summary: RouteEvent['summary'];
  customerId: string | null;
  lat: number | null;
  lng: number | null;
  /** field money recorded in the app at this moment (collections only) */
  amountPoisha: number | null;
  method: string | null;
  receiptNo: string | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** Visits and collections of the day in time order. `data` is free-form in the contract, so every field is read defensively. */
export function workEvents(events: RouteEvent[] | undefined): WorkEvent[] {
  return (events ?? [])
    .filter((e): e is RouteEvent & { kind: 'visit' | 'collection'; at: string } => (e.kind === 'visit' || e.kind === 'collection') && !!e.at)
    .map((e) => {
      const d = (e.data ?? {}) as Record<string, unknown>;
      const money = e.kind === 'collection';
      return { kind: e.kind, at: e.at, summary: e.summary, customerId: str(d.customerId), lat: num(d.lat), lng: num(d.lng), amountPoisha: money ? num(d.amountPoisha) : null, method: money ? str(d.method) : null, receiptNo: money ? str(d.receiptNo) : null };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Field money collected along the route (app records, not the ERP ledger). */
export function collectedOnRoute(events: WorkEvent[]): number {
  return events.reduce((a, e) => a + (e.kind === 'collection' ? (e.amountPoisha ?? 0) : 0), 0);
}

export const COLLECTION_TOKEN = '--info-fg';

// ── Time scrubber ─────────────────────────────────────────────────────────────

export interface ScrubSegment {
  from: string;
  to: string;
  kind: 'moving' | 'gap';
  leftPct: number;
  widthPct: number;
}

export interface ScrubStop {
  index: number;
  leftPct: number;
  kind: StopKind;
}

export interface ScrubModel {
  startMs: number;
  totalMs: number;
  segments: ScrubSegment[];
  stops: ScrubStop[];
}

export function buildScrubber(
  rawSegments: { from?: string; to?: string; kind?: string }[] | undefined,
  stops: Stop[] | undefined,
): ScrubModel | null {
  const segs = (rawSegments ?? []).filter((s) => s.from && s.to);
  if (!segs.length) return null;
  const startMs = Math.min(...segs.map((s) => Date.parse(s.from!)));
  const endMs = Math.max(...segs.map((s) => Date.parse(s.to!)));
  const totalMs = endMs - startMs;
  if (totalMs <= 0) return null;
  const pct = (ms: number) => Math.max(0, Math.min(100, ((ms - startMs) / totalMs) * 100));
  const segments: ScrubSegment[] = segs.map((s) => {
    const fMs = Date.parse(s.from!);
    const tMs = Date.parse(s.to!);
    return { from: s.from!, to: s.to!, kind: s.kind === 'gap' ? 'gap' : 'moving', leftPct: pct(fMs), widthPct: Math.max(0.3, pct(tMs) - pct(fMs)) };
  });
  const sortedStops = sortStops(stops);
  // `index` is the position in the sorted stop list (the same index `stopIndexAtPct` returns), so a stop
  // without a start time must not shift the ones after it.
  const scrubStops: ScrubStop[] = sortedStops.flatMap((s, i) => (s.start ? [{ index: i, leftPct: pct(Date.parse(s.start)), kind: stopKind(s) }] : []));
  return { startMs, totalMs, segments, stops: scrubStops };
}

/** Given a 0–100 position on the scrubber bar, return the nearest past stop index (or null). */
export function stopIndexAtPct(pct: number, model: ScrubModel, sortedStops: Stop[]): number | null {
  const ms = model.startMs + (pct / 100) * model.totalMs;
  for (let i = sortedStops.length - 1; i >= 0; i--) {
    const start = sortedStops[i]?.start;
    if (start && Date.parse(start) <= ms) return i;
  }
  return null;
}
