import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { emit, EV } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type PermissionDef = components['schemas']['PermissionDef'];
export type OverrideChange = components['schemas']['OverrideChange'];
export type Role = components['schemas']['Role'];
export type Effective = operations['effectivePermissions']['responses']['200']['content']['application/json'][number];

export function useCatalog() {
  return useQuery({ queryKey: ['admin-rbac', 'catalog'], queryFn: () => unwrap(api.GET('/rbac/permissions')), staleTime: 10 * 60_000 });
}

export function useEffective(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['admin-rbac', 'effective', userId],
    queryFn: () => unwrap(api.GET('/rbac/users/{userId}/effective', { params: { path: { userId: userId! } } })),
    enabled: !!userId,
  });
}

/** Users holding a role in a branch: used for "affects N users" and as the probe for current branch overrides. */
export function useRoleHolders(branchId: string | undefined, role: Role | undefined) {
  return useQuery({
    queryKey: ['admin-rbac', 'holders', branchId, role],
    queryFn: () => unwrap(api.GET('/users', { params: { query: { branchId, role, active: true, limit: 100 } } })),
    enabled: !!branchId && !!role,
  });
}

export function useUserPick(userId: string | null) {
  return useQuery({ queryKey: ['admin-rbac', 'user', userId], queryFn: () => unwrap(api.GET('/users/{id}', { params: { path: { id: userId! } } })), enabled: !!userId });
}

export function useUserSearch(q: string) {
  return useQuery({
    queryKey: ['admin-rbac', 'user-search', q],
    queryFn: () => unwrap(api.GET('/users', { params: { query: { q, active: true, limit: 8 } } })),
    enabled: q.trim().length >= 2,
  });
}

function useDone() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['admin-rbac'] });
    emit(EV.permissionsChanged);
  };
}

export function useSetBranchOverrides() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ branchId, role, changes, reason }: { branchId: string; role: Role; changes: OverrideChange[]; reason: string }) =>
      unwrap(api.PUT('/rbac/overrides/branch/{branchId}', { params: { path: { branchId } }, body: { role, changes, reason } })),
    onSuccess: done,
  });
}

export function useSetUserOverrides() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ userId, changes, reason }: { userId: string; changes: OverrideChange[]; reason: string }) =>
      unwrap(api.PUT('/rbac/overrides/user/{userId}', { params: { path: { userId } }, body: { changes, reason } })),
    onSuccess: done,
  });
}
