import { describe, expect, it } from 'vitest';
import { counts, filterDevices, idleDays, risks, sortDevices, statusOf } from '../model/device';

const rows = [
  { id: 'a', status: 'active' as const, lastSeenAt: '2026-11-16T04:00:00Z' },
  { id: 'b', status: 'unbound' as const, lastSeenAt: '2026-11-16T05:00:00Z' },
  { id: 'c', status: 'pending_approval' as const, lastSeenAt: '2026-11-10T04:00:00Z' },
  { id: 'd', status: 'active' as const, rooted: true, lastSeenAt: '2026-11-12T04:00:00Z' },
  { id: 'e', status: 'active' as const, lastSeenAt: '2026-11-16T06:00:00Z' },
];

describe('devices', () => {
  it('counts per status', () => {
    expect(counts(rows)).toEqual({ all: 5, pending_approval: 1, active: 3, unbound: 1 });
    expect(statusOf({})).toBe('active');
  });

  it('puts approvals first, then risky phones, then the latest seen', () => {
    expect(sortDevices(rows).map((d) => d.id)).toEqual(['c', 'd', 'e', 'a', 'b']);
  });

  it('filters by view', () => {
    expect(filterDevices(rows, 'active')).toHaveLength(3);
    expect(filterDevices(rows, 'all')).toHaveLength(5);
  });

  it('names risks and idle days', () => {
    expect(risks({ rooted: true, emulator: true })).toEqual(['rooted', 'emulator']);
    expect(risks({})).toEqual([]);
    expect(idleDays({ lastSeenAt: '2026-11-10T04:00:00Z' }, new Date('2026-11-16T05:00:00Z'))).toBe(6);
    expect(idleDays({})).toBeNull();
  });
});
