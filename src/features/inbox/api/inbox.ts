import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { useCan, useSession } from '@/shared/auth/session';
import { emit, EV, useInvalidateOn } from '@/shared/feature/events';
import type { components } from '@/shared/api/schema';

export type InboxItem = components['schemas']['InboxItem'];
type Status = 'open' | 'snoozed' | 'resolved';

export function useInbox(status: Status, limit = 50) {
  const branchId = useBranchId();
  useInvalidateOn([EV.collectionResolved, EV.customerTagged], [['inbox']]);
  return useQuery({
    queryKey: ['inbox', 'list', { branchId, status, limit }],
    queryFn: () => unwrap(api.GET('/inbox', { params: { query: { branchId, status, limit } } })),
    staleTime: 0,
    refetchInterval: 60_000,
  });
}

/** Nav/bell badge: open critical + high (03 §3). Polls every 60 s, pauses when the tab is hidden (TanStack default). */
export function useInboxBadge(): number | undefined {
  const branchId = useBranchId();
  const allowed = useCan('inbox.view');
  const authed = useSession((s) => s.status === 'authenticated');
  const q = useQuery({
    queryKey: ['inbox', 'count', branchId],
    queryFn: () => unwrap(api.GET('/inbox', { params: { query: { branchId, status: 'open', limit: 1 } } })),
    enabled: allowed && authed,
    staleTime: 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const c = q.data?.counts;
  return c ? (c.critical ?? 0) + (c.high ?? 0) : undefined;
}

export function useSnooze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/inbox/{id}/snooze', { params: { path: { id } }, body: { until: new Date(Date.now() + 86400_000).toISOString() } })),
    // non-money action → optimistic (FR-W-010)
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['inbox', 'list'] });
      const snaps = qc.getQueriesData<{ items?: InboxItem[] }>({ queryKey: ['inbox', 'list'] });
      snaps.forEach(([k, v]) => v && qc.setQueryData(k, { ...v, items: v.items?.filter((i) => i.id !== id) }));
      return { snaps };
    },
    onError: (_e, _id, ctx) => ctx?.snaps.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      emit(EV.inboxChanged);
    },
  });
}

export function useResolveInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => unwrap(api.POST('/inbox/{id}/resolve', { params: { path: { id } }, body: { reason } })),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      emit(EV.inboxChanged);
    },
  });
}
