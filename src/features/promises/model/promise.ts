import { addDays } from '@/shared/lib/time';
import type { PromiseItem, PromiseStatus } from '../api/promises';

/** Promised-date windows a manager works with: what is due, what is coming, what just passed. */
export const WINDOWS = ['today', 'next7', 'last7', 'last30'] as const;
export type Window = (typeof WINDOWS)[number];

export function windowFor(w: Window, today: string): { from: string; to: string } {
  switch (w) {
    case 'today':
      return { from: today, to: today };
    case 'next7':
      return { from: addDays(today, 1), to: addDays(today, 7) };
    case 'last7':
      return { from: addDays(today, -7), to: addDays(today, -1) };
    case 'last30':
      return { from: addDays(today, -30), to: addDays(today, -1) };
  }
}

export const STATUSES: PromiseStatus[] = ['open', 'kept', 'partially_kept', 'broken', 'superseded', 'cancelled'];

/** Days from today to the promised date: 0 today, positive ahead, negative late. */
export function daysTo(promisedDate: string, today: string): number {
  return Math.round((Date.parse(`${promisedDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** An open promise whose date has passed (the server marks it broken after the grace days). */
export function isLate(p: Pick<PromiseItem, 'status' | 'promisedDate'>, today: string): boolean {
  return p.status === 'open' && p.promisedDate < today;
}

/** Share of the promised amount already paid, 0…1. */
export function paidRatio(p: Pick<PromiseItem, 'promisedAmountPoisha' | 'paidTowardsPoisha'>): number {
  if (!p.promisedAmountPoisha) return 0;
  return Math.max(0, Math.min(1, (p.paidTowardsPoisha ?? 0) / p.promisedAmountPoisha));
}

export function canCancel(status: PromiseStatus | undefined): boolean {
  return status === 'open';
}
