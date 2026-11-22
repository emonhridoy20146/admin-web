import type { CashPosition, Deposit, DepositLine } from '../api/cash';

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
      if (p.oldestUndepositedAt && (!oldest || p.oldestUndepositedAt < oldest))
        oldest = p.oldestUndepositedAt;
      return acc;
    },
    { onHandPoisha: 0, holders: 0, exceeded: 0, warning: 0, oldest: null },
  );
  s.oldest = oldest;
  return s;
}

/** Depositor name: `Deposit.userName` (contract 1.3.0), else joined from the cash positions of the same branch. */
export function depositUserName(
  d: Pick<Deposit, 'userId' | 'userName'>,
  positions: CashPosition[] | undefined,
): string | undefined {
  return d.userName || positions?.find((p) => p.userId === d.userId)?.userName;
}

/** FR-CASH-010 (1.35.0): a deposit made from 1.35.0 on is `submitted`, final, and lists every collection it handed in. */
export function isFinalDeposit(d: Pick<Deposit, 'status'> | undefined): boolean {
  return d?.status === 'submitted';
}

export interface DepositsTotal {
  count: number;
  cashPoisha: number;
  nonCashPoisha: number;
  collections: number;
}

/** Deposits made on or after `sinceIso` (field-system money handed in, not an ERP balance). */
export function depositsSince(list: Deposit[], sinceIso: string): DepositsTotal {
  return list
    .filter((d) => isFinalDeposit(d) && (d.depositedAt ?? '') >= sinceIso)
    .reduce<DepositsTotal>(
      (acc, d) => ({
        count: acc.count + 1,
        cashPoisha: acc.cashPoisha + (d.amountPoisha ?? 0),
        nonCashPoisha: acc.nonCashPoisha + (d.nonCashPoisha ?? 0),
        collections: acc.collections + (d.collectionCount ?? 0),
      }),
      { count: 0, cashPoisha: 0, nonCashPoisha: 0, collections: 0 },
    );
}

/** Where a deposited collection stands with the ERP: in it, on its way, needs the office, or no longer counts. */
export type ErpStage = 'posted' | 'onTheWay' | 'problem' | 'voided';

export function erpStage(status: DepositLine['status']): ErpStage {
  switch (status) {
    case 'posted':
    case 'resolved_posted':
      return 'posted';
    case 'conflict':
    case 'posting_failed':
      return 'problem';
    case 'voided':
    case 'resolved_voided':
    case 'resolved_refund':
      return 'voided';
    default:
      return 'onTheWay';
  }
}

export type ErpSplit = Record<ErpStage, { poisha: number; count: number }>;

/**
 * CLAUDE.md §2.6: the money a deposit handed in, split by ERP state, so the panel never shows field money as if it were
 * in the ERP. Each line is a whole collection (1.35.0).
 */
export function erpSplit(items: Pick<DepositLine, 'status' | 'amountPoisha'>[]): ErpSplit {
  const out: ErpSplit = { posted: { poisha: 0, count: 0 }, onTheWay: { poisha: 0, count: 0 }, problem: { poisha: 0, count: 0 }, voided: { poisha: 0, count: 0 } };
  for (const i of items) {
    const s = out[erpStage(i.status)];
    s.poisha += i.amountPoisha;
    s.count++;
  }
  return out;
}
