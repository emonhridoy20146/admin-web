import { describe, expect, it } from 'vitest';
import { proposalVM, statusToken } from '../model/map';

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
});
