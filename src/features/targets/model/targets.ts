import type { StaffTarget } from '../api/targets';

const BN = '০১২৩৪৫৬৭৮৯';
const ascii = (s: string) => s.replace(/[০-৯]/g, (c) => String(BN.indexOf(c))).replace(/[,\s]/g, '').trim();

export interface TargetDraft {
  taka: string;
  visits: string;
  effectiveFrom: string;
  reason: string;
}

export type DraftErrors = Partial<Record<keyof TargetDraft, string>>;

/** Largest daily amount accepted from the form (৳10 lakh), a guard against an extra zero typed by mistake. */
export const MAX_DAILY_TAKA = 1_000_000;
export const MAX_DAILY_VISITS = 200;
export const MIN_REASON = 5;

/**
 * Validate the target form and build the request body. Amounts are typed in whole taka (Bangla digits allowed) and
 * sent as poisha. A start date before today is refused (the server answers TARGET_IN_PAST too), so reports of past
 * days never change.
 */
export function parseDraft(d: TargetDraft, today: string): { body?: { amountPoisha: number; visits: number; effectiveFrom: string; reason: string }; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const taka = ascii(d.taka);
  const visits = ascii(d.visits);
  if (!/^\d+$/.test(taka)) errors.taka = 'errors.number';
  else if (Number(taka) > MAX_DAILY_TAKA) errors.taka = 'errors.tooBig';
  if (!/^\d+$/.test(visits)) errors.visits = 'errors.number';
  else if (Number(visits) > MAX_DAILY_VISITS) errors.visits = 'errors.tooBig';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveFrom)) errors.effectiveFrom = 'errors.date';
  else if (d.effectiveFrom < today) errors.effectiveFrom = 'errors.past';
  if (d.reason.trim().length < MIN_REASON) errors.reason = 'errors.reason';
  if (Object.keys(errors).length) return { errors };
  return { body: { amountPoisha: Number(taka) * 100, visits: Number(visits), effectiveFrom: d.effectiveFrom, reason: d.reason.trim() }, errors };
}

export function draftFrom(v: { amountPoisha?: number; visits?: number } | undefined, today: string): TargetDraft {
  return { taka: v?.amountPoisha != null ? String(Math.round(v.amountPoisha / 100)) : '', visits: v?.visits != null ? String(v.visits) : '', effectiveFrom: today, reason: '' };
}

export interface TargetTotals {
  amountPoisha: number;
  visits: number;
  working: number;
  personal: number;
}

/** Branch total for the day: only people with a working day count. */
export function totals(items: StaffTarget[] | undefined): TargetTotals {
  const t: TargetTotals = { amountPoisha: 0, visits: 0, working: 0, personal: 0 };
  for (const i of items ?? []) {
    if (i.source === 'personal') t.personal++;
    if (i.workingDay === false) continue;
    t.working++;
    t.amountPoisha += i.amountPoisha ?? 0;
    t.visits += i.visits ?? 0;
  }
  return t;
}
