import { describe, expect, it } from 'vitest';
import { depositsSince, depositUserName, erpSplit, erpStage, isCarriedOver, isFinalDeposit, sortPositions, summarize, usage } from '../model/cash';

const p = (
  userId: string,
  onHandPoisha: number,
  limitPoisha: number,
  state: 'ok' | 'warning' | 'exceeded',
  oldestUndepositedAt: string | null = null,
  pendingDepositsPoisha = 0,
) => ({
  userId,
  userName: userId.toUpperCase(),
  onHandPoisha,
  limitPoisha,
  state,
  oldestUndepositedAt,
  pendingDepositsPoisha,
});

describe('cash model', () => {
  it('computes usage safely when limit is zero', () => {
    expect(usage({ onHandPoisha: 500, limitPoisha: 1000 })).toBe(0.5);
    expect(usage({ onHandPoisha: 500, limitPoisha: 0 })).toBe(500);
  });

  it('sorts over-limit first, then near-limit, then by usage', () => {
    const list = [
      p('a', 100, 1000, 'ok'),
      p('b', 900, 1000, 'warning'),
      p('c', 1200, 1000, 'exceeded'),
      p('d', 600, 1000, 'ok'),
    ];
    expect(sortPositions(list).map((x) => x.userId)).toEqual(['c', 'b', 'd', 'a']);
    expect(list[0]!.userId).toBe('a'); // does not mutate
  });

  // 1.35.0: nobody verifies a deposit any more, so the summary has no "pending deposits" money (old ones are ignored)
  it('summarizes totals, states and the oldest undeposited cash', () => {
    const s = summarize([
      p('a', 100, 1000, 'ok', '2026-11-15T04:00:00.000Z', 50),
      p('b', 0, 1000, 'ok'),
      p('c', 1200, 1000, 'exceeded', '2026-11-14T10:00:00.000Z'),
      p('d', 850, 1000, 'warning', '2026-11-15T03:00:00.000Z', 20),
    ]);
    expect(s).toEqual({
      onHandPoisha: 2150,
      holders: 3,
      exceeded: 1,
      warning: 1,
      oldest: '2026-11-14T10:00:00.000Z',
    });
  });

  it('flags cash carried over from a previous day', () => {
    const start = '2026-11-14T18:00:00.000Z'; // 00:00 Dhaka on 15 Nov
    expect(isCarriedOver({ oldestUndepositedAt: '2026-11-14T10:00:00.000Z' }, start)).toBe(true);
    expect(isCarriedOver({ oldestUndepositedAt: '2026-11-15T04:00:00.000Z' }, start)).toBe(false);
    expect(isCarriedOver({ oldestUndepositedAt: null }, start)).toBe(false);
  });

  it('joins the depositor name from positions', () => {
    expect(depositUserName({ userId: 'b' }, [p('b', 0, 1, 'ok')])).toBe('B');
    expect(depositUserName({ userId: 'x' }, undefined)).toBeUndefined();
    expect(depositUserName({ userId: 'b', userName: 'From deposit' }, [p('b', 0, 1, 'ok')])).toBe('From deposit');
  });

  // FR-CASH-010 (contract 1.35.0, ADR-049): deposits are final and hand in cash and non-cash collections together
  it('counts only final deposits made since a moment, cash and non-cash apart', () => {
    const start = '2026-11-21T18:00:00.000Z'; // 00:00 Dhaka on 22 Nov
    const list = [
      { status: 'submitted' as const, depositedAt: '2026-11-22T11:00:00.000Z', amountPoisha: 500_00, nonCashPoisha: 200_00, collectionCount: 3 },
      { status: 'submitted' as const, depositedAt: '2026-11-21T17:59:59.000Z', amountPoisha: 999_00, nonCashPoisha: 0, collectionCount: 1 }, // 23:59 Dhaka the day before
      { status: 'verified' as const, depositedAt: '2026-11-22T09:00:00.000Z', amountPoisha: 300_00 }, // an old one
      { status: 'submitted' as const, depositedAt: '2026-11-22T12:00:00.000Z', amountPoisha: 0, nonCashPoisha: 150_00, collectionCount: 1 },
    ].map((d) => ({ ...d, clientId: 'c', destination: 'bank' as const }));
    expect(depositsSince(list, start)).toEqual({ count: 2, cashPoisha: 500_00, nonCashPoisha: 350_00, collections: 4 });
    expect(isFinalDeposit({ status: 'submitted' })).toBe(true);
    expect(isFinalDeposit({ status: 'pending' })).toBe(false);
    expect(isFinalDeposit(undefined)).toBe(false);
  });

  it('splits deposited money by ERP state so field money is never shown as in the ERP', () => {
    expect(erpStage('posted')).toBe('posted');
    expect(erpStage('resolved_posted')).toBe('posted');
    expect(erpStage('received')).toBe('onTheWay');
    expect(erpStage('posting')).toBe('onTheWay');
    expect(erpStage('conflict')).toBe('problem');
    expect(erpStage('posting_failed')).toBe('problem');
    expect(erpStage('voided')).toBe('voided');
    expect(erpStage('resolved_refund')).toBe('voided');
    const s = erpSplit([
      { status: 'posted', amountPoisha: 100 },
      { status: 'posting', amountPoisha: 40 },
      { status: 'received', amountPoisha: 10 },
      { status: 'conflict', amountPoisha: 7 },
      { status: 'voided', amountPoisha: 3 },
    ]);
    expect(s).toEqual({
      posted: { poisha: 100, count: 1 },
      onTheWay: { poisha: 50, count: 2 },
      problem: { poisha: 7, count: 1 },
      voided: { poisha: 3, count: 1 },
    });
  });
});
