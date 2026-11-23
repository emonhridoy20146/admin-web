import type { Tone } from '@/shared/ui/status';
import type { Prospect, ProspectStatus } from '../api/prospects';

export const STATUSES: ProspectStatus[] = ['new', 'contacted', 'converted', 'dropped'];
export const STATUS_TONE: Record<ProspectStatus, Tone> = { new: 'info', contacted: 'promised', converted: 'paid', dropped: 'neutral' };

export type ProspectAction = 'contacted' | 'dropped' | 'convert' | 'reopen' | 'reentry';

/**
 * What the office may do with a prospect in each status (field-api 1.45.0): new ↔ contacted, either → dropped or
 * converted; converted and dropped are re-opened (back to new) or entered again as a new prospect.
 */
export function actionsFor(status: ProspectStatus): ProspectAction[] {
  switch (status) {
    case 'new':
      return ['contacted', 'convert', 'dropped'];
    case 'contacted':
      return ['convert', 'dropped'];
    case 'converted':
      return ['reopen', 'reentry'];
    case 'dropped':
      return ['reopen', 'reentry'];
  }
}

/** +8801712345678 → 01712-345678 for reading and dialling in Bangladesh. */
export function displayPhone(n: string | undefined | null): string {
  const d = (n ?? '').replace(/\D/g, '');
  const local = d.startsWith('880') ? `0${d.slice(3)}` : d;
  return /^01\d{9}$/.test(local) ? `${local.slice(0, 5)}-${local.slice(5)}` : (n ?? '');
}

/** The body of a re-entry: the same details as a new prospect that remembers where it came from. */
export function reentryOf(p: Prospect, clientId: string) {
  return {
    clientId,
    name: p.name,
    phones: p.phones.filter((x) => x.number).map((x) => ({ number: x.number!, ...(x.label ? { label: x.label } : {}) })),
    address: p.address ?? undefined,
    note: p.note ?? undefined,
    branchId: p.branchId,
    fromProspectId: p.id,
  };
}
