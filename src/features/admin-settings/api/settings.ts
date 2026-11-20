import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { EV, emit } from '@/shared/feature/events';

export type SettingsMap = Record<string, unknown>;

/** Org-wide settings, or what applies in one branch (its own values where it has them, the org's otherwise). */
export function useSettings(branchId?: string) {
  return useQuery({
    queryKey: ['admin-settings', branchId ?? 'global'],
    queryFn: async () => (await unwrap(api.GET('/settings', { params: { query: branchId ? { branchId } : {} } }))) as SettingsMap,
  });
}

/** With `branchId` the changes are saved for that branch only (the server refuses keys a branch cannot override). */
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ changes, reason, branchId }: { changes: SettingsMap; reason: string; branchId?: string }) =>
      unwrap(api.PATCH('/settings', { body: { changes, reason, ...(branchId ? { branchId } : {}) } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-settings'] }),
  });
}

/** FR-BR-002: set or clear a branch's map point (the ERP has none). Other features refresh on `branch.changed`. */
export function useSetBranchLocation() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { lat: number | null; lng: number | null } }) =>
      unwrap(api.PUT('/branches/{id}/location', { params: { path: { id } }, body })),
    onSuccess: () => emit(EV.branchChanged),
  });
}
