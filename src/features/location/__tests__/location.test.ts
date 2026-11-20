import { describe, expect, it } from 'vitest';
import { decodePolyline } from '@/shared/map/geo';
import { locationManifest } from '../manifest';
import { batteryPct, buildScrubber, collectedOnRoute, counts, freshnessOf, gaps, sortLatest, sortStops, stopIndexAtPct, stopKind, workEvents } from '../model/location';

describe('location', () => {
  it('has a manifest with both routes', () => {
    expect(locationManifest.name).toBe('location');
    expect(locationManifest.routes.map((r) => r.path)).toEqual(['/live', '/routes']);
  });

  it('decodes the encoded polyline from the history endpoint', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toHaveLength(3);
    expect(pts[0]!.lat).toBeCloseTo(38.5, 5);
    expect(pts[0]!.lng).toBeCloseTo(-120.2, 5);
    expect(pts[2]!.lat).toBeCloseTo(43.252, 5);
    expect(pts[2]!.lng).toBeCloseTo(-126.453, 5);
    expect(decodePolyline('')).toEqual([]);
  });

  it('counts by freshness and treats an unknown value as lost', () => {
    expect(freshnessOf({ freshness: undefined })).toBe('lost');
    expect(counts([{ freshness: 'fresh' }, { freshness: 'fresh', mock: true }, { freshness: 'stale' }, {}])).toEqual({ fresh: 2, stale: 1, lost: 1, mock: 1 });
  });

  it('lists problems first', () => {
    const rows = sortLatest([
      { userId: 'a', freshness: 'fresh', recordedAt: '2026-11-16T10:00:00Z' },
      { userId: 'b', freshness: 'lost', recordedAt: '2026-11-16T08:00:00Z' },
      { userId: 'c', freshness: 'fresh', mock: true, recordedAt: '2026-11-16T10:01:00Z' },
      { userId: 'd', freshness: 'stale', recordedAt: '2026-11-16T09:50:00Z' },
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('reads battery as a percent', () => {
    expect(batteryPct({ battery: 0.184 })).toBe(18);
    expect(batteryPct({ battery: 1.4 })).toBe(100);
    expect(batteryPct({})).toBeNull();
  });

  it('extracts gaps, longest first, and orders stops by time', () => {
    const g = gaps([
      { from: '2026-11-16T04:00:00Z', to: '2026-11-16T04:10:00Z', kind: 'moving' },
      { from: '2026-11-16T04:10:00Z', to: '2026-11-16T04:22:00Z', kind: 'gap' },
      { from: '2026-11-16T06:00:00Z', to: '2026-11-16T06:45:00Z', kind: 'gap' },
    ]);
    expect(g.map((x) => x.minutes)).toEqual([45, 12]);
    expect(sortStops([{ start: '2026-11-16T07:00:00Z' }, { start: '2026-11-16T05:00:00Z' }]).map((s) => s.start)).toEqual(['2026-11-16T05:00:00Z', '2026-11-16T07:00:00Z']);
    expect(stopKind({ customerId: 'x' })).toBe('customer');
    expect(stopKind({ customerId: null })).toBe('other');
  });

  it('reads visit and collection events defensively and totals field money', () => {
    const ev = workEvents([
      { kind: 'collection', at: '2026-11-16T05:10:00Z', data: { customerId: 'c1', lat: 22.7, lng: 90.3, amountPoisha: 150000, method: 'cash', receiptNo: 'R-1' } },
      { kind: 'visit', at: '2026-11-16T05:00:00Z', data: { customerId: 'c1', lat: 22.7, lng: 90.3, amountPoisha: 999 } },
      { kind: 'note', at: '2026-11-16T05:05:00Z' },
      { kind: 'collection', at: '2026-11-16T06:00:00Z', data: { amountPoisha: 'x' } },
      { kind: 'visit' },
    ]);
    expect(ev.map((e) => e.kind)).toEqual(['visit', 'collection', 'collection']);
    expect(ev[0]!.amountPoisha).toBeNull();
    expect(ev[1]).toMatchObject({ customerId: 'c1', amountPoisha: 150000, method: 'cash', receiptNo: 'R-1' });
    expect(ev[2]).toMatchObject({ customerId: null, lat: null, amountPoisha: null });
    expect(collectedOnRoute(ev)).toBe(150000);
  });
  it('builds the time scrubber and finds the stop under a position', () => {
    expect(buildScrubber([], [])).toBeNull();
    expect(buildScrubber([{ from: '2026-11-16T03:00:00Z', to: '2026-11-16T03:00:00Z' }], [])).toBeNull();
    const stops = [
      { start: '2026-11-16T05:00:00Z', customerId: 'c1' },
      { start: '2026-11-16T03:30:00Z' },
      { customerId: 'c2' },
    ];
    const model = buildScrubber(
      [
        { from: '2026-11-16T03:00:00Z', to: '2026-11-16T04:00:00Z', kind: 'moving' },
        { from: '2026-11-16T04:00:00Z', to: '2026-11-16T07:00:00Z', kind: 'gap' },
      ],
      stops,
    )!;
    expect(model.totalMs).toBe(4 * 3600_000);
    expect(model.segments.map((s) => [s.kind, s.leftPct, s.widthPct])).toEqual([
      ['moving', 0, 25],
      ['gap', 25, 75],
    ]);
    const sorted = sortStops(stops);
    // Every marker points at its place in the sorted list, also when a stop has no start time.
    for (const m of model.stops) expect(sorted[m.index]!.start).toBeTruthy();
    expect(model.stops).toHaveLength(2);
    const first = model.stops.find((m) => m.leftPct === 12.5)!;
    expect(sorted[first.index]!.start).toBe('2026-11-16T03:30:00Z');
    expect(stopIndexAtPct(5, model, sorted)).toBeNull();
    expect(stopIndexAtPct(20, model, sorted)).toBe(first.index);
    expect(sorted[stopIndexAtPct(100, model, sorted)!]!.start).toBe('2026-11-16T05:00:00Z');
  });
});
