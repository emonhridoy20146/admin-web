import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components, paths } from '@/shared/api/schema';

export type Trends = components['schemas']['BranchTrends'];
export type Recon = components['schemas']['ReconciliationReport'];
export type Mismatch = NonNullable<Recon['mismatches']>[number];
export type ExportBody = NonNullable<paths['/reports/exports']['post']['requestBody']>['content']['application/json'];
export type ExportType = ExportBody['type'];
export type ExportFormat = ExportBody['format'];
export type Granularity = NonNullable<Trends['granularity']>;

export function useTrends(from: string, to: string, granularity: Granularity) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['reports', 'trends', { branchId, from, to, granularity }],
    queryFn: () => unwrap(api.GET('/reports/branch-trends', { params: { query: { branchId, from, to, granularity } } })),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useReconciliation(date: string, enabled: boolean) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['reports', 'reconciliation', { branchId, date }],
    queryFn: () => unwrap(api.GET('/reports/reconciliation', { params: { query: { branchId, date } } })),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  });
}

export function useCreateExport() {
  return useMutation({ mutationFn: (body: ExportBody) => unwrap(api.POST('/reports/exports', { body })) });
}

/** The worker builds the file within about a minute; ask every 3 s until it is ready or failed. */
export function useExportJob(id: string | null) {
  return useQuery({
    queryKey: ['reports', 'export', id],
    queryFn: () => unwrap(api.GET('/reports/exports/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'ready' || q.state.data?.status === 'failed' ? false : 3000),
    // the download link lives 5 minutes; do not serve an old one from cache
    staleTime: 0,
    gcTime: 0,
  });
}
