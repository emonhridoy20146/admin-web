import { describe, expect, it } from 'vitest';
import { boxAround, branchPoint, DEFAULT_POINT, DEFAULT_VIEW, inBangladesh, parseViewpoint, viewpointParam } from '../geo';
import { ringGradient } from '../map-view';
import { pinIconHtml } from '../pin-icon';
import { BRANCH_PIN, branchMarkers, isBranchMarker } from '../branch-markers';

describe('where a map opens (ADR-W18, owner decision 2026-11-22)', () => {
  it('defaults to Galachipa upazila, Patuakhali, at zoom 12', () => {
    expect(DEFAULT_VIEW).toEqual({ center: { lat: 22.164, lng: 90.426 }, zoom: 12 });
    expect(DEFAULT_POINT).toEqual(DEFAULT_VIEW.center);
    expect(inBangladesh(DEFAULT_POINT)).toBe(true);
    expect(parseViewpoint(viewpointParam(DEFAULT_VIEW))).toEqual(DEFAULT_VIEW);
  });
  it('round-trips the view kept in the link and refuses junk', () => {
    const v = { center: { lat: 22.3596, lng: 90.32993 }, zoom: 14 };
    expect(viewpointParam(v)).toBe('22.35960,90.32993,14');
    expect(parseViewpoint('22.35960,90.32993,14')).toEqual(v);
    expect(parseViewpoint('48.85,2.35,12')).toBeNull(); // outside Bangladesh
    expect(parseViewpoint('22.3,90.3,25')).toBeNull();
    expect(parseViewpoint('22.3,90.3')).toBeNull();
    expect(parseViewpoint('')).toBeNull();
  });
  it('uses the chosen branch point, or the only branch of a one-branch user', () => {
    const list = [{ id: 'a', lat: 22.36, lng: 90.33 }, { id: 'b', lat: null, lng: null }];
    expect(branchPoint(list, 'a')).toEqual({ lat: 22.36, lng: 90.33 });
    expect(branchPoint(list, 'b')).toBeNull(); // the ERP has no branch coordinates until set in settings
    expect(branchPoint(list, '')).toBeNull(); // all branches
    expect(branchPoint([list[0]!], '')).toEqual({ lat: 22.36, lng: 90.33 });
    expect(branchPoint(undefined, 'a')).toBeNull();
  });
  it('builds a box of about the asked size around a point', () => {
    const b = boxAround({ lat: 22.36, lng: 90.33 }, 3);
    expect(b.maxLat - b.minLat).toBeCloseTo(6 / 111, 3);
    expect(b.maxLng - b.minLng).toBeGreaterThan(b.maxLat - b.minLat);
  });
});

describe('pins and cluster rings', () => {
  it('pin HTML uses tokens, escapes the glyph and marks the selected pin', () => {
    const html = pinIconHtml({ fill: '--ps-bad-pin', edge: '--ps-bad-fg', glyph: { text: '<b>' } }, true);
    expect(html).toContain('--pin-fill:var(--ps-bad-pin)');
    expect(html).toContain('is-selected');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&#60;b&#62;');
    expect(pinIconHtml({ fill: '--x);background:url(evil', edge: '--y' })).not.toContain('url(');
  });
  it('ring stops follow the share of each colour and skip empty ones', () => {
    expect(ringGradient([{ token: '--a', n: 1 }, { token: '--b', n: 0 }, { token: '--c', n: 3 }])).toBe('conic-gradient(var(--a) 0.00% 25.00%, var(--c) 25.00% 100.00%)');
    expect(ringGradient([{ token: '--a', n: 0 }])).toBeNull();
  });
});

describe('branch pins on the maps (FR-W-034)', () => {
  const list = [
    { id: 'b1', code: 'BRL01', name: { bn: 'বরিশাল', en: 'Barishal' }, lat: 22.7, lng: 90.37, active: true },
    { id: 'b2', code: 'PTK01', name: { bn: 'পটুয়াখালী', en: 'Patuakhali' }, lat: null, lng: null, active: true },
    { id: 'b3', code: 'OLD01', name: { en: 'Closed' }, lat: 22.1, lng: 90.1, active: false },
    { id: 'b4', code: 'KUA01', name: { en: 'Kuakata' }, lat: 21.82, lng: 90.12 },
  ];
  it('draws only active branches that have a point, with a house pin and the chosen one larger', () => {
    const m = branchMarkers(list, { selectedId: 'b4', locale: 'bn', title: (n) => `শাখা: ${n}` });
    expect(m.map((x) => x.id)).toEqual(['branch:b1', 'branch:b4']);
    expect(m[0]).toMatchObject({ lat: 22.7, lng: 90.37, title: 'শাখা: বরিশাল', pin: BRANCH_PIN, strong: false });
    expect(m[1]).toMatchObject({ title: 'শাখা: Kuakata', strong: true }); // falls back to the English name
    expect(m.every((x) => isBranchMarker(x.id))).toBe(true);
    expect(isBranchMarker('6731abc')).toBe(false);
    expect(branchMarkers(undefined, { locale: 'en', title: (n) => n })).toEqual([]);
  });
  it('the house glyph is drawn inside the pin', () => {
    expect(pinIconHtml(BRANCH_PIN)).toContain('<path d="M9.8 13.4');
    expect(pinIconHtml(BRANCH_PIN)).toContain('class="fos-pin is-branch"');
  });
});
