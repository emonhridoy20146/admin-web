import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { useCan, useSession } from '@/shared/auth/session';
import type { components } from '@/shared/api/schema';

export type ActivityItem = components['schemas']['ActivityItem'];
export type ActivityType = ActivityItem['type'];

/** FR-W-046 (master FR-ACT-001): the staff activity feed, newest first, paged by cursor; polls every 60 s. */
export function useActivity(type: ActivityType | undefined, userId: string | undefined) {
  const branchId = useBranchId();
  return useInfiniteQuery({
    queryKey: ['activity', 'list', { branchId, type, userId }],
    queryFn: ({ pageParam }) => unwrap(api.GET('/activity', { params: { query: { branchId, type, userId, limit: 40, ...(pageParam ? { cursor: pageParam } : {}) } } })),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 60_000,
  });
}

/** The bell: what is new since I last looked. Polls every 60 s while the tab is visible. */
export function useActivityBadge(): number | undefined {
  const branchId = useBranchId();
  const allowed = useCan('activity.view');
  const authed = useSession((s) => s.status === 'authenticated');
  const q = useQuery({
    queryKey: ['activity', 'count', branchId],
    queryFn: () => unwrap(api.GET('/activity', { params: { query: { branchId, limit: 1 } } })),
    enabled: allowed && authed,
    staleTime: 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  return q.data?.unseen;
}

export function useMarkActivitySeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/activity/seen')),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['activity', 'count'] }),
  });
}
