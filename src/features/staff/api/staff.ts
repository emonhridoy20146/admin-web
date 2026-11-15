import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components } from '@/shared/api/schema';

export type PerfRow = components['schemas']['StaffPerformanceRow'];
export type Area = components['schemas']['Area'];
export type Period = 'daily' | 'monthly';

/** FR-RPT-001: per-staff numbers for one day or one month. `date` is any day inside the period. */
export function usePerformance(period: Period, date: string) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['staff', 'performance', { branchId, period, date }],
    queryFn: () => unwrap(api.GET('/reports/staff-performance', { params: { query: { branchId, period, date } } })),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useAreas(enabled: boolean) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['staff', 'areas', branchId],
    queryFn: () => unwrap(api.GET('/areas', { params: { query: { branchId } } })),
    staleTime: 5 * 60_000,
    enabled,
  });
}
