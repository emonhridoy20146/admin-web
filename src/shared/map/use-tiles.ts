import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';

/** Tile layer config from field-api `/meta/app-config` (03 §map): switching provider needs no rebuild. */
export function useTileProvider() {
  return useQuery({
    queryKey: ['meta', 'app-config'],
    queryFn: () => unwrap(api.GET('/meta/app-config')),
    staleTime: 60 * 60_000,
    select: (d) => d.tileProvider ?? null,
  });
}
