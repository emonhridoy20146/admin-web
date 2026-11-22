import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useCan } from '@/shared/auth/session';
import type { components } from '@/shared/api/schema';

export type PurgePreview = components['schemas']['MediaPurgePreview'];
export type PurgeResult = components['schemas']['MediaPurgeResult'];

/** FR-W-054 (master FR-MED-003): photos of the months before `before` (default: this month), per month. */
export function usePurgePreview(includeMoneyProofs = false, enabled = true) {
  return useQuery({
    queryKey: ['system', 'photo-purge', { includeMoneyProofs }],
    queryFn: () => unwrap(api.GET('/media/purge/preview', { params: { query: { includeMoneyProofs } } })),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Nav count for "Photo storage": the photos waiting to be deleted, only from the 5th (`suggest`). */
export function usePhotoPurgeBadge(): number | undefined {
  const can = useCan('media.delete');
  const q = usePurgePreview(false, can);
  return q.data?.suggest ? q.data.total.count : undefined;
}

/** One call deletes up to 200 photos; the page repeats until nothing remains (model/photos.ts runPurge). */
export function usePurgeCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { before: string; includeMoneyProofs: boolean; confirmText: string }) => unwrap(api.POST('/media/purge', { body })),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['system', 'photo-purge'] }),
  });
}
