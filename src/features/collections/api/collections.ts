import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { emit, EV } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type Collection = components['schemas']['Collection'];
export type CollectionQuery = NonNullable<operations['listCollections']['parameters']['query']>;
export type ResolveBody = operations['resolveCollection']['requestBody']['content']['application/json'];

export function useCollections(params: Omit<CollectionQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query = { ...params, branchId };
  return useQuery({
    queryKey: ['collections', 'list', query],
    queryFn: () => unwrap(api.GET('/collections', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useCollection(id: string | null) {
  return useQuery({
    queryKey: ['collections', 'detail', id],
    queryFn: () => unwrap(api.GET('/collections/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

export function useConflicts() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['collections', 'conflicts', branchId],
    queryFn: async () => {
      const r = await unwrap(api.GET('/collections/conflicts', { params: { query: { branchId, limit: 100 } } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null };
    },
    staleTime: 0,
  });
}

export function useCustomerForConflict(id: string | undefined) {
  return useQuery({
    queryKey: ['collections', 'customer', id],
    queryFn: () => unwrap(api.GET('/customers/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

/** Money action: never optimistic; one Idempotency-Key per dialog, reused on retry (W-E5). */
export function useResolve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, key, body }: { id: string; key: string; body: ResolveBody }) =>
      unwrap(
        api.POST('/collections/{id}/resolve', {
          params: { path: { id }, header: { 'Idempotency-Key': key } },
          body,
        }),
      ),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['collections'] });
      emit(EV.collectionResolved, { id: c.id });
    },
  });
}

export function useVoid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(api.POST('/collections/{id}/void', { params: { path: { id } }, body: { reason } })),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['collections'] });
      emit(EV.collectionVoided, { id: v.id });
    },
  });
}

/** Nav badge: open conflicts in the current branch. */
export function useConflictBadge(): number | undefined {
  const q = useConflicts();
  return q.data?.items.length || undefined;
}
