import { describe, expect, it } from 'vitest';
import { depositUserName, isCarriedOver, sortPositions, summarize, usage } from '../model/cash';

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
      pendingDepositsPoisha: 70,
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
  });
});
