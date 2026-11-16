import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components } from '@/shared/api/schema';

export type Device = components['schemas']['Device'];

/** FR-AUTH-007/008: phones bound to staff accounts in the branch scope. */
export function useDevices(enabled = true) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['admin-devices', 'list', { branchId }],
    queryFn: () => unwrap(api.GET('/devices', { params: { query: { branchId } } })),
    staleTime: 30_000,
    enabled,
  });
}

/** `Device` carries only `userId`, so names come from the users list of the same scope. */
export function useDeviceUsers() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['admin-devices', 'users', branchId],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId, limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}

function useDone() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['admin-devices', 'list'] });
}

export function useApproveDevice() {
  const done = useDone();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/devices/{id}/approve', { params: { path: { id } } })),
    onSuccess: done,
  });
}

export function useUnbindDevice() {
  const done = useDone();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => unwrap(api.POST('/devices/{id}/unbind', { params: { path: { id: v.id } }, body: { reason: v.reason } })),
    onSuccess: done,
  });
}
