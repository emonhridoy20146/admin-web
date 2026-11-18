import { describe, expect, it } from 'vitest';
import { boxAround, branchPoint, centerOf, DEFAULT_AREA, DEFAULT_POINT, inBangladesh, parseViewpoint, viewpointParam } from '../geo';
import { ringGradient } from '../map-view';
import { pinIconHtml } from '../pin-icon';

describe('where a map opens (ADR-W18)', () => {
  it('defaults to Patuakhali district, not Barishal city', () => {
    const c = centerOf(DEFAULT_AREA);
    expect(c.lat).toBeGreaterThan(21.9);
    expect(c.lat).toBeLessThan(22.5);
    expect(DEFAULT_AREA.maxLat).toBeLessThan(22.7); // Barishal city (22.70) is outside the default box
    expect(inBangladesh(DEFAULT_POINT)).toBe(true);
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
