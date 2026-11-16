import { addDays } from '@/shared/lib/time';
import type { Member, Session } from '../api/cowork';

export const RANGES = ['today', 'yesterday', '7d', '30d'] as const;
export type Range = (typeof RANGES)[number];

export function rangeFor(r: Range, today: string): { from: string; to: string } {
  switch (r) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
  }
}

const ORDER: Record<NonNullable<Member['status']>, number> = { accepted: 0, left: 1, invited: 2, rejected: 3 };

/** The people who worked in the group at some point: still in it, or in it and left later. */
export function workedTogether(s: Pick<Session, 'members'>): Member[] {
  return s.members.filter((m) => m.status === 'accepted' || m.status === 'left');
}

/** Members in reading order: still in, left, still invited, said no; the one who started it first within each. */
export function sortedMembers(s: Pick<Session, 'members' | 'createdBy'>): Member[] {
  return [...s.members].sort(
    (a, b) =>
      ORDER[a.status ?? 'invited'] - ORDER[b.status ?? 'invited'] ||
      Number(b.userId === s.createdBy) - Number(a.userId === s.createdBy) ||
      (a.invitedAt ?? '').localeCompare(b.invitedAt ?? ''),
  );
}

export function nameOf(s: Pick<Session, 'members'>, userId: string | undefined): string | undefined {
  return s.members.find((m) => m.userId === userId)?.name;
}

export type TimelineKind = 'started' | 'invited' | 'accepted' | 'rejected' | 'left' | 'ended';
export interface TimelineEntry {
  at: string;
  kind: TimelineKind;
  who?: string;
  by?: string;
}

/**
 * What happened in the session, oldest first. The starter's own invite and acceptance are the "started" entry.
 * Someone asked again after saying no or leaving only keeps the latest round (that is what the server stores).
 */
export function timeline(s: Session): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  if (s.createdAt) out.push({ at: s.createdAt, kind: 'started', who: nameOf(s, s.createdBy) });
  for (const m of s.members) {
    if (m.userId === s.createdBy && m.invitedBy === s.createdBy) {
      if (m.leftAt) out.push({ at: m.leftAt, kind: 'left', who: m.name });
      continue;
    }
    if (m.invitedAt) out.push({ at: m.invitedAt, kind: 'invited', who: m.name, by: nameOf(s, m.invitedBy) });
    if (m.respondedAt) out.push({ at: m.respondedAt, kind: m.status === 'rejected' ? 'rejected' : 'accepted', who: m.name });
    if (m.leftAt) out.push({ at: m.leftAt, kind: 'left', who: m.name });
  }
  if (s.endedAt) out.push({ at: s.endedAt, kind: 'ended' });
  const rank: Record<TimelineKind, number> = { started: 0, invited: 1, accepted: 2, rejected: 2, left: 3, ended: 4 };
  return out.sort((a, b) => a.at.localeCompare(b.at) || rank[a.kind] - rank[b.kind]);
}

/** Minutes the group was open: until it ended, or until now while it is still open. */
export function openMinutes(s: Pick<Session, 'createdAt' | 'endedAt'>, now = Date.now()): number | null {
  if (!s.createdAt) return null;
  const end = s.endedAt ? Date.parse(s.endedAt) : now;
  return Math.max(0, Math.round((end - Date.parse(s.createdAt)) / 60_000));
}
