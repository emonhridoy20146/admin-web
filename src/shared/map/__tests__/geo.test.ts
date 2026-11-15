import { describe, expect, it } from 'vitest';
import { bboxParam, boundsOf, haversineM, readLatLng } from '../geo';

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
});
