import { describe, expect, it } from 'vitest';
import { inBangladesh } from '@/shared/map/geo';
import type { Place } from '../api/places';
import { actionsFor, formOf, ICON_PATHS, isPlaceIcon, PLACE_ICONS, placeLook, placeMarkers, toCreate, toEdit, validatePlace } from '../model/places';

const who = { id: 'u1', name: 'Rakib Hasan' };
const place = (p: Partial<Place> = {}): Place => ({
  id: 'p1',
  clientId: null,
  branchId: 'b1',
  name: 'Karim Store',
  icon: 'shop',
  note: 'Blue gate',
  location: { lat: 22.7012, lng: 90.3711 },
  status: 'active',
  version: 1,
  pendingMove: null,
  lastMoveDecision: null,
  createdBy: who,
  updatedBy: who,
  createdAt: '2026-11-22T04:00:00.000Z',
  updatedAt: '2026-11-22T04:00:00.000Z',
  events: [],
  ...p,
});
const pending = { location: { lat: 22.7022, lng: 90.3711 }, requestedBy: { id: 'u2', name: 'Sumon' }, requestedAt: '2026-11-22T05:00:00.000Z', reason: null, distanceM: 111 };

describe('places model (FR-PLC-001..006)', () => {
  it('ten icons, each with a symbol', () => {
    expect(PLACE_ICONS).toHaveLength(10);
    for (const i of PLACE_ICONS) expect(ICON_PATHS[i]).toMatch(/^M/);
    expect(isPlaceIcon('bus_stop')).toBe(true);
    expect(isPlaceIcon('castle')).toBe(false);
  });

  it('a pin says "waiting for a move" in another colour', () => {
    expect(placeLook(place()).fill).toBe('--info-fg');
    expect(placeLook(place({ pendingMove: pending })).fill).toBe('--warning-fg');
    expect(placeLook(place()).glyph).toEqual({ path: ICON_PATHS.shop });
  });

  it('markers carry the name as a label; an open request of the selected place adds the requested point and a line', () => {
    const list = [place(), place({ id: 'p2', status: 'deleted' }), place({ id: 'p3', pendingMove: pending })];
    const plain = placeMarkers(list, { prefix: 'place:' });
    expect(plain.markers.map((m) => m.id)).toEqual(['place:p1', 'place:p3']);
    expect(plain.markers[0]).toMatchObject({ label: 'Karim Store', title: 'Karim Store' });
    expect(plain.lines).toHaveLength(0);
    const sel = placeMarkers(list, { selectedId: 'p3' });
    expect(sel.markers).toHaveLength(3);
    expect(sel.markers[2]).toMatchObject({ hollow: true, lat: 22.7022 });
    expect(sel.lines).toEqual([[{ lat: 22.7012, lng: 90.3711 }, { lat: 22.7022, lng: 90.3711 }]]);
  });

  it('staff edit only their own places; the office edits, moves, removes and decides', () => {
    expect(actionsFor(place(), { id: 'u1', canCreate: true, canManage: false })).toEqual({ edit: true, move: false, remove: false, decide: false });
    expect(actionsFor(place(), { id: 'u9', canCreate: true, canManage: false }).edit).toBe(false);
    expect(actionsFor(place({ pendingMove: pending }), { id: 'm1', canCreate: true, canManage: true })).toEqual({ edit: true, move: true, remove: true, decide: true });
    expect(actionsFor(place({ status: 'deleted' }), { id: 'm1', canCreate: true, canManage: true })).toEqual({ edit: false, move: false, remove: false, decide: false });
  });

  it('validates name, note and point', () => {
    const f = formOf(place());
    expect(validatePlace(f, inBangladesh)).toEqual({});
    expect(validatePlace({ ...f, name: '  ' }, inBangladesh)).toEqual({ name: 'required' });
    expect(validatePlace({ ...f, name: 'x'.repeat(61), note: 'n'.repeat(201), point: { lat: 51.5, lng: -0.1 } }, inBangladesh)).toEqual({ name: 'tooLong', note: 'tooLong', point: 'outside' });
  });

  it('builds the create body and sends only what changed on edit', () => {
    expect(toCreate({ name: ' Karim Store ', icon: 'shop', note: ' ', point: { lat: 22.70123456, lng: 90.37 } }, 'c1')).toEqual({ clientId: 'c1', name: 'Karim Store', icon: 'shop', location: { lat: 22.701235, lng: 90.37 } });
    expect(toCreate({ name: 'A', icon: 'bank', note: 'n', point: { lat: 22.7, lng: 90.37 } }, 'c2', 'b2')).toMatchObject({ note: 'n', branchId: 'b2' });
    const p = place();
    expect(toEdit(p, formOf(p), true)).toEqual({});
    expect(toEdit(p, { ...formOf(p), name: 'Karim General Store', note: '' }, false)).toEqual({ name: 'Karim General Store', note: null });
    const moved = { ...formOf(p), point: { lat: 22.7022, lng: 90.3711 } };
    expect(toEdit(p, moved, false)).toEqual({});
    expect(toEdit(p, moved, true)).toEqual({ location: { lat: 22.7022, lng: 90.3711 } });
  });
});
