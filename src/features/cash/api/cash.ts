import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { EV, useInvalidateOn } from '@/shared/feature/events';
import type { components } from '@/shared/api/schema';

export type CashPosition = components['schemas']['CashPosition'];
export type Deposit = components['schemas']['Deposit'];
export type DepositStatus = NonNullable<Deposit['status']>;
export type CashLine = components['schemas']['CashInHandItem'];
export type DepositCoverage = components['schemas']['DepositCoverage'];
export type DepositLine = DepositCoverage['items'][number];

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
  useInvalidateOn([EV.collectionVoided, EV.collectionResolved], [['cash']]);
  return useQuery({
    queryKey: ['cash', 'in-hand', userId],
    queryFn: () => unwrap(api.GET('/cash/positions/{id}/collections', { params: { path: { id: userId! } } })),
    enabled: !!userId,
  });
}

/**
 * FR-CASH-008 (contract 1.30.0): the collections one deposit covered. FR-CASH-010 (1.35.0): for a `submitted` deposit,
 * every collection it handed in, whole, with method, ERP status and ERP receipt number.
 */
export function useDepositCollections(depositId: string | null) {
  useInvalidateOn([EV.collectionVoided, EV.collectionResolved], [['cash']]);
  return useQuery({
    queryKey: ['cash', 'deposit-collections', depositId],
    queryFn: () => unwrap(api.GET('/cash/deposits/{id}/collections', { params: { path: { id: depositId! } } })),
    enabled: !!depositId,
  });
}

/**
 * Deposits are read-only from 1.35.0 (ADR-049): staff deposit everything in hand at once and the deposit sends it to the
 * ERP; verify, reject and delete answer 409 DEPOSIT_FINAL, so the panel has no hooks for them.
 */
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
