import { describe, expect, it } from 'vitest';
import { inBangladesh } from '@/shared/map/geo';
import type { Place } from '../api/places';
import { actionsFor, formOf, ICON_PATHS, isPlaceIcon, PLACE_ICON_ZOOM, PLACE_ICONS, PLACE_LABEL_ZOOM, placeDetail, placeLook, placeMarkers, toCreate, toEdit, validatePlace } from '../model/places';
import { tileIconHtml, TILE_SIZE } from '@/shared/map/pin-icon';

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

  it('a square marker with the kind\'s symbol says "waiting for a move" in another colour', () => {
    expect(placeLook(place())).toEqual({ fill: '--info-fg', path: ICON_PATHS.shop });
    expect(placeLook(place({ pendingMove: pending })).fill).toBe('--warning-fg');
  });

  it('the square is small, from tokens only, and not a pin', () => {
    expect(TILE_SIZE).toBeGreaterThanOrEqual(20);
    expect(TILE_SIZE).toBeLessThanOrEqual(24);
    const html = tileIconHtml(placeLook(place({ icon: 'mosque' })));
    expect(html).toContain('class="fos-tile"');
    expect(html).toContain('--tile-fill:var(--info-fg)');
    expect(html).toContain(ICON_PATHS.mosque);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(html).not.toContain('fos-pin');
  });

  it('zoom rules: nothing zoomed out, the icon in the middle, icon and name from zoom 16', () => {
    expect(PLACE_ICON_ZOOM).toBe(13);
    expect(PLACE_LABEL_ZOOM).toBe(16);
    expect([10, 12, 12.9, 13, 15, 15.9, 16, 18].map(placeDetail)).toEqual(['none', 'none', 'none', 'icon', 'icon', 'icon', 'label', 'label']);
    expect(placeDetail(null)).toBe('icon');
    const list = [place(), place({ id: 'p2', name: 'Baitul Aman' })];
    expect(placeMarkers(list, { zoom: 12 }).markers).toHaveLength(0);
    const mid = placeMarkers(list, { zoom: 14 }).markers;
    expect(mid).toHaveLength(2);
    expect(mid[0]).toMatchObject({ title: 'Karim Store', tile: { path: ICON_PATHS.shop } });
    expect(mid.every((m) => m.label === undefined && !m.pin)).toBe(true);
    expect(placeMarkers(list, { zoom: 16 }).markers.map((m) => m.label)).toEqual(['Karim Store', 'Baitul Aman']);
    // the open place stays on the map with its name, even zoomed out
    expect(placeMarkers(list, { zoom: 11, selectedId: 'p2' }).markers).toMatchObject([{ id: 'p2', label: 'Baitul Aman', strong: true }]);
  });

  it('close in, markers carry the name as a label; an open request of the selected place adds the requested point and a line', () => {
    const list = [place(), place({ id: 'p2', status: 'deleted' }), place({ id: 'p3', pendingMove: pending })];
    const plain = placeMarkers(list, { zoom: 17, prefix: 'place:' });
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
    // places are shared by the whole area: no branch is ever sent (contract 1.42.0)
    const body = toCreate({ name: 'A', icon: 'bank', note: 'n', point: { lat: 22.7, lng: 90.37 } }, 'c2');
    expect(body).toMatchObject({ note: 'n' });
    expect(body).not.toHaveProperty('branchId');
    const p = place();
    expect(toEdit(p, formOf(p), true)).toEqual({});
    expect(toEdit(p, { ...formOf(p), name: 'Karim General Store', note: '' }, false)).toEqual({ name: 'Karim General Store', note: null });
    const moved = { ...formOf(p), point: { lat: 22.7022, lng: 90.3711 } };
    expect(toEdit(p, moved, false)).toEqual({});
    expect(toEdit(p, moved, true)).toEqual({ location: { lat: 22.7022, lng: 90.3711 } });
  });
});
