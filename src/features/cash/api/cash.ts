import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { emit, EV, useInvalidateOn } from '@/shared/feature/events';
import type { components } from '@/shared/api/schema';

export type CashPosition = components['schemas']['CashPosition'];
export type Deposit = components['schemas']['Deposit'];
export type DepositStatus = NonNullable<Deposit['status']>;

export function useCashPositions() {
  const branchId = useBranchId();
  useInvalidateOn([EV.collectionVoided, EV.collectionResolved], [['cash']]);
  return useQuery({
    queryKey: ['cash', 'positions', branchId],
    queryFn: () => unwrap(api.GET('/cash/positions', { params: { query: { branchId } } })),
  });
}

/**
 * Contract gap (reported): GET /cash/deposits declares no response schema. Read as the standard list envelope
 * ({ items: Deposit[], nextCursor }); Deposit itself is typed by the contract.
 */
export function useDeposits(status: DepositStatus | undefined, cursor?: string, limit = 25) {
  const branchId = useBranchId();
  const query = { branchId, status, cursor, limit };
  return useQuery({
    queryKey: ['cash', 'deposits', query],
    queryFn: async () =>
      (await unwrap(api.GET('/cash/deposits', { params: { query } }))) as unknown as {
        items: Deposit[];
        nextCursor: string | null;
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
