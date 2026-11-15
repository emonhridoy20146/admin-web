import { describe, expect, it } from 'vitest';
import { durationMin, geoState, rangeFor } from '../model/visit';

const geo = { lat: 22.7, lng: 90.36, accuracyM: 12, mock: false };

describe('visit model', () => {
  it('builds date ranges ending today', () => {
    expect(rangeFor('7d', '2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(rangeFor('yesterday', '2026-11-15')).toEqual({ from: '2026-11-14', to: '2026-11-14' });
  });
  it('computes the visit duration', () => {
    expect(durationMin({ checkInAt: '2026-11-15T04:00:00Z', checkOutAt: '2026-11-15T04:12:20Z' })).toBe(12);
    expect(durationMin({ checkInAt: '2026-11-15T04:00:00Z', checkOutAt: null })).toBeNull();
  });
  it('gives one location verdict, worst first', () => {
    expect(geoState({ geo, flags: [], distanceToPinM: 40 })).toBe('ok');
    expect(geoState({ geo, flags: [], distanceToPinM: 640 })).toBe('far');
    expect(geoState({ geo, flags: ['far_from_pin'], distanceToPinM: 120 })).toBe('far');
    expect(geoState({ geo: null, flags: [], distanceToPinM: null })).toBe('none');
    expect(geoState({ geo: { ...geo, mock: true }, flags: [], distanceToPinM: 900 })).toBe('mock');
    expect(geoState({ geo, flags: ['mock_location'], distanceToPinM: 10 })).toBe('mock');
  });
});
