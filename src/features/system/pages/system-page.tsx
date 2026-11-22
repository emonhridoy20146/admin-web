'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, RefreshCw, Smartphone, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useGate } from '@/shared/feature/useGate';
import { formatDateTime, formatDuration, formatNumber, formatRelative } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/page';
import { Card, CardHeader } from '@/shared/ui/card';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { useErp, useHealth, useSyncHealth, type SyncState } from '../api/system';
import { erpLevel, sortSync, syncCounts, syncLevel, type Level } from '../model/system';

const TONE: Record<Level, 'success' | 'warning' | 'danger'> = { ok: 'success', warn: 'warning', bad: 'danger' };
const ICON: Record<Level, LucideIcon> = { ok: CircleCheck, warn: TriangleAlert, bad: CircleAlert };

function LevelBadge({ level }: { level: Level }) {
  const { t } = useTranslation('system');
  return <Badge tone={TONE[level]} icon={ICON[level]}>{t(`level.${level}`)}</Badge>;
}

function Row({ label, children, tone }: { label: string; children: React.ReactNode; tone?: Level }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-fg-secondary">{label}</dt>
      <dd className={cn('tabular text-end text-sm font-medium', tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warning' : 'text-fg')}>{children}</dd>
    </div>
  );
}

export function SystemPage() {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation();
  useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const gate = useGate();
  const canCollections = gate.can('collection.view') && gate.flag('module.collections');
  const health = useHealth();
  const erp = useErp();
  const sync = useSyncHealth();
  const busy = health.isFetching || erp.isFetching || sync.isFetching;

  const rows = useMemo(() => sortSync(sync.data ?? []), [sync.data]);
  const n = useMemo(() => syncCounts(sync.data), [sync.data]);
  const e = erp.data;
  const eLevel = erpLevel(e);
  const apiLevel: Level = health.error ? 'bad' : health.data?.status === 'ok' ? 'ok' : 'warn';
  const part = (v: string | undefined) => (v === 'ok' ? t('api.ok') : (v ?? '—'));

  const columns: Column<SyncState>[] = [
    { id: 'staff', header: t('sync.staff'), priority: 1, mobile: 'title', cell: (r) => <span className="font-medium text-fg">{r.userName || t('sync.unknown')}</span> },
    { id: 'state', header: t('sync.state'), priority: 1, mobile: 'badges', cell: (r) => <LevelBadge level={syncLevel(r)} /> },
    { id: 'pending', header: t('sync.pending'), priority: 1, align: 'end', mobile: 'amount', cell: (r) => <span className={cn('tabular font-medium', (r.pendingReported ?? 0) > 0 ? 'text-warning' : 'text-fg-secondary')}>{formatNumber(r.pendingReported ?? 0)}</span> },
    { id: 'push', header: t('sync.push'), priority: 2, mobile: 'meta', cell: (r) => <span className="tabular text-fg-secondary">{r.lastPushAt ? formatRelative(r.lastPushAt) : t('sync.never')}</span> },
    { id: 'pull', header: t('sync.pull'), priority: 3, cell: (r) => <span className="tabular text-fg-secondary">{r.lastPullAt ? formatRelative(r.lastPullAt) : t('sync.never')}</span> },
    { id: 'app', header: t('sync.app'), priority: 4, cell: (r) => <span className="font-mono text-sm text-fg-secondary">{r.appVersion ?? '—'}</span> },
    { id: 'error', header: t('sync.error'), priority: 3, mobile: 'subtitle', cell: (r) => (r.lastError ? <span className="break-words font-mono text-xs text-danger">{r.lastError}</span> : <span className="text-fg-tertiary">—</span>) },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={() => (void health.refetch(), void erp.refetch(), void sync.refetch())} aria-busy={busy}>
            <RefreshCw className={cn('size-4', busy && 'animate-spin')} aria-hidden />
            {tc('actions.refresh')}
          </Button>
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('api.title')} actions={health.isLoading ? undefined : <LevelBadge level={apiLevel} />} />
          {health.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
          ) : (
            <dl className="divide-y divide-line">
              <Row label={t('api.status')} tone={apiLevel === 'ok' ? undefined : apiLevel}>{health.error ? t('api.down') : health.data?.status === 'ok' ? t('api.ok') : t('api.degraded')}</Row>
              <Row label={t('api.version')}><span className="font-mono">{health.data?.version ?? '—'}</span></Row>
              <Row label={t('api.database')} tone={health.data && health.data.mongo !== 'ok' ? 'bad' : undefined}>{part(health.data?.mongo)}</Row>
              <Row label={t('api.erp')} tone={health.data && health.data.erp !== 'ok' ? 'warn' : undefined}>{part(health.data?.erp)}</Row>
              <Row label={t('api.photos')} tone={health.data && health.data.cloudStorage !== 'cloudinary' ? 'warn' : undefined}>
                {health.data?.cloudStorage === 'cloudinary' ? t('photos.store.cloudinary') : t('photos.store.fallback')}
              </Row>
            </dl>
          )}
        </Card>

        <Card>
          <CardHeader title={t('erp.title')} actions={erp.isLoading ? undefined : <LevelBadge level={eLevel} />} />
          {erp.error ? <div className="p-4"><ErrorBanner error={erp.error} onRetry={() => erp.refetch()} /></div> : null}
          {erp.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
          ) : e ? (
            <dl className="divide-y divide-line">
              <Row label={t('erp.mode')} tone={e.mode === 'record_only' ? 'warn' : undefined}>{t(`erp.modes.${e.mode ?? 'live'}`)}</Row>
              <Row label={t('erp.lastSuccess')}>{e.lastSuccessAt ? formatDateTime(e.lastSuccessAt) : t('erp.never')}</Row>
              <Row label={t('erp.lag')} tone={(e.lagSec ?? 0) >= 3600 ? 'bad' : (e.lagSec ?? 0) >= 900 ? 'warn' : undefined}>{formatDuration(Math.round((e.lagSec ?? 0) / 60))}</Row>
              <Row label={t('erp.circuit')} tone={e.circuit === 'open' ? 'bad' : e.circuit === 'half_open' ? 'warn' : undefined}>{t(`erp.circuits.${e.circuit ?? 'closed'}`)}</Row>
              <Row label={t('erp.failures')} tone={(e.consecutiveFailures ?? 0) > 0 ? 'warn' : undefined}>{formatNumber(e.consecutiveFailures ?? 0)}</Row>
              <Row label={t('erp.pending')}>{formatNumber(e.outboxPending ?? 0)}</Row>
              <Row label={t('erp.failed')} tone={(e.outboxFailed ?? 0) > 0 ? 'bad' : undefined}>
                {formatNumber(e.outboxFailed ?? 0)}
                {(e.outboxFailed ?? 0) > 0 && canCollections ? <Link href="/collections/?status=posting_failed" className="ms-3 font-medium text-primary hover:underline">{t('erp.seeFailed')}</Link> : null}
              </Row>
            </dl>
          ) : null}
        </Card>
      </div>

      <h2 className="mb-1 text-md font-semibold text-fg">{t('sync.title')}</h2>
      <p className="mb-3 text-sm text-fg-secondary" aria-live="polite">
        {sync.data ? t('sync.summary', { bad: formatNumber(n.bad), warn: formatNumber(n.warn), ok: formatNumber(n.ok), pending: formatNumber(n.pending) }) : ''}
      </p>
      <DataTable
        tableId="sync-health"
        caption={t('sync.title')}
        columns={columns}
        rows={sync.isLoading ? undefined : rows}
        rowKey={(r) => `${r.userId}:${r.deviceId}`}
        loading={sync.isLoading}
        error={sync.error}
        onRetry={() => sync.refetch()}
        empty={<EmptyState icon={Smartphone} title={t('sync.empty')} />}
      />
    </>
  );
}
