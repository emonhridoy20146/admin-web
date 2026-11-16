import { describe, expect, it } from 'vitest';
import { coworkManifest } from '../manifest';
import { openMinutes, rangeFor, sortedMembers, timeline, workedTogether } from '../model/session';
import type { Session } from '../api/cowork';

const s: Session = {
  id: 's1',
  businessDate: '2026-11-16',
  branchId: 'b1',
  status: 'ended',
  createdBy: 'u1',
  note: null,
  createdAt: '2026-11-16T04:00:00Z',
  endedAt: '2026-11-16T10:00:00Z',
  visitsCount: 4,
  members: [
    { userId: 'u3', name: 'Shila', status: 'rejected', invitedBy: 'u1', invitedAt: '2026-11-16T04:00:00Z', respondedAt: '2026-11-16T04:20:00Z', leftAt: null },
    { userId: 'u1', name: 'Arif', status: 'accepted', invitedBy: 'u1', invitedAt: '2026-11-16T04:00:00Z', respondedAt: '2026-11-16T04:00:00Z', leftAt: null },
    { userId: 'u2', name: 'Babul', status: 'left', invitedBy: 'u1', invitedAt: '2026-11-16T04:00:00Z', respondedAt: '2026-11-16T04:05:00Z', leftAt: '2026-11-16T09:00:00Z' },
    { userId: 'u4', name: 'Dipu', status: 'invited', invitedBy: 'u2', invitedAt: '2026-11-16T05:00:00Z', respondedAt: null, leftAt: null },
  ],
};

describe('cowork', () => {
  it('is gated by its flag and permission', () => {
    expect(coworkManifest.flag).toBe('module.cowork');
    expect(coworkManifest.routes[0]?.permission).toBe('cowork.view');
  });

  it('counts who worked together: still in, or in and left later', () => {
    expect(workedTogether(s).map((m) => m.userId)).toEqual(['u1', 'u2']);
  });

  it('orders members: in the group (starter first), left, no answer, said no', () => {
    expect(sortedMembers(s).map((m) => m.userId)).toEqual(['u1', 'u2', 'u4', 'u3']);
  });

  it("builds the timeline without the starter's own invite", () => {
    expect(timeline(s).map((e) => `${e.kind}:${e.who ?? ''}${e.by ? '<' + e.by : ''}`)).toEqual([
      'started:Arif',
      'invited:Shila<Arif',
      'invited:Babul<Arif',
      'accepted:Babul',
      'rejected:Shila',
      'invited:Dipu<Babul',
      'left:Babul',
      'ended:',
    ]);
  });

  it('measures how long the group was open', () => {
    expect(openMinutes(s)).toBe(360);
    expect(openMinutes({ createdAt: '2026-11-16T04:00:00Z', endedAt: null }, Date.parse('2026-11-16T04:30:00Z'))).toBe(30);
  });

  it('maps a period to Dhaka days', () => {
    expect(rangeFor('7d', '2026-11-16')).toEqual({ from: '2026-11-10', to: '2026-11-16' });
    expect(rangeFor('yesterday', '2026-11-16')).toEqual({ from: '2026-11-15', to: '2026-11-15' });
  });
});
