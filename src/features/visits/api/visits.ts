import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components, operations } from '@/shared/api/schema';

export type Visit = components['schemas']['VisitListItem'];
export type VisitOutcome = components['schemas']['VisitOutcome'];
export type VisitQuery = NonNullable<operations['listVisits']['parameters']['query']>;

export function useVisits(params: Omit<VisitQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query: VisitQuery = { ...params, branchId };
  return useQuery({
    queryKey: ['visits', 'list', query],
    queryFn: async () => {
      const r = await unwrap(api.GET('/visits', { params: { query } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null };
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Short-lived presigned URL for one photo (FR-VIS-003). Never cached beyond its expiry; never stored. */
export function useMediaUrl(id: string | null) {
  return useQuery({
    queryKey: ['visits', 'media', id],
    queryFn: () => unwrap(api.GET('/media/{id}/url', { params: { path: { id: id! } } })),
    enabled: !!id,
    staleTime: 4 * 60_000,
    gcTime: 5 * 60_000,
  });
}
