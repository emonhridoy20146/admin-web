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
