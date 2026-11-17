import { describe, expect, it } from 'vitest';
import type { DataQuality } from '../api/reports';
import { ISSUE_GROUP, ISSUES, issueTotals, worstIssue } from '../model/data-quality';
import { creditDecimals, periodDate, sharedRanks, splitRanked } from '../model/leaderboard';

describe('data quality (FR-CUS-009)', () => {
  const report: DataQuality = {
    branches: [
      { branchId: 'b1', customers: 190, withIssues: 20, issues: { no_location: 11, missing_phone: 2, shared_phone: 2, unassigned: 3 } },
      { branchId: 'b2', customers: 120, withIssues: 9, issues: { no_location: 4, invalid_phone: 1, unassigned: 13 } },
    ],
  };

  it('covers every issue of the contract, each in a fix group', () => {
    expect(ISSUES).toHaveLength(9);
    expect(ISSUES.every((k) => ISSUE_GROUP[k])).toBe(true);
  });

  it('adds branches up without adding issues into the customer count', () => {
    const t = issueTotals(report);
    expect(t.customers).toBe(310);
    expect(t.withIssues).toBe(29);
    expect(t.byIssue.no_location).toBe(15);
    expect(t.byIssue.unassigned).toBe(16);
    expect(t.byIssue.far_from_branch).toBe(0);
  });

  it('opens the largest issue first, the first issue when everything is clean', () => {
    expect(worstIssue(issueTotals(report))).toBe('unassigned');
    expect(worstIssue(issueTotals({ branches: [{ issues: { no_location: 2, missing_phone: 2 } }] }))).toBe('no_location');
    expect(worstIssue(issueTotals(undefined))).toBe('no_location');
  });
});

describe('leaderboard (FR-REP-005)', () => {
  it('sends a month as YYYY-MM and a day as it is', () => {
    expect(periodDate('month', '2026-11-17')).toBe('2026-11');
    expect(periodDate('day', '2026-11-17')).toBe('2026-11-17');
  });

  it('marks ranks held by more than one person and lists unranked people last', () => {
    const rows = [{ rank: 1 }, { rank: 2 }, { rank: 2 }, { rank: 4 }, { rank: null }, { rank: 5 }];
    expect([...sharedRanks(rows)]).toEqual([2]);
    const { ranked, unranked } = splitRanked(rows);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4, 5]);
    expect(unranked).toHaveLength(1);
  });

  it('shows visit credit with decimals only when a joint visit made it fractional', () => {
    expect(creditDecimals(12)).toBe(0);
    expect(creditDecimals(11.5)).toBe(2);
  });
});
