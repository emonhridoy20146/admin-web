import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components, operations } from '@/shared/api/schema';

export type Session = components['schemas']['CoworkSession'];
export type Member = components['schemas']['CoworkMember'];
export type SessionQuery = NonNullable<operations['listCoworkSessions']['parameters']['query']>;
export type SessionVisit = components['schemas']['VisitListItem'];

/** FR-CW-004: co-work sessions in scope, newest first, with how many joint visits each produced. */
export function useSessions(params: Omit<SessionQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query: SessionQuery = { ...params, branchId };
  return useQuery({
    queryKey: ['cowork', 'sessions', query],
    queryFn: async () => {
      const r = await unwrap(api.GET('/cowork/sessions', { params: { query } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null };
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** One session, for a deep link that is not on the current page of the list (out of scope answers 404). */
export function useSession(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['cowork', 'session', id],
    queryFn: () => unwrap(api.GET('/cowork/sessions/{id}', { params: { path: { id: id! } } })),
    enabled: !!id && enabled,
    staleTime: 30_000,
  });
}

/** The joint visits recorded in one session (GET /visits?coWorkSessionId=). */
export function useSessionVisits(id: string | null) {
  return useQuery({
    queryKey: ['cowork', 'visits', id],
    queryFn: async () => (await unwrap(api.GET('/visits', { params: { query: { coWorkSessionId: id!, limit: 100 } } }))).items ?? [],
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Field staff of the selected branch, for the "who" filter. */
export function useFieldStaff() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['cowork', 'staff', branchId],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId, role: 'field_staff', active: true, limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}
