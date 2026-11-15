import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { EV, useInvalidateOn } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type CustomerListItem = components['schemas']['CustomerListItem'];
export type CustomerDetail = components['schemas']['CustomerDetail'];
export type CustomerQuery = NonNullable<operations['listCustomers']['parameters']['query']>;

export function useCustomers(params: Omit<CustomerQuery, 'branchId'>) {
  const branchId = useBranchId();
  useInvalidateOn([EV.customerTagged, EV.collectionResolved], [['customers']]);
  const query: CustomerQuery = { ...params, branchId };
  return useQuery({
    queryKey: ['customers', 'list', query],
    queryFn: () => unwrap(api.GET('/customers', { params: { query } })),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useCustomer(id: string | null | undefined) {
  useInvalidateOn([EV.customerTagged, EV.collectionResolved], [['customers', 'detail']]);
  return useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => unwrap(api.GET('/customers/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useTimeline(id: string) {
  return useInfiniteQuery({
    queryKey: ['customers', 'timeline', id],
    queryFn: ({ pageParam }) => unwrap(api.GET('/customers/{id}/timeline', { params: { path: { id }, query: { limit: 20, cursor: pageParam || undefined } } })),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** FR-ERP-005 manual refresh of one customer from the ERP. */
export function useRefreshCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/customers/{id}/refresh', { params: { path: { id } } })),
    onSuccess: (data) => {
      qc.setQueryData(['customers', 'detail', id], data);
      void qc.invalidateQueries({ queryKey: ['customers', 'list'] });
    },
  });
}
