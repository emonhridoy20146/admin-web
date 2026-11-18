import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useCan, useSession } from '@/shared/auth/session';
import { useBranchId } from '@/shared/lib/ui-store';
import { EV, useInvalidateOn } from '@/shared/feature/events';

const BRANCH_EVENTS = [EV.branchChanged];
const BRANCH_KEYS = [['shell', 'branches']];

export function useBranches() {
  const authed = useSession((s) => s.status === 'authenticated');
  useInvalidateOn(BRANCH_EVENTS, BRANCH_KEYS);
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

/**
 * /auth/me flags are global for a super admin. When one branch is selected, read that branch's effective flags
 * (contract 1.3.0, needs flag.manage) so a module switched OFF for the branch is hidden while viewing it.
 */
export function useBranchFlags() {
  const authed = useSession((s) => s.status === 'authenticated');
  const allowed = useCan('flag.manage');
  const branchId = useBranchId();
  const enabled = authed && allowed && !!branchId;
  const q = useQuery({
    queryKey: ['me', 'branch-flags', branchId],
    queryFn: () => unwrap(api.GET('/feature-flags/effective', { params: { query: { branchId: branchId! } } })),
    staleTime: 5 * 60_000,
    enabled,
  });
  const flags = enabled && q.data?.branchId === branchId ? (q.data?.flags ?? null) : null;
  useEffect(() => {
    useSession.getState().setBranchFlags(flags);
  }, [flags]);
}

export function useSearch(q: string) {
  return useQuery({ queryKey: ['shell', 'search', q], queryFn: () => unwrap(api.GET('/search', { params: { query: { q } } })), enabled: q.trim().length >= 2, staleTime: 30_000 });
}
