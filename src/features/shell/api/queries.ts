import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useSession } from '@/shared/auth/session';
import { EV, useInvalidateOn } from '@/shared/feature/events';

export function useBranches() {
  const authed = useSession((s) => s.status === 'authenticated');
  return useQuery({ queryKey: ['shell', 'branches'], queryFn: () => unwrap(api.GET('/branches')), staleTime: 60 * 60_000, enabled: authed });
}

export function useErpStatus() {
  const authed = useSession((s) => s.status === 'authenticated');
  return useQuery({ queryKey: ['shell', 'erp-status'], queryFn: () => unwrap(api.GET('/system/erp-status')), staleTime: 60_000, refetchInterval: 120_000, enabled: authed });
}

const ME_EVENTS = [EV.flagsChanged, EV.permissionsChanged];
const ME_KEYS = [['me']];

/** /auth/me refreshes permissions + flags; refetched when an admin changes either (UI events). */
export function useMe() {
  const authed = useSession((s) => s.status === 'authenticated');
  useInvalidateOn(ME_EVENTS, ME_KEYS);
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const me = await unwrap(api.GET('/auth/me'));
      useSession.getState().setMe(me);
      return me;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    enabled: authed,
  });
}

export function useSearch(q: string) {
  return useQuery({ queryKey: ['shell', 'search', q], queryFn: () => unwrap(api.GET('/search', { params: { query: { q } } })), enabled: q.trim().length >= 2, staleTime: 30_000 });
}
