import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { emit, EV, useInvalidateOn } from '@/shared/feature/events';
import type { components } from '@/shared/api/schema';

export type CashPosition = components['schemas']['CashPosition'];
export type Deposit = components['schemas']['Deposit'];
export type DepositStatus = NonNullable<Deposit['status']>;
export type CashLine = components['schemas']['CashInHandItem'];
export type DepositCoverage = components['schemas']['DepositCoverage'];

export function useCashPositions() {
  const branchId = useBranchId();
  useInvalidateOn([EV.collectionVoided, EV.collectionResolved], [['cash']]);
  return useQuery({
    queryKey: ['cash', 'positions', branchId],
    queryFn: () => unwrap(api.GET('/cash/positions', { params: { query: { branchId } } })),
  });
}

/** FR-CASH-007 (contract 1.27.0): the collections behind one collector's cash on hand. */
export function useCashInHand(userId: string | null) {
  useInvalidateOn([EV.collectionVoided, EV.collectionResolved, EV.depositDecided], [['cash']]);
  return useQuery({
    queryKey: ['cash', 'in-hand', userId],
    queryFn: () => unwrap(api.GET('/cash/positions/{id}/collections', { params: { path: { id: userId! } } })),
    enabled: !!userId,
  });
}

/** FR-CASH-008 (contract 1.30.0): the collections one deposit covered. */
export function useDepositCollections(depositId: string | null) {
  useInvalidateOn([EV.collectionVoided, EV.collectionResolved, EV.depositDecided], [['cash']]);
  return useQuery({
    queryKey: ['cash', 'deposit-collections', depositId],
    queryFn: () => unwrap(api.GET('/cash/deposits/{id}/collections', { params: { path: { id: depositId! } } })),
    enabled: !!depositId,
  });
}

export function useDeposits(status: DepositStatus | undefined, cursor?: string, limit = 25) {
  const branchId = useBranchId();
  const query = { branchId, status, cursor, limit };
  return useQuery({
    queryKey: ['cash', 'deposits', query],
    queryFn: async () => {
      const r = await unwrap(api.GET('/cash/deposits', { params: { query } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null };
    },
    placeholderData: keepPreviousData,
  });
}

/** Money actions: not optimistic. */
export function useVerifyDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/cash/deposits/{id}/verify', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ['cash'] });
      emit(EV.depositDecided, { id, decision: 'verified' });
    },
  });
}

export function useRejectDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(api.POST('/cash/deposits/{id}/reject', { params: { path: { id } }, body: { reason } })),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['cash'] });
      emit(EV.depositDecided, { id: v.id, decision: 'rejected' });
    },
  });
}
