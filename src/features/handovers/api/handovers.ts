import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { emit, EV } from '@/shared/feature/events';
import type { components } from '@/shared/api/schema';

export type Handover = components['schemas']['Handover'];
export type HandoverCreate = components['schemas']['HandoverCreate'];
export type HandoverStatus = components['schemas']['HandoverStatus'];
export type Area = components['schemas']['Area'];
export type User = components['schemas']['User'];

export function useHandovers() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['handovers', 'list', branchId],
    queryFn: () => unwrap(api.GET('/handovers', { params: { query: { branchId } } })),
    staleTime: 30_000,
  });
}

/** Field staff of the branch: names for the list and the from/to pickers (Handover carries ids only). */
export function useStaff() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['handovers', 'staff', branchId],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId, role: 'field_staff', limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}

export function useAreas() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['handovers', 'areas', branchId],
    queryFn: () => unwrap(api.GET('/areas', { params: { query: { branchId } } })),
    staleTime: 5 * 60_000,
  });
}

function useDone() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['handovers'] });
    emit(EV.handoverChanged);
  };
}

export function useCreateHandover() {
  const done = useDone();
  return useMutation({
    mutationFn: (body: HandoverCreate) => unwrap(api.POST('/handovers', { body })),
    onSuccess: done,
  });
}

export function useCancelHandover() {
  const done = useDone();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/handovers/{id}/cancel', { params: { path: { id } } })),
    onSuccess: done,
  });
}
