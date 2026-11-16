import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components } from '@/shared/api/schema';

export type Latest = components['schemas']['LatestLocation'];
export type Stop = components['schemas']['Stop'];
export type DaySummary = components['schemas']['LocationDailySummary'];

/** How often the live map asks again. The server marks a position stale after 5 minutes, so 30 s is plenty. */
export const LIVE_REFRESH_MS = 30_000;

/** FR-LOC-006: last known position of every staff member on duty in the branch scope. */
export function useLatest() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['location', 'latest', { branchId }],
    queryFn: () => unwrap(api.GET('/location/latest', { params: { query: { branchId } } })),
    refetchInterval: LIVE_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** FR-LOC-007: one staff member's day: simplified track, stops, gaps and a summary. */
export function useHistory(userId: string, date: string) {
  return useQuery({
    queryKey: ['location', 'history', { userId, date }],
    queryFn: () => unwrap(api.GET('/location/history', { params: { query: { userId, date } } })),
    enabled: !!userId && !!date,
    staleTime: 60_000,
  });
}

export function useStaff() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['location', 'staff', branchId],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId, role: 'field_staff', active: true, limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}
