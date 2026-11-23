import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import type { components } from '@/shared/api/schema';
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

/**
 * FR-ERP-007 "Sync from ERP" (contract 1.17.0, ADR-W19): pulls what changed in the ERP now. One call stops after about
 * 40 s with `partial: true`; this calls again until `partial` is false (contract 1.44.0: after a change of
 * `erp.customerScope` the pull starts over for every branch and can take many rounds), reporting how many customers
 * came. `skipped` (ERP rows left out) is added up over the rounds; `failedBranches` is the last round's (a failed
 * branch is tried again by the next call). Everything on screen is refetched afterwards. Never optimistic.
 */
const ERP_AUTO_SYNC_INTERVAL = 2 * 60_000;
const ERP_SYNC_KEY = ['shell', 'erp-sync'];

/** Runs the ERP sync every 2 minutes (owner decision: 1 minute was too much load on the live ERP). A tick is skipped while a sync (automatic or from the button) is still running. */
export function useAutoErpSync() {
  const allowed = useCan('erp.sync');
  const qc = useQueryClient();
  const sync = useErpSync();
  useEffect(() => {
    if (!allowed) return;
    const id = setInterval(() => {
      if (qc.isMutating({ mutationKey: ERP_SYNC_KEY }) === 0) sync.mutate(undefined);
    }, ERP_AUTO_SYNC_INTERVAL);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);
}

/** Safety stop only (about 3 h of 40 s rounds): the loop otherwise runs until the server says `partial: false`. */
export const ERP_SYNC_MAX_ROUNDS = 300;

export interface ErpSyncSummary {
  customers: number;
  partial: boolean;
  finishedAt: string;
  /** ERP customer rows the server could not read and left out, over all rounds (1.44.0) */
  skipped: number;
  /** ERP branches whose pull failed in the last round (1.44.0) */
  failedBranches: number;
  rounds: number;
}

type ErpSyncResult = components['schemas']['ErpSyncResult'];

/** Calls `call` until the server says the pull is done; adds up customers and skipped rows. */
export async function runErpSync(call: () => Promise<ErpSyncResult>, onProgress?: (customers: number) => void, maxRounds = ERP_SYNC_MAX_ROUNDS): Promise<ErpSyncSummary> {
  let customers = 0;
  let skipped = 0;
  let rounds = 0;
  let last: ErpSyncResult;
  do {
    last = await call();
    customers += last.customers ?? 0;
    skipped += last.skipped ?? 0;
    rounds += 1;
    onProgress?.(customers);
  } while (last.partial && rounds < maxRounds);
  return { customers, partial: !!last.partial, finishedAt: last.finishedAt ?? '', skipped, failedBranches: last.failedBranches ?? 0, rounds };
}

export function useErpSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ERP_SYNC_KEY,
    mutationFn: (onProgress?: (customers: number) => void) => runErpSync(() => unwrap(api.POST('/system/erp-sync')), onProgress),
    onSettled: () => void qc.invalidateQueries(),
  });
}
