import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { emit, EV } from '@/shared/feature/events';
import type { components, paths } from '@/shared/api/schema';

export type TargetValue = components['schemas']['TargetValue'];
export type StaffTarget = components['schemas']['StaffTarget'];
export type TargetSet = NonNullable<paths['/targets/users/{id}']['put']['requestBody']>['content']['application/json'];
export type TargetChange = components['schemas']['TargetChange'];

/** FR-COL-015: the targets in force for one branch on one Dhaka day (branch default + each field staff member). */
export function useTargets(branchId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['targets', 'list', { branchId, date }],
    queryFn: () => unwrap(api.GET('/targets', { params: { query: { branchId, date } } })),
    enabled: !!branchId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Dated history of one person's targets (personal and the branch defaults that applied). */
export function useTargetHistory(userId: string | null) {
  return useQuery({
    queryKey: ['targets', 'history', userId],
    queryFn: () => unwrap(api.GET('/targets/users/{id}/history', { params: { path: { id: userId! } } })),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

function useDone() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['targets'] });
    emit(EV.targetChanged);
  };
}

/** Not optimistic: target amounts are money figures and wait for the server (CLAUDE.md §2.6). */
export function useSetUserTarget() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: TargetSet }) => unwrap(api.PUT('/targets/users/{id}', { params: { path: { id: userId } }, body })),
    onSuccess: done,
  });
}

export function useClearUserTarget() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ userId, reason, effectiveFrom }: { userId: string; reason: string; effectiveFrom?: string }) =>
      unwrap(api.POST('/targets/users/{id}/clear', { params: { path: { id: userId } }, body: { reason, ...(effectiveFrom ? { effectiveFrom } : {}) } })),
    onSuccess: done,
  });
}

export function useSetBranchTarget() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: TargetSet }) => unwrap(api.PUT('/targets/branches/{id}', { params: { path: { id: branchId } }, body })),
    onSuccess: done,
  });
}
