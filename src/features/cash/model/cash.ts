import type { CashPosition, Deposit } from '../api/cash';

const STATE_RANK: Record<string, number> = { exceeded: 0, warning: 1, ok: 2 };

export function usage(p: Pick<CashPosition, 'onHandPoisha' | 'limitPoisha'>): number {
  return (p.onHandPoisha ?? 0) / Math.max(1, p.limitPoisha ?? 0);
}

/** Over-limit first, then near-limit, then by share of limit used, then by amount (FR-CASH-004). */
export function sortPositions(list: CashPosition[]): CashPosition[] {
  return [...list].sort(
    (a, b) =>
      (STATE_RANK[a.state ?? 'ok'] ?? 2) - (STATE_RANK[b.state ?? 'ok'] ?? 2) ||
      usage(b) - usage(a) ||
      (b.onHandPoisha ?? 0) - (a.onHandPoisha ?? 0),
  );
}

/** Cash held since before today's Dhaka business date (should have been deposited). */
export function isCarriedOver(p: Pick<CashPosition, 'oldestUndepositedAt'>, todayStartIso: string): boolean {
  return !!p.oldestUndepositedAt && p.oldestUndepositedAt < todayStartIso;
}

export interface CashSummary {
  onHandPoisha: number;
  holders: number;
  exceeded: number;
  warning: number;
  pendingDepositsPoisha: number;
  oldest: string | null;
}

export function summarize(list: CashPosition[]): CashSummary {
  let oldest: string | null = null;
  const s = list.reduce<CashSummary>(
    (acc, p) => {
      acc.onHandPoisha += p.onHandPoisha ?? 0;
      if ((p.onHandPoisha ?? 0) > 0) acc.holders++;
      if (p.state === 'exceeded') acc.exceeded++;
      if (p.state === 'warning') acc.warning++;
      acc.pendingDepositsPoisha += p.pendingDepositsPoisha ?? 0;
      if (p.oldestUndepositedAt && (!oldest || p.oldestUndepositedAt < oldest))
        oldest = p.oldestUndepositedAt;
      return acc;
    },
    { onHandPoisha: 0, holders: 0, exceeded: 0, warning: 0, pendingDepositsPoisha: 0, oldest: null },
  );
  s.oldest = oldest;
  return s;
}

/** Contract gap: Deposit has no user name; join it from the cash positions of the same branch. */
export function depositUserName(
  d: Pick<Deposit, 'userId'>,
  positions: CashPosition[] | undefined,
): string | undefined {
  return positions?.find((p) => p.userId === d.userId)?.userName;
}
