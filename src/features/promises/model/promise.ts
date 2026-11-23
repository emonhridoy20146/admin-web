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

type Linked = Pick<PromiseItem, 'id' | 'followUpOf' | 'followUpId' | 'attempt' | 'status' | 'chainRootId'>;

/**
 * FR-PRM-006 (1.45.0): the chain a promise belongs to, first promise first: original → broken → follow-up → …
 * Built from the customer's promises by walking `followUpOf` back to the root and the follow-ups forward; a link to a
 * promise that is not in the list ends the chain there (the customer's list holds the last 20).
 */
export function chainOf<T extends Linked>(id: string, all: T[]): T[] {
  const byId = new Map(all.filter((p) => p.id).map((p) => [p.id!, p]));
  const start = byId.get(id);
  if (!start) return [];
  const back: T[] = [];
  const seen = new Set<string>();
  for (let p: T | undefined = start; p && !seen.has(p.id!); p = p.followUpOf ? byId.get(p.followUpOf) : undefined) {
    seen.add(p.id!);
    back.unshift(p);
  }
  const followers = (of: string) => all.filter((p) => p.followUpOf === of && p.status !== 'cancelled');
  for (let p: T | undefined = followers(start.id!)[0]; p && !seen.has(p.id!); p = followers(p.id!)[0]) {
    seen.add(p.id!);
    back.push(p);
  }
  return back;
}

/** All chains of a customer, newest chain first; each chain first promise first. */
export function chainsOf<T extends Linked & { createdAt?: string }>(all: T[]): T[][] {
  const roots = new Map<string, T[]>();
  for (const p of all) {
    if (!p.id) continue;
    const c = chainOf(p.id, all);
    const key = c[0]?.id ?? p.id;
    // the longest walk wins, so a cancelled follow-up still shows at the end of its chain
    if ((roots.get(key)?.length ?? 0) < c.length) roots.set(key, c);
  }
  const last = (c: T[]) => c.reduce((m, p) => ((p.createdAt ?? '') > m ? (p.createdAt ?? '') : m), '');
  return [...roots.values()].sort((a, b) => last(b).localeCompare(last(a)));
}

/** A broken or partially kept promise nobody followed up yet: the office may make the next promise. */
export function needsFollowUp(p: Pick<PromiseItem, 'status' | 'followUpId'>): boolean {
  return (p.status === 'broken' || p.status === 'partially_kept') && !p.followUpId;
}
