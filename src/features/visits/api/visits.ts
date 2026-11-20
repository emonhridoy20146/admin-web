import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { viaApiProxy } from '@/shared/api/config';
import { useBranchId } from '@/shared/lib/ui-store';
import { emit, EV } from '@/shared/feature/events';
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

export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { customerId: string; outcome: VisitOutcome; note?: string }) =>
      unwrap(api.POST('/visits', {
        body: {
          clientId: crypto.randomUUID(),
          customerId: body.customerId,
          checkInAt: new Date().toISOString(),
          outcome: body.outcome,
          geo: null,
          geoUnavailableReason: 'permission_denied',
        },
      })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['visits'] });
      emit(EV.visitCreated);
    },
  });
}

/** Short-lived presigned URL for one photo (FR-VIS-003). Never cached beyond its expiry; never stored. */
export function useMediaUrl(id: string | null) {
  return useQuery({
    queryKey: ['visits', 'media', id],
    queryFn: () => unwrap(api.GET('/media/{id}/url', { params: { path: { id: id! } } })).then((r) => ({ ...r, url: viaApiProxy(r.url) })),
    enabled: !!id,
    staleTime: 4 * 60_000,
    gcTime: 5 * 60_000,
  });
}
