import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { emit, EV } from '@/shared/feature/events';
import type { operations } from '@/shared/api/schema';

export type SetTagBody = operations['setTag']['requestBody']['content']['application/json'];

export function useTagHistory(customerId: string) {
  return useQuery({
    queryKey: ['tags', 'history', customerId],
    queryFn: () => unwrap(api.GET('/customers/{id}/tag-history', { params: { path: { id: customerId } } })),
  });
}

export function useSetTag(customerId: string, version?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetTagBody) =>
      unwrap(api.PUT('/customers/{id}/tag', { params: { path: { id: customerId }, header: version != null ? { 'If-Match': `"${version}"` } : {} }, body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tags', 'history', customerId] });
      emit(EV.customerTagged, { customerId });
    },
  });
}
