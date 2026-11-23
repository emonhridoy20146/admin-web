import type { components } from '@/shared/api/schema';

type Item = components['schemas']['CustomerListItem'];
export type Activity = components['schemas']['CustomerActivity'];

/**
 * FR-W-037 (master FR-CUS-017, contract 1.24.0): the four work marks of a customer row. They say what has been done
 * with the customer in the current month, whatever filter the list is in, so nobody goes to the same door twice.
 *  - visit:   `today` | `month` | null
 *  - paid:    `paid` (ERP money this month) | `pending` (field money not in the ERP yet) | null
 *  - promise: `broken` (one broke this month, none open) | `open` (a promise is waiting) | `kept` | null
 *  - pin:     true when the customer has a usable map pin
 * `known` is false on a server before 1.24.0 (no `activity`): the marks are then left out instead of saying "not done".
 */
export interface WorkMarks {
  known: boolean;
  visit: 'today' | 'month' | null;
  paid: 'paid' | 'pending' | null;
  promise: 'open' | 'broken' | 'kept' | null;
  pin: boolean;
}

export const hasPin = (c: Pick<Item, 'location'>): boolean => (c.location?.status === 'ok' || c.location?.status === 'overridden') && c.location.lat != null;

export function workMarks(c: Pick<Item, 'activity' | 'openPromise' | 'location'>): WorkMarks {
  const a = c.activity;
  const pin = hasPin(c);
  if (!a) return { known: false, visit: null, paid: null, promise: c.openPromise ? 'open' : null, pin };
  return {
    known: true,
    visit: a.visitedToday ? 'today' : a.visitCount > 0 ? 'month' : null,
    paid: a.paidPoisha > 0 ? 'paid' : a.pendingPoisha > 0 ? 'pending' : null,
    promise: c.openPromise ? 'open' : a.promisesBroken > 0 ? 'broken' : a.promisesKept > 0 ? 'kept' : null,
    pin,
  };
}

/** Nothing done with the customer this month: not visited, nothing paid or pending, no promise. */
export const untouched = (m: WorkMarks): boolean => m.known && !m.visit && !m.paid && !m.promise;

type Person = components['schemas']['ActivityPerson'];
type Payer = components['schemas']['ActivityPayer'];

/** One name on a "who did it" line. `office` = an office payment the ERP has no name for (FR-CUS-021). */
export interface WhoVM {
  name: string;
  /** true: show the "Office" label instead of `name` */
  office: boolean;
  /** true: a staff member who no longer exists (empty name on a visit or promise) */
  removed: boolean;
  count?: number;
  amountPoisha?: number;
}

/**
 * FR-W-037 / master FR-CUS-021 (contract 1.44.0): who did this month's work on a customer. ERP money (`paid`) and
 * field money not in the ERP yet (`pending`) are kept apart, never added together (CLAUDE.md §2.6). A payer with
 * `source: unknown` (or no name) is the office. Missing lists (server before 1.44.0) give empty lists.
 */
export function monthPeople(a: Activity | undefined | null): { visits: WhoVM[]; promises: WhoVM[]; paid: WhoVM[]; pending: WhoVM[] } {
  const person = (p: Person): WhoVM => ({ name: p.name ?? '', office: false, removed: !p.name, count: p.count });
  const payer = (p: Payer): WhoVM => {
    const office = p.source === 'unknown' || !p.name;
    return { name: office ? '' : p.name, office, removed: false, amountPoisha: p.amountPoisha };
  };
  const payers = a?.paidBy ?? [];
  return {
    visits: (a?.visitedBy ?? []).map(person),
    promises: (a?.promisedBy ?? []).map(person),
    paid: payers.filter((p) => !p.pending).map(payer),
    pending: payers.filter((p) => p.pending).map(payer),
  };
}

/** The display name of the newest payer this month: `lastPaidByName`, else the office when something was paid. */
export function lastPaidBy(a: Activity | undefined | null): WhoVM | null {
  if (!a) return null;
  if (a.lastPaidByName) return { name: a.lastPaidByName, office: false, removed: false };
  const first = a.paidBy?.[0];
  if (first) return monthPeople({ ...a, paidBy: [first] })[first.pending ? 'pending' : 'paid'][0] ?? null;
  return null;
}
