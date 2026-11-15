import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components, operations } from '@/shared/api/schema';

export type AuditEntry = components['schemas']['AuditEntry'];
export type AuditQuery = NonNullable<operations['listAudit']['parameters']['query']>;

export function useAudit(params: Omit<AuditQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query = { ...params, branchId };
  return useQuery({ queryKey: ['audit', 'list', query], queryFn: () => unwrap(api.GET('/audit', { params: { query } })), placeholderData: keepPreviousData });
}
