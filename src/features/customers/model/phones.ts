import type { components } from '@/shared/api/schema';

type Detail = components['schemas']['CustomerDetail'];
export type PhoneDetail = components['schemas']['PhoneDetail'];

/** FR-CUS-016 (contract 1.23.0): most numbers that can be added to one customer, and in one request. */
export const MAX_EXTRA_PHONES = 5;

/**
 * The customer's numbers with where each came from. Servers before 1.23.0 send only `phones`: those are all
 * ERP numbers, the first one the office's main number.
 */
export function phoneRows(c: Pick<Detail, 'phone' | 'phones' | 'phoneDetails'>): PhoneDetail[] {
  if (c.phoneDetails?.length) return c.phoneDetails;
  const list = (c.phones?.length ? c.phones : [c.phone]).filter((p): p is string => !!p);
  return list.map((number, i) => ({ number, source: 'erp' as const, primary: i === 0 }));
}

export const addedCount = (rows: PhoneDetail[]) => rows.filter((r) => r.source === 'field').length;

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/**
 * One Bangladeshi mobile number as `01XXXXXXXXX`, or null. Same rule as field-api (`customers/domain/phones.ts`),
 * used only to tell the user early; the server checks again.
 */
export function normalizeMobile(input: string): string | null {
  let d = '';
  for (const ch of input.trim()) {
    const bn = BN_DIGITS.indexOf(ch);
    if (bn >= 0) d += String(bn);
    else if (ch >= '0' && ch <= '9') d += ch;
    else if (!' -()+.'.includes(ch)) return null;
  }
  if (d.length === 13 && d.startsWith('880')) d = d.slice(2);
  else if (d.length === 10 && /^1[3-9]/.test(d)) d = `0${d}`;
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

export interface PhoneDraft {
  number: string;
  label: string;
}
export type DraftError = 'invalid' | 'duplicate' | 'repeated';

/**
 * Checks the rows of the "add numbers" form. Empty rows are ignored. `duplicate` = the customer already has the
 * number; `repeated` = typed twice in this form.
 */
export function checkDrafts(drafts: PhoneDraft[], existing: PhoneDetail[]): { errors: (DraftError | null)[]; phones: { number: string; label?: string }[] } {
  const have = new Set(existing.map((e) => e.number));
  const typed = new Set<string>();
  const phones: { number: string; label?: string }[] = [];
  const errors = drafts.map((d): DraftError | null => {
    if (!d.number.trim()) return null;
    const n = normalizeMobile(d.number);
    if (!n) return 'invalid';
    if (have.has(n)) return 'duplicate';
    if (typed.has(n)) return 'repeated';
    typed.add(n);
    phones.push({ number: n, ...(d.label.trim() ? { label: d.label.trim() } : {}) });
    return null;
  });
  return { errors, phones };
}
