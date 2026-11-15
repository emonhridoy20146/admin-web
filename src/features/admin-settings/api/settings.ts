import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';

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
