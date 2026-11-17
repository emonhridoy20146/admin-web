import type { NoticeCreate, Notice, Recipient, Role } from '../api/notices';

/** Roles a notice can go to; field staff is what the server uses when none is picked. */
export const AUDIENCE_ROLES = ['field_staff', 'branch_manager', 'viewer'] as const satisfies readonly Role[];

export interface NoticeForm {
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  /** empty = every branch the sender can see */
  branchIds: string[];
  roles: Role[];
  requireAck: boolean;
}

export const emptyNotice = (branchId?: string): NoticeForm => ({
  titleBn: '',
  titleEn: '',
  bodyBn: '',
  bodyEn: '',
  branchIds: branchId ? [branchId] : [],
  roles: ['field_staff'],
  requireAck: false,
});

export const TITLE_MAX = 500;
export const BODY_MAX = 2000;

/** Returns i18n keys (namespace notices) per field; the server's limits (title 500, body 2000). */
export function validateNotice(v: NoticeForm): Partial<Record<keyof NoticeForm, string>> {
  const e: Partial<Record<keyof NoticeForm, string>> = {};
  if (!v.titleBn.trim()) e.titleBn = 'errors.required';
  else if (v.titleBn.trim().length > TITLE_MAX) e.titleBn = 'errors.tooLong';
  if (v.titleEn.trim().length > TITLE_MAX) e.titleEn = 'errors.tooLong';
  if (!v.bodyBn.trim()) e.bodyBn = 'errors.required';
  else if (v.bodyBn.trim().length > BODY_MAX) e.bodyBn = 'errors.tooLong';
  if (v.bodyEn.trim().length > BODY_MAX) e.bodyEn = 'errors.tooLong';
  if (!v.roles.length) e.roles = 'errors.roles';
  return e;
}

export function toCreate(v: NoticeForm): NoticeCreate {
  return {
    title: { bn: v.titleBn.trim(), en: v.titleEn.trim() },
    body: { bn: v.bodyBn.trim(), en: v.bodyEn.trim() },
    ...(v.branchIds.length ? { branchIds: v.branchIds } : {}),
    roles: v.roles,
    requireAck: v.requireAck,
  };
}

/** Share of recipients who tapped "read" (0..1); 0 when it went to nobody. */
export function readShare(n: Pick<Notice, 'recipientCount' | 'ackCount'>): number {
  const total = n.recipientCount ?? 0;
  return total > 0 ? Math.min(1, (n.ackCount ?? 0) / total) : 0;
}

/** Not read first, then by name; the server sorts the same way, this keeps a filtered list stable. */
export function sortRecipients(items: Recipient[], locale: 'bn' | 'en'): Recipient[] {
  const name = (r: Recipient) => (locale === 'bn' ? r.name?.bn || r.name?.en : r.name?.en || r.name?.bn) ?? '';
  return [...items].sort((a, b) => Number(!!a.acked) - Number(!!b.acked) || name(a).localeCompare(name(b)));
}

/** A must-read notice still has people who have not confirmed. */
export function waiting(n: Pick<Notice, 'requireAck' | 'recipientCount' | 'ackCount'>): number {
  return n.requireAck ? Math.max(0, (n.recipientCount ?? 0) - (n.ackCount ?? 0)) : 0;
}
