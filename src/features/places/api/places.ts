import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useCan, useSession } from '@/shared/auth/session';
import { emit, EV } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type Place = components['schemas']['Place'];
export type PlaceIcon = components['schemas']['PlaceIcon'];
export type PlaceEvent = components['schemas']['PlaceEvent'];
export type PlaceCreate = components['schemas']['PlaceCreate'];
export type PlaceUpdate = components['schemas']['PlaceUpdate'];
export type PlaceQuery = NonNullable<operations['listPlaces']['parameters']['query']>;

/** FR-PLC-001: every place (shared by the whole area, not by branch: owner decision 2026-11-22, contract 1.42.0), newest first. */
export function usePlaces(params: Omit<PlaceQuery, 'branchId'>, enabled = true) {
  const query: PlaceQuery = { ...params };
  return useQuery({
    queryKey: ['places', 'list', query],
    queryFn: async () => {
      const r = await unwrap(api.GET('/places', { params: { query } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null };
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** One place, for a link (inbox, notification) to a place that is not in the loaded list. Out of scope answers 404. */
export function usePlace(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['places', 'one', id],
    queryFn: () => unwrap(api.GET('/places/{id}', { params: { path: { id: id! } } })),
    enabled: !!id && enabled,
    staleTime: 15_000,
  });
}

/** FR-PLC-005: the office queue of every branch (contract 1.42.0: places are shared by the whole area), oldest request first. */
export function useMoveRequests() {
  return useQuery({
    queryKey: ['places', 'moves'],
    queryFn: async () => (await unwrap(api.GET('/places/move-requests'))).items ?? [],
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

/** Nav badge: open move requests. Polls every minute while the tab is visible. */
export function useMoveRequestBadge(): number | undefined {
  const allowed = useCan('place.manage');
  const authed = useSession((s) => s.status === 'authenticated');
  const q = useQuery({
    queryKey: ['places', 'moves'],
    queryFn: async () => (await unwrap(api.GET('/places/move-requests'))).items ?? [],
    enabled: allowed && authed,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  return q.data?.length;
}

function useDone() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['places'] });
    void qc.invalidateQueries({ queryKey: ['inbox'] });
    emit(EV.placeChanged);
  };
}

/** Not optimistic: every device of the branch gets the change from the server, so the panel shows what the server kept. */
export function useCreatePlace() {
  const done = useDone();
  return useMutation({ mutationFn: (body: PlaceCreate) => unwrap(api.POST('/places', { body })), onSuccess: done });
}

export function useEditPlace() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ id, body, version }: { id: string; body: PlaceUpdate; version: number }) =>
      unwrap(api.PATCH('/places/{id}', { params: { path: { id }, header: { 'If-Match': `W/"${version}"` } }, body })),
    onSuccess: done,
  });
}

export function useDeletePlace() {
  const done = useDone();
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => unwrap(api.DELETE('/places/{id}', { params: { path: { id }, query: reason ? { reason } : {} } })), onSuccess: done });
}

export function useDecideMove() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'approve' | 'reject'; reason?: string }) =>
      unwrap(api.POST('/places/{id}/move-request/decision', { params: { path: { id } }, body: { decision, ...(reason ? { reason } : {}) } })),
    onSuccess: done,
  });
}
