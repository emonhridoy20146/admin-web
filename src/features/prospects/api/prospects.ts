import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { emit, EV } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type Prospect = components['schemas']['Prospect'];
export type ProspectStatus = components['schemas']['ProspectStatus'];
export type ProspectQuery = NonNullable<operations['listProspects']['parameters']['query']>;

/** FR-PRO-001 (1.45.0): possible customers in scope, newest first, with the total for the filters. */
export function useProspects(params: Omit<ProspectQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query: ProspectQuery = { ...params, branchId };
  return useQuery({
    queryKey: ['prospects', 'list', query],
    queryFn: () => unwrap(api.GET('/prospects', { params: { query } })),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useProspect(id: string | null) {
  return useQuery({
    queryKey: ['prospects', 'detail', id],
    enabled: !!id,
    queryFn: () => unwrap(api.GET('/prospects/{id}', { params: { path: { id: id! } } })),
    staleTime: 15_000,
  });
}

function useDone() {
  const qc = useQueryClient();
  return (p: Prospect) => {
    qc.setQueryData(['prospects', 'detail', p.id], p);
    void qc.invalidateQueries({ queryKey: ['prospects', 'list'] });
    emit(EV.prospectChanged);
  };
}

/** Status between new, contacted and dropped, with a reason kept in the history. */
export function useSetProspectStatus() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'new' | 'contacted' | 'dropped'; reason?: string }) =>
      unwrap(api.PATCH('/prospects/{id}', { params: { path: { id } }, body: { status, reason } })),
    onSuccess: done,
  });
}

/** Mark converted and link to a customer (FOS id) or an ERP customer code. */
export function useConvertProspect() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; customerId?: string; erpCustomerCode?: string; note?: string }) =>
      unwrap(api.POST('/prospects/{id}/convert', { params: { path: { id } }, body })),
    onSuccess: done,
  });
}

/** A converted or dropped prospect back to `new` (re-entry); the old link stays in the history. */
export function useReopenProspect() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => unwrap(api.POST('/prospects/{id}/reopen', { params: { path: { id } }, body: { reason } })),
    onSuccess: done,
  });
}

/** A new possible customer from the office; `fromProspectId` records a re-entry of an older one. */
export function useCreateProspect() {
  const done = useDone();
  return useMutation({
    mutationFn: (body: components['schemas']['ProspectCreate']) => unwrap(api.POST('/prospects', { body })),
    onSuccess: done,
  });
}
