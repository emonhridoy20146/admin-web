import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import type { components, operations } from '@/shared/api/schema';

export type Notice = components['schemas']['Broadcast'];
export type Recipients = components['schemas']['BroadcastRecipients'];
export type Recipient = NonNullable<Recipients['items']>[number];
export type NoticeCreate = NonNullable<operations['createBroadcast']['requestBody']>['content']['application/json'];
export type Role = components['schemas']['Role'];

/** FR-NOT-005: notices the sender can see (sent by them or to their branches), newest first, cursor pages. */
export function useNotices(cursor: string | undefined, limit: number) {
  return useQuery({
    queryKey: ['notices', 'list', { cursor, limit }],
    queryFn: async () => {
      const r = await unwrap(api.GET('/broadcasts', { params: { query: { cursor, limit } } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null };
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Everyone a notice went to, not read first (contract 1.12.0). */
export function useRecipients(id: string | null) {
  return useQuery({
    queryKey: ['notices', 'recipients', id],
    queryFn: () => unwrap(api.GET('/broadcasts/{id}/recipients', { params: { path: { id: id! } } })),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Sending reaches every phone in the audience at once and cannot be taken back, so it is never optimistic. */
export function useSendNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NoticeCreate) => unwrap(api.POST('/broadcasts', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notices'] }),
  });
}
