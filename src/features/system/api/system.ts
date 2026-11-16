import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components } from '@/shared/api/schema';

export type ErpStatus = components['schemas']['ErpStatus'];
export type SyncState = components['schemas']['DeviceSyncState'];

const REFRESH_MS = 60_000;

export function useHealth() {
  return useQuery({ queryKey: ['system', 'health'], queryFn: () => unwrap(api.GET('/system/health')), refetchInterval: REFRESH_MS });
}

/** FR-ERP-003/004: state of the link to the ERP and of the posting queue. */
export function useErp() {
  return useQuery({ queryKey: ['system', 'erp-status'], queryFn: () => unwrap(api.GET('/system/erp-status')), refetchInterval: REFRESH_MS });
}

/** FR-SYNC-005: what each phone last pulled and pushed, and what it still holds. */
export function useSyncHealth() {
  const branchId = useBranchId();
  return useQuery({ queryKey: ['system', 'sync-health', { branchId }], queryFn: () => unwrap(api.GET('/system/sync-health', { params: { query: { branchId } } })), refetchInterval: REFRESH_MS });
}
