import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components, operations } from '@/shared/api/schema';

export type User = components['schemas']['User'];
export type UserCreate = components['schemas']['UserCreate'];
export type UserUpdate = components['schemas']['UserUpdate'];
export type Role = components['schemas']['Role'];
export type UserQuery = NonNullable<operations['listUsers']['parameters']['query']>;

export function useUsers(params: Omit<UserQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query = { ...params, branchId };
  return useQuery({
    queryKey: ['admin-users', 'list', query],
    queryFn: () => unwrap(api.GET('/users', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: ['admin-users', 'detail', id],
    queryFn: () => unwrap(api.GET('/users/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['admin-users'] });
}

export function useCreateUser() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (body: UserCreate) => unwrap(api.POST('/users', { body })),
    onSuccess: done,
  });
}

/** Optimistic concurrency: If-Match carries the version the form was opened with (412 → reload). */
export function useUpdateUser() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version, body }: { id: string; version?: number; body: UserUpdate }) =>
      unwrap(
        api.PATCH('/users/{id}', {
          params: { path: { id }, header: version != null ? { 'If-Match': `"${version}"` } : {} },
          body,
        }),
      ),
    onSuccess: done,
  });
}

export function useSetActive() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: ({ id, active, reason }: { id: string; active: boolean; reason?: string }) =>
      active
        ? unwrap(api.POST('/users/{id}/activate', { params: { path: { id } } }))
        : unwrap(
            api.POST('/users/{id}/deactivate', { params: { path: { id } }, body: { reason: reason ?? '' } }),
          ),
    onSuccess: done,
  });
}

export function useResetPassword() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/users/{id}/reset-password', { params: { path: { id } } })),
    onSuccess: done,
  });
}
