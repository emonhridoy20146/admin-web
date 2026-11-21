import { describe, expect, it } from 'vitest';
import { byDay, dhakaDay, hrefOf, sentenceKey } from '../model/activity';

describe('activity feed lines (FR-W-046)', () => {
  it('days are Dhaka days: 23:30 Dhaka is still that day, 00:10 Dhaka the next', () => {
    expect(dhakaDay('2026-11-20T17:30:00Z')).toBe('2026-11-20');
    expect(dhakaDay('2026-11-20T18:10:00Z')).toBe('2026-11-21');
  });
  it('groups newest day first and keeps the order inside a day', () => {
    const g = byDay([{ at: '2026-11-21T05:00:00Z', n: 1 }, { at: '2026-11-21T03:00:00Z', n: 2 }, { at: '2026-11-20T10:00:00Z', n: 3 }]);
    expect(g.map((x) => [x.day, x.items.map((i) => i.n)])).toEqual([['2026-11-21', [1, 2]], ['2026-11-20', [3]]]);
    expect(byDay([])).toEqual([]);
  });
  it('a collection opens its drawer; visits, promises and pins open the customer', () => {
    expect(hrefOf({ entity: 'collection', entityId: 'c1', customer: { id: 'k1' } })).toBe('/collections/?drawer=collection:c1');
    expect(hrefOf({ entity: 'visit', entityId: 'v1', customer: { id: 'k1' } })).toBe('/customers/k1/');
    expect(hrefOf({ entity: 'customer', entityId: 'k2', customer: null })).toBeNull();
  });
  it('the sentence says whether a pin applied or waits', () => {
    expect(sentenceKey({ type: 'pin', data: { applied: true } })).toBe('line.pinSet');
    expect(sentenceKey({ type: 'pin', data: { applied: false } })).toBe('line.pinProposed');
    expect(sentenceKey({ type: 'collection', data: {} })).toBe('line.collection');
  });
});
