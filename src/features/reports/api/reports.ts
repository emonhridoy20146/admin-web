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

export type DataQuality = components['schemas']['DataQualitySummary'];
export type DataQualityItem = components['schemas']['DataQualityItem'];
export type DataQualityIssue = components['schemas']['DataQualityIssue'];
export type Leaderboard = components['schemas']['Leaderboard'];
export type LeaderboardRow = components['schemas']['LeaderboardRow'];
export type LeaderMetric = NonNullable<NonNullable<paths['/reports/leaderboard']['get']['parameters']['query']>['metric']>;
export type LeaderPeriod = NonNullable<NonNullable<paths['/reports/leaderboard']['get']['parameters']['query']>['period']>;

/** FR-CUS-009: issue counts per branch in scope. */
export function useDataQuality() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['reports', 'data-quality', { branchId }],
    queryFn: () => unwrap(api.GET('/reports/data-quality', { params: { query: { branchId } } })),
    staleTime: 5 * 60_000,
  });
}

/** The customers behind one issue, server-paged. */
export function useDataQualityItems(issue: DataQualityIssue | undefined, cursor: string | undefined, limit: number) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['reports', 'data-quality-items', { branchId, issue, cursor, limit }],
    queryFn: async () => {
      const r = await unwrap(api.GET('/reports/data-quality/items', { params: { query: { branchId, issue: issue!, cursor, limit } } }));
      return { items: r.items ?? [], nextCursor: r.nextCursor ?? null };
    },
    enabled: !!issue,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** FR-REP-005: ranked staff for a day or a month by one measure; ties share a rank (server rules). */
export function useLeaderboard(period: LeaderPeriod, date: string, metric: LeaderMetric) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['reports', 'leaderboard', { branchId, period, date, metric }],
    queryFn: () => unwrap(api.GET('/reports/leaderboard', { params: { query: { branchId, period, date, metric } } })),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
