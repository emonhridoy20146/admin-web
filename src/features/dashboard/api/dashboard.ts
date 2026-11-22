import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { EV, useInvalidateOn } from '@/shared/feature/events';
import { todayDhaka } from '@/shared/lib/time';

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
