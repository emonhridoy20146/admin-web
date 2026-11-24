import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { useCan, useSession } from '@/shared/auth/session';
import { emit, EV } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type Request = components['schemas']['Request'];
export type RequestStatus = components['schemas']['RequestStatus'];
export type RequestTimelineEntry = components['schemas']['RequestTimelineEntry'];
export type RequestCreate = components['schemas']['RequestCreate'];
export type RequestForward = components['schemas']['RequestForward'];
export type RequestAssign = components['schemas']['RequestAssign'];
export type RequestQuery = NonNullable<operations['listRequests']['parameters']['query']>;
export type RequestCounts = components['schemas']['RequestPage']['counts'];

/** FR-W-070: requests in scope, newest first, with `total` and counts per status for the same filters. */
export function useRequests(params: Omit<RequestQuery, 'branchId'>, opts: { enabled?: boolean } = {}) {
  const branchId = useBranchId();
  const query: RequestQuery = { ...params, branchId };
  return useQuery({
    queryKey: ['requests', 'list', query],
    queryFn: () => unwrap(api.GET('/requests', { params: { query } })),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: 60_000,
    enabled: opts.enabled ?? true,
  });
}

/** How many requests a tab holds (one row asked for; the server's `total` is the count). */
export function useRequestTotal(params: Omit<RequestQuery, 'branchId' | 'limit' | 'cursor'>, enabled: boolean) {
  const branchId = useBranchId();
  const query: RequestQuery = { ...params, branchId, limit: 1 };
  const q = useQuery({
    queryKey: ['requests', 'total', query],
    queryFn: () => unwrap(api.GET('/requests', { params: { query } })),
    staleTime: 15_000,
    refetchInterval: 60_000,
    enabled,
  });
  return q.data?.total;
}

/** One request with its full timeline (the list rows carry it too; this keeps an open drawer fresh). */
export function useRequest(id: string | null) {
  return useQuery({
    queryKey: ['requests', 'one', id],
    queryFn: () => unwrap(api.GET('/requests/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
    staleTime: 10_000,
  });
}

/** Nav badge: requests waiting in the queue I work and not finished (none when I work no queue). */
export function useRequestBadge(): number | undefined {
  const branchId = useBranchId();
  const view = useCan('request.view');
  const manage = useCan('request.manage');
  const important = useCan('request.important.manage');
  const authed = useSession((s) => s.status === 'authenticated');
  const queue = important ? 'super_admin' : manage ? 'area_manager' : null;
  const q = useQuery({
    queryKey: ['requests', 'badge', branchId, queue],
    queryFn: () => unwrap(api.GET('/requests', { params: { query: { branchId, queue: queue!, status: ['open', 'in_progress', 'forwarded', 'reopened'], limit: 1 } } })),
    enabled: view && authed && !!queue,
    staleTime: 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  return q.data?.total;
}

/** People a request can be forwarded or assigned to: active users of every role but viewer (the server checks they hold request.create or request.manage). */
export function useRequestPeople(enabled: boolean) {
  return useQuery({
    queryKey: ['requests', 'people'],
    queryFn: async () => ((await unwrap(api.GET('/users', { params: { query: { active: true, limit: 100 } } }))).items ?? []).filter((u) => u.role !== 'viewer'),
    staleTime: 5 * 60_000,
    enabled,
  });
}

function useDone() {
  const qc = useQueryClient();
  return (r?: Request) => {
    if (r) qc.setQueryData(['requests', 'one', r.id], r);
    void qc.invalidateQueries({ queryKey: ['requests'] });
    emit(EV.requestChanged);
  };
}

/** None of these is optimistic: the server records who did what and notifies the people involved. */
export function useCreateRequest() {
  const done = useDone();
  return useMutation({ mutationFn: (body: RequestCreate) => unwrap(api.POST('/requests', { body })), onSuccess: done });
}

export function useRequestAction() {
  const done = useDone();
  return useMutation({
    mutationFn: async (a: { id: string } & (
      | { kind: 'comment'; text: string; clientId: string }
      | { kind: 'forward'; body: RequestForward }
      | { kind: 'assign'; body: RequestAssign }
      | { kind: 'resolve' | 'reopen'; note: string }
      | { kind: 'close'; note?: string }
    )) => {
      const path = { id: a.id };
      switch (a.kind) {
        case 'comment':
          return unwrap(api.POST('/requests/{id}/comment', { params: { path }, body: { clientId: a.clientId, text: a.text } }));
        case 'forward':
          return unwrap(api.POST('/requests/{id}/forward', { params: { path }, body: a.body }));
        case 'assign':
          return unwrap(api.POST('/requests/{id}/assign', { params: { path }, body: a.body }));
        case 'resolve':
          return unwrap(api.POST('/requests/{id}/resolve', { params: { path }, body: { note: a.note } }));
        case 'reopen':
          return unwrap(api.POST('/requests/{id}/reopen', { params: { path }, body: { note: a.note } }));
        case 'close':
          return unwrap(api.POST('/requests/{id}/close', { params: { path }, body: a.note ? { note: a.note } : {} }));
      }
    },
    onSuccess: done,
  });
}
