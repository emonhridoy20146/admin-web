import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { emit, EV } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type PromiseItem = components['schemas']['PromiseListItem'];
export type PromiseStatus = components['schemas']['PromiseStatus'];
export type PromiseQuery = NonNullable<operations['listPromises']['parameters']['query']>;

export function usePromises(params: Omit<PromiseQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query: PromiseQuery = { ...params, branchId };
  return useQuery({
    queryKey: ['promises', 'list', query],
    queryFn: async () => {
      const r = await unwrap(api.GET('/promises', { params: { query } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null };
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useCreatePromise() {
  const qc = useQueryClient();
  return useMutation({
    // `clientId` is made once per dialog by the caller, so a retry after a network error cannot make two promises
    mutationFn: ({ clientId, ...body }: { clientId?: string; customerId: string; promisedDate: string; promisedAmountPoisha: number; erpPlanId?: string; note?: string; followUpOf?: string }) =>
      unwrap(api.POST('/promises', { body: { ...body, clientId: clientId ?? crypto.randomUUID() } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['promises'] });
      void qc.invalidateQueries({ queryKey: ['customers', 'detail'] });
      emit(EV.promiseCreated);
    },
  });
}

export function useCancelPromise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => unwrap(api.POST('/promises/{id}/cancel', { params: { path: { id } }, body: { reason } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['promises'] });
      emit(EV.promiseChanged);
    },
  });
}

/** FR-PRM-006: every promise of one customer (newest 100), to draw the follow-up chains. */
export function useCustomerPromises(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ['promises', 'customer', customerId],
    enabled: !!customerId,
    queryFn: async () => (await unwrap(api.GET('/promises', { params: { query: { customerId: customerId!, limit: 100 } } }))).items ?? [],
    staleTime: 30_000,
  });
}
