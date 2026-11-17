import { describe, expect, it } from 'vitest';
import { bboxParam, boundsOf, formatCoords, haversineM, inBangladesh, parseCoords, readLatLng } from '../geo';

describe('geo helpers', () => {
  it('measures distance in metres', () => {
    expect(haversineM({ lat: 22.7, lng: 90.36 }, { lat: 22.7, lng: 90.36 })).toBe(0);
    const d = haversineM({ lat: 22.7, lng: 90.36 }, { lat: 22.701, lng: 90.36 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(116);
  });
  it('formats a bbox param with stable rounding', () => {
    expect(bboxParam({ minLng: 90.3000004, minLat: 22.65, maxLng: 90.4123456, maxLat: 22.75 })).toBe('90.3,22.65,90.41235,22.75');
  });
  it('reads loose lat/lng objects safely', () => {
    expect(readLatLng({ lat: 22.7, lng: 90.3, source: 'erp' })).toEqual({ lat: 22.7, lng: 90.3 });
    expect(readLatLng({ lat: null, lng: 90.3 })).toBeNull();
    expect(readLatLng(null)).toBeNull();
    expect(readLatLng('x')).toBeNull();
  });
  it('builds padded bounds', () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ lat: 1, lng: 2 }, { lat: 3, lng: 1 }], 0)).toEqual({ minLat: 1, maxLat: 3, minLng: 1, maxLng: 2 });
  });
  it('reads pasted coordinates (plain, degrees, map links, Bangla digits, swapped)', () => {
    expect(parseCoords('22.70123, 90.37011')).toEqual({ lat: 22.70123, lng: 90.37011 });
    expect(parseCoords('  22.70123 90.37011 ')).toEqual({ lat: 22.70123, lng: 90.37011 });
    expect(parseCoords('22.70123° N, 90.37011° E')).toEqual({ lat: 22.70123, lng: 90.37011 });
    expect(parseCoords('https://www.google.com/maps/@22.70123,90.37011,17z')).toEqual({ lat: 22.70123, lng: 90.37011 });
    expect(parseCoords('https://maps.google.com/?q=22.70123,90.37011&z=17')).toEqual({ lat: 22.70123, lng: 90.37011 });
    expect(parseCoords('২২.৭০১২৩, ৯০.৩৭০১১')).toEqual({ lat: 22.70123, lng: 90.37011 });
    expect(parseCoords('90.37011, 22.70123')).toEqual({ lat: 22.70123, lng: 90.37011 });
    expect(parseCoords('51.5, -0.12')).toEqual({ lat: 51.5, lng: -0.12 });
    expect(parseCoords('')).toBeNull();
    expect(parseCoords('house near the mosque')).toBeNull();
    expect(parseCoords('22.7')).toBeNull();
    expect(parseCoords('1, 2, 3')).toBeNull();
    expect(parseCoords('200, 300')).toBeNull();
  });
  it('knows Bangladesh and formats coordinates to five decimals', () => {
    expect(inBangladesh({ lat: 22.7, lng: 90.37 })).toBe(true);
    expect(inBangladesh({ lat: 51.5, lng: -0.12 })).toBe(false);
    expect(formatCoords({ lat: 22.7, lng: 90.370114 })).toBe('22.70000, 90.37011');
  });
});
