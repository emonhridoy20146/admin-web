import type { DataQuality, DataQualityIssue } from '../api/reports';

export type Issue = DataQualityIssue;

/** Display order: where a field visit fails first (location, phone), then ERP data, then who owns the customer. */
export const ISSUES: Issue[] = ['no_location', 'invalid_location', 'suspect_swapped', 'far_from_branch', 'missing_phone', 'invalid_phone', 'shared_phone', 'plan_without_schedule', 'unassigned'];

export type IssueGroup = 'location' | 'phone' | 'plan' | 'assignment';
export const ISSUE_GROUP: Record<Issue, IssueGroup> = {
  no_location: 'location', invalid_location: 'location', suspect_swapped: 'location', far_from_branch: 'location',
  missing_phone: 'phone', invalid_phone: 'phone', shared_phone: 'phone',
  plan_without_schedule: 'plan', unassigned: 'assignment',
};

export interface IssueTotals {
  customers: number;
  withIssues: number;
  byIssue: Partial<Record<Issue, number>>;
}

/** Totals over the branches in the response (one customer can have several issues, so issue counts do not add up to withIssues). */
export function issueTotals(r: DataQuality | undefined): IssueTotals {
  const out: IssueTotals = { customers: 0, withIssues: 0, byIssue: {} };
  for (const b of r?.branches ?? []) {
    out.customers += b.customers ?? 0;
    out.withIssues += b.withIssues ?? 0;
    for (const k of ISSUES) out.byIssue[k] = (out.byIssue[k] ?? 0) + (b.issues?.[k] ?? 0);
  }
  return out;
}

/** The issue to open first: the one with the most customers (ties keep display order); the first issue when all are clean. */
export function worstIssue(t: IssueTotals): Issue {
  return ISSUES.reduce<Issue>((a, b) => ((t.byIssue[b] ?? 0) > (t.byIssue[a] ?? 0) ? b : a), ISSUES[0]!);
}
