import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { EV, useInvalidateOn } from '@/shared/feature/events';
import { DateTime } from 'luxon';
import { DHAKA, todayDhaka } from '@/shared/lib/time';
import { listOrItems } from '@/shared/api/list';

export function useOverview() {
  const branchId = useBranchId();
  const date = todayDhaka();
  useInvalidateOn([EV.collectionResolved, EV.customerTagged], [['dashboard']]);
  return useQuery({
    queryKey: ['dashboard', 'overview', { branchId, date }],
    queryFn: () => unwrap(api.GET('/dashboard/overview', { params: { query: { branchId, date } } })),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useStaffToday() {
  const branchId = useBranchId();
  const date = todayDhaka();
  return useQuery({
    queryKey: ['dashboard', 'staff-today', { branchId, date }],
    queryFn: () => unwrap(api.GET('/reports/staff-performance', { params: { query: { branchId, period: 'daily', date } } })),
    staleTime: 60_000,
  });
}

/**
 * FR-W-064: collections per day from the first day of last month to today (at most 62 days, one request), for the
 * 30-day trend, month-to-date against the same days of last month, and the cumulative month chart.
 */
export function useCollectionDays() {
  const branchId = useBranchId();
  const today = todayDhaka();
  const from = DateTime.fromISO(today, { zone: DHAKA }).minus({ months: 1 }).startOf('month').toISODate()!;
  useInvalidateOn([EV.collectionResolved], [['dashboard', 'days']]);
  return useQuery({
    queryKey: ['dashboard', 'days', { branchId, from, today }],
    queryFn: () => unwrap(api.GET('/reports/branch-trends', { params: { query: { branchId, from, to: today, granularity: 'day' } } })),
    staleTime: 5 * 60_000,
  });
}

/** This month per person (promises due and kept, visits) for the promise ring and the month leaders. */
export function useStaffMonth() {
  const branchId = useBranchId();
  const month = todayDhaka().slice(0, 7);
  return useQuery({
    queryKey: ['dashboard', 'staff-month', { branchId, month }],
    queryFn: () => unwrap(api.GET('/reports/staff-performance', { params: { query: { branchId, period: 'monthly', date: month } } })),
    staleTime: 5 * 60_000,
  });
}

/** Customers in each pay state (6 small requests: one row each, the total is what counts). */
export function usePayStateCounts(states: readonly string[]) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['dashboard', 'pay-states', { branchId }],
    queryFn: async () => {
      const all = await Promise.all(
        states.map(async (s) => {
          const r = await unwrap(api.GET('/customers', { params: { query: { branchId, payState: [s] as never, includeTotal: true, limit: 1 } } }));
          return [s, r.total ?? 0] as const;
        }),
      );
      return Object.fromEntries(all) as Record<string, number>;
    },
    staleTime: 5 * 60_000,
  });
}

/** This month's collections of each branch (only when all branches are shown; at most 12 branches). */
export function useBranchMonth(branchIds: string[]) {
  const today = todayDhaka();
  const from = `${today.slice(0, 7)}-01`;
  return useQuery({
    queryKey: ['dashboard', 'branch-month', { branchIds, from, today }],
    enabled: branchIds.length > 1,
    queryFn: async () =>
      Promise.all(
        branchIds.slice(0, 12).map(async (id) => {
          const r = await unwrap(api.GET('/reports/branch-trends', { params: { query: { branchId: id, from, to: today, granularity: 'month' } } }));
          const sum = { total: 0, count: 0, visits: 0 };
          for (const p of r.collection ?? []) {
            sum.total += p.totalPoisha ?? 0;
            sum.count += p.count ?? 0;
            sum.visits += p.visits ?? 0;
          }
          return { id, ...sum };
        }),
      ),
    staleTime: 5 * 60_000,
  });
}

/** Pin corrections waiting for a decision (the list holds at most 200). */
export function usePendingPins(enabled: boolean) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['dashboard', 'pins', { branchId }],
    enabled,
    queryFn: async () => listOrItems<unknown>(await unwrap(api.GET('/location-proposals', { params: { query: { branchId, status: 'pending' } } }))).length,
    staleTime: 60_000,
  });
}

/** Month leaders by collected amount. */
export function useMonthLeaders(enabled: boolean) {
  const branchId = useBranchId();
  const month = todayDhaka().slice(0, 7);
  return useQuery({
    queryKey: ['dashboard', 'leaders', { branchId, month }],
    enabled,
    queryFn: () => unwrap(api.GET('/reports/leaderboard', { params: { query: { branchId, period: 'month', date: month, metric: 'collected' } } })),
    staleTime: 5 * 60_000,
  });
}
