import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { emit, EV } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type FeatureFlag = components['schemas']['FeatureFlag'];
export type SetFlagBody = operations['setFlag']['requestBody']['content']['application/json'];

export function useFlags() {
  return useQuery({ queryKey: ['admin-flags', 'list'], queryFn: () => unwrap(api.GET('/feature-flags')) });
}

export function useSetFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, body }: { key: string; body: SetFlagBody }) => unwrap(api.PUT('/feature-flags/{key}', { params: { path: { key } }, body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-flags'] });
      emit(EV.flagsChanged);
    },
  });
}
