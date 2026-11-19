import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { useCan, useSession } from '@/shared/auth/session';
import { emit, EV } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type Task = components['schemas']['Task'];
export type TaskStatus = components['schemas']['TaskStatus'];
export type TaskCounts = components['schemas']['TaskCounts'];
export type TaskEvent = components['schemas']['TaskEvent'];
export type TaskCreate = components['schemas']['TaskCreate'];
export type TaskEdit = NonNullable<operations['editTask']['requestBody']>['content']['application/json'];
export type TaskQuery = NonNullable<operations['listTasks']['parameters']['query']>;

/** FR-TASK-004: tasks in scope, newest first, with a count per state for the tabs. */
export function useTasks(params: Omit<TaskQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query: TaskQuery = { ...params, branchId };
  return useQuery({
    queryKey: ['tasks', 'list', query],
    queryFn: async () => {
      const r = await unwrap(api.GET('/tasks', { params: { query } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null, counts: r.counts };
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

/** One task, for a link (from the inbox or a notification) to a task that is not on the current page. Out of scope answers 404. */
export function useTask(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', 'one', id],
    queryFn: () => unwrap(api.GET('/tasks/{id}', { params: { path: { id: id! } } })),
    enabled: !!id && enabled,
    staleTime: 15_000,
  });
}

/** Nav badge: requests waiting for verification. Polls every minute and pauses when the tab is hidden. */
export function useTaskBadge(): number | undefined {
  const branchId = useBranchId();
  const allowed = useCan('task.view');
  const authed = useSession((s) => s.status === 'authenticated');
  const q = useQuery({
    queryKey: ['tasks', 'badge', branchId],
    queryFn: () => unwrap(api.GET('/tasks', { params: { query: { branchId, status: 'resolve_requested', limit: 1 } } })),
    enabled: allowed && authed,
    staleTime: 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  return q.data?.counts.resolve_requested;
}

/** Active field staff of one branch: the people a task can be given to (multi-branch staff appear in each of their branches). */
export function useStaffOf(branchId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'staff', branchId ?? 'all'],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId, role: 'field_staff', active: true, limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}

function useDone() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    void qc.invalidateQueries({ queryKey: ['inbox'] });
    emit(EV.taskChanged);
  };
}

/** None of these is optimistic: the staff member is notified at once and the server decides what state the task is in. */
export function useCreateTask() {
  const done = useDone();
  return useMutation({ mutationFn: (body: TaskCreate) => unwrap(api.POST('/tasks', { body })), onSuccess: done });
}

export function useEditTask() {
  const done = useDone();
  return useMutation({ mutationFn: ({ id, body }: { id: string; body: TaskEdit }) => unwrap(api.PATCH('/tasks/{id}', { params: { path: { id } }, body })), onSuccess: done });
}

export function useVerifyTask() {
  const done = useDone();
  return useMutation({ mutationFn: ({ id, note }: { id: string; note?: string }) => unwrap(api.POST('/tasks/{id}/verify', { params: { path: { id } }, body: note ? { note } : {} })), onSuccess: done });
}

export function useRejectTask() {
  const done = useDone();
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => unwrap(api.POST('/tasks/{id}/reject', { params: { path: { id } }, body: { reason } })), onSuccess: done });
}

export function useCancelTask() {
  const done = useDone();
  return useMutation({ mutationFn: ({ id, note }: { id: string; note?: string }) => unwrap(api.POST('/tasks/{id}/cancel', { params: { path: { id } }, body: note ? { note } : {} })), onSuccess: done });
}
