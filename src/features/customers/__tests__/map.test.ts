import { describe, expect, it } from 'vitest';
import { proposalVM, statusToken } from '../model/map';
import { currentPin } from '../model/pin';

describe('customer map model', () => {
  it('maps statuses to pin tokens with a calm fallback', () => {
    expect(statusToken('overdue')).toBe('--st-overdue-fg');
    expect(statusToken('tagged_bad')).toBe('--st-tagged-bg');
    expect(statusToken(undefined)).toBe('--st-current-fg');
  });
  it('measures how far a proposal moves the pin and flags risky ones', () => {
    const near = proposalVM({ lat: 22.7004, lng: 90.36, accuracyM: 12, customer: { current: { lat: 22.7, lng: 90.36 } as never } });
    expect(near.movedM).toBeGreaterThan(40);
    expect(near.movedM).toBeLessThan(50);
    expect(near.risky).toBe(false);
    expect(proposalVM({ lat: 22.71, lng: 90.36, accuracyM: 12, customer: { current: { lat: 22.7, lng: 90.36 } as never } }).risky).toBe(true);
    expect(proposalVM({ lat: 22.7004, lng: 90.36, accuracyM: 80, customer: { current: { lat: 22.7, lng: 90.36 } as never } }).risky).toBe(true);
  });
  it('handles a customer without a pin', () => {
    const v = proposalVM({ lat: 22.7, lng: 90.36, accuracyM: 10, customer: { current: null } });
    expect(v).toMatchObject({ current: null, movedM: null, risky: false });
  });
  it('map pins (1.11.0): judged by the phone distance, not GPS accuracy; a pin set by a manager is never flagged', () => {
    const base = { lat: 22.7, lng: 90.36, accuracyM: 0, method: 'map' as const, customer: { current: null } };
    expect(proposalVM({ ...base, deviceDistanceM: 80 })).toMatchObject({ method: 'map', phoneM: 80, risky: false });
    expect(proposalVM({ ...base, deviceDistanceM: 900 }).risky).toBe(true);
    expect(proposalVM({ ...base, deviceDistanceM: null, deviceMock: true }).risky).toBe(true);
    expect(proposalVM({ ...base, deviceDistanceM: 5000, direct: true }).risky).toBe(false);
    expect(proposalVM({ lat: 22.7, lng: 90.36, accuracyM: 12, customer: { current: null } })).toMatchObject({ method: 'gps', phoneM: null });
  });
  it('a usable pin is ok or overridden; missing, invalid and swapped ones are not', () => {
    expect(currentPin({ location: { lat: 22.7, lng: 90.36, status: 'ok', source: 'erp' } })).toEqual({ lat: 22.7, lng: 90.36 });
    expect(currentPin({ location: { lat: 22.7, lng: 90.36, status: 'overridden', source: 'overlay' } })).toEqual({ lat: 22.7, lng: 90.36 });
    expect(currentPin({ location: { lat: 90.36, lng: 22.7, status: 'suspect_swapped', source: 'erp' } })).toBeNull();
    expect(currentPin({ location: { lat: null, lng: null, status: 'missing', source: 'erp' } })).toBeNull();
    expect(currentPin({})).toBeNull();
  });
});
