import type { Area, Handover, HandoverCreate, HandoverStatus } from '../api/handovers';

export const GROUPS = ['pending', 'accepted', 'closed'] as const;
export type Group = (typeof GROUPS)[number];

/** List tabs: waiting for the receiver, in force, and everything that ended without or after effect. */
export function groupOf(status: HandoverStatus | undefined): Group {
  if (status === 'pending_acceptance') return 'pending';
  if (status === 'accepted') return 'accepted';
  return 'closed';
}

export function countByGroup(list: Handover[] | undefined): Record<Group, number> {
  const out: Record<Group, number> = { pending: 0, accepted: 0, closed: 0 };
  for (const h of list ?? []) out[groupOf(h.status)]++;
  return out;
}

/** Whole hours until a pending handover expires (FR-HO-001: 72 h); null when not pending or no expiry. */
export function hoursLeft(h: Pick<Handover, 'status' | 'expiresAt'>, now: Date = new Date()): number | null {
  if (h.status !== 'pending_acceptance' || !h.expiresAt) return null;
  return Math.max(0, Math.floor((Date.parse(h.expiresAt) - now.getTime()) / 3_600_000));
}

/** Areas a staff member currently holds. */
export function areasOf(userId: string, areas: Area[] | undefined): Area[] {
  return (areas ?? []).filter((a) => a.active !== false && a.assignees?.includes(userId));
}

export function customersIn(areaIds: string[], areas: Area[] | undefined): number {
  return (areas ?? []).filter((a) => areaIds.includes(a.id ?? '')).reduce((s, a) => s + (a.customerCount ?? 0), 0);
}

export interface HandoverForm {
  fromUserId: string;
  toUserId: string;
  areaIds: string[];
  effectiveDate: string;
  temporary: boolean;
  endDate: string;
  reason: string;
}

export const REASON_MIN = 10;

export function emptyForm(today: string): HandoverForm {
  return { fromUserId: '', toUserId: '', areaIds: [], effectiveDate: today, temporary: false, endDate: '', reason: '' };
}

export type HandoverErrors = Partial<Record<keyof HandoverForm, string>>;

/** Returns i18n keys per field. */
export function validate(v: HandoverForm, today: string): HandoverErrors {
  const e: HandoverErrors = {};
  if (!v.fromUserId) e.fromUserId = 'errors.required';
  if (!v.toUserId) e.toUserId = 'errors.required';
  else if (v.toUserId === v.fromUserId) e.toUserId = 'errors.same';
  if (!v.areaIds.length) e.areaIds = 'errors.scope';
  if (!v.effectiveDate) e.effectiveDate = 'errors.required';
  else if (v.effectiveDate < today) e.effectiveDate = 'errors.past';
  if (v.temporary) {
    if (!v.endDate) e.endDate = 'errors.required';
    else if (v.endDate <= (v.effectiveDate || today)) e.endDate = 'errors.endBefore';
  }
  if (v.reason.trim().length < REASON_MIN) e.reason = 'errors.reason';
  return e;
}

export function toBody(v: HandoverForm): HandoverCreate {
  return {
    fromUserId: v.fromUserId,
    toUserId: v.toUserId,
    areaIds: v.areaIds,
    reason: v.reason.trim(),
    effectiveDate: v.effectiveDate,
    ...(v.temporary && v.endDate ? { endDate: v.endDate } : {}),
  };
}
