import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { EV, emit } from '@/shared/feature/events';

export type SettingsMap = Record<string, unknown>;

export function useSettings() {
  return useQuery({ queryKey: ['admin-settings', 'global'], queryFn: async () => (await unwrap(api.GET('/settings'))) as SettingsMap });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ changes, reason }: { changes: SettingsMap; reason: string }) => unwrap(api.PATCH('/settings', { body: { changes, reason } })),
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
