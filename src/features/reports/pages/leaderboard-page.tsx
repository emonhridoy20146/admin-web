'use client';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Crown, Info, Medal, Trophy } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatMoney, formatMonth, formatNumber, formatPercent } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/form';
import { Avatar, Segmented } from '@/shared/ui/primitives';
import { MoneyText } from '@/shared/ui/money';
import { PrintButton, PrintOnly } from '@/shared/ui/print';
import { useLeaderboard, type LeaderboardRow, type LeaderMetric } from '../api/reports';
import { CollectionBoard } from '../components/collection-board';
import { BOARDS, creditDecimals, METRICS, PERIODS, periodDate, sharedRanks, splitRanked } from '../model/leaderboard';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const PODIUM = [
  { icon: Crown, cls: 'bg-st-due-today-bg text-st-due-today' },
  { icon: Medal, cls: 'bg-surface-hover text-fg-secondary' },
  { icon: Medal, cls: 'bg-st-promised-bg text-st-promised' },
];

/** FR-REP-005: field staff ranked for a day or a month by one measure. Ranking rules (ties, present days) are the server's. */
export function LeaderboardPage() {
  const { t } = useTranslation('reports');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const today = todayDhaka();
  const period = oneOf(url.get('period'), PERIODS, 'month');
  const board = oneOf(url.get('board'), BOARDS, 'ranking');
  const metric = oneOf(url.get('metric'), METRICS, 'collected');
  const raw = url.get('date');
  const date = period === 'month' ? (ISO_MONTH.test(raw) ? raw : today.slice(0, 7)) : ISO_DAY.test(raw) ? raw : today;
  const q = useLeaderboard(period, periodDate(period, date), metric, board === 'ranking');
  const rows = q.data?.items ?? [];
  const { ranked, unranked } = splitRanked(rows);
  const shared = sharedRanks(rows);
  const min = q.data?.minPresentDays ?? 1;
  const label = period === 'month' ? formatMonth(date) : formatDate(date);

  const value = (r: LeaderboardRow, m: LeaderMetric = metric): string => {
    if (r.value == null) return '—';
    if (m === 'collected') return formatMoney(r.value);
    if (m === 'visit_credit') return formatNumber(r.value, { decimals: creditDecimals(r.value) });
    if (m === 'target_achievement') return formatPercent(r.value);
    return formatNumber(r.value);
  };

  const columns: Column<LeaderboardRow>[] = [
    {
      id: 'rank',
      header: t('lb.col.rank'),
      priority: 1,
      mobile: 'badges',
      width: '72px',
      cell: (r) =>
        r.rank == null ? (
          <span className="text-fg-tertiary">—</span>
        ) : (
          <span className="tabular inline-flex items-baseline gap-1 font-semibold text-fg">
            {formatNumber(r.rank)}
            {shared.has(r.rank) && <span className="text-xs font-normal text-fg-tertiary">{t('lb.tie')}</span>}
          </span>
        ),
    },
    {
      id: 'staff',
      header: t('lb.col.staff'),
      priority: 1,
      mobile: 'title',
      cell: (r) => (
        <Link href={`/staff/?drawer=${r.userId}${period === 'month' ? '&period=monthly' : ''}`} className="flex min-w-0 items-center gap-2.5">
          <Avatar name={r.name ?? '?'} />
          <span className="min-w-0">
            <span className={cn('block max-w-[220px] truncate font-medium hover:text-primary', r.rank == null ? 'text-fg-secondary' : 'text-fg')} lang={locale}>{r.name}</span>
            <span className="block font-mono text-xs text-fg-tertiary">{r.employeeCode}</span>
          </span>
        </Link>
      ),
    },
    { id: 'value', header: t(`lb.metric.${metric}`), align: 'end', priority: 1, mobile: 'amount', cell: (r) => <span className={cn('tabular font-semibold', r.rank == null ? 'text-fg-tertiary' : 'text-fg')}>{value(r)}</span> },
    ...(metric !== 'collected' ? [{ id: 'collected', header: t('lb.metric.collected'), align: 'end' as const, priority: 2 as const, cell: (r: LeaderboardRow) => <MoneyText poisha={r.collectedPoisha ?? 0} /> }] : []),
    ...(metric !== 'visit_credit' ? [{ id: 'credit', header: t('lb.metric.visit_credit'), align: 'end' as const, priority: 3 as const, cell: (r: LeaderboardRow) => <span className="tabular">{formatNumber(r.visitCredit ?? 0, { decimals: creditDecimals(r.visitCredit ?? 0) })}</span> }] : []),
    ...(metric !== 'promises_kept' ? [{ id: 'kept', header: t('lb.metric.promises_kept'), align: 'end' as const, priority: 3 as const, cell: (r: LeaderboardRow) => <span className="tabular">{formatNumber(r.promisesKept ?? 0)}</span> }] : []),
    ...(metric !== 'target_achievement'
      ? [{ id: 'achieved', header: t('lb.metric.target_achievement'), align: 'end' as const, priority: 3 as const, cell: (r: LeaderboardRow) => (r.amountAchievement == null ? <span className="text-fg-tertiary">—</span> : <span className={cn('tabular', r.amountAchievement >= 1 && 'font-medium text-success')}>{formatPercent(r.amountAchievement)}</span>) }]
      : []),
    { id: 'present', header: t('lb.col.present'), align: 'end', priority: 4, cell: (r) => <span className="tabular">{formatNumber(r.presentDays ?? 0)}</span> },
  ];

  return (
    <>
      <PageHeader title={t('lb.title')} actions={<PrintButton name={board === 'collection' ? t('lb.board.title') : `${t('lb.title')} - ${t(`lb.metric.${metric}`)} - ${periodDate(period, date)}`} />}>
        <span>{board === 'collection' ? t('lb.board.subtitle') : t('lb.subtitle')}</span>
      </PageHeader>

      <div className="mb-4">
        <Segmented label={t('lb.board.which')} value={board} onChange={(v) => url.set({ board: v === 'ranking' ? null : v, period: null, date: null, metric: null, span: null, month: null })} options={BOARDS.map((b) => ({ value: b, label: t(`lb.board.tabs.${b}`) }))} />
      </div>
      {board === 'collection' ? <CollectionBoard /> : (
      <>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label={t('lb.period')} value={period} onChange={(v) => url.set({ period: v === 'month' ? null : v, date: null })} options={PERIODS.map((p) => ({ value: p, label: t(`lb.periods.${p}`) }))} />
          <Input
            type={period === 'month' ? 'month' : 'date'}
            aria-label={t('lb.when')}
            value={date}
            max={period === 'month' ? today.slice(0, 7) : today}
            onChange={(e) => (period === 'month' ? ISO_MONTH : ISO_DAY).test(e.target.value) && url.set({ date: e.target.value })}
            className="h-9 w-44 print:hidden"
          />
          <PrintOnly className="print:inline">({label})</PrintOnly>
        </div>
        <Segmented label={t('lb.by')} value={metric} onChange={(v) => url.set({ metric: v === 'collected' ? null : v })} options={METRICS.map((m) => ({ value: m, label: t(`lb.metric.${m}`) }))} />
      </div>

      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="mb-4" /> : null}

      <ol className="mb-4 grid gap-3 sm:grid-cols-3 print:grid-cols-3" aria-label={t('lb.top')}>
        {q.isLoading
          ? [0, 1, 2].map((i) => <li key={i}><Skeleton className="h-24 w-full" /></li>)
          : ranked.slice(0, 3).map((r, i) => {
              const P = PODIUM[Math.min(2, (r.rank ?? 1) - 1)] ?? PODIUM[2]!;
              return (
                <li key={r.userId} className="flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 shadow-e1">
                  <span className={cn('grid size-11 shrink-0 place-items-center rounded-full', P.cls)} aria-hidden>
                    <P.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-fg-tertiary">{t('lb.place', { n: formatNumber(r.rank ?? i + 1) })}</span>
                    <span className="block truncate font-semibold text-fg" lang={locale}>{r.name}</span>
                    <span className="tabular block text-md font-semibold text-fg">{value(r)}</span>
                  </span>
                </li>
              );
            })}
      </ol>

      <DataTable
        tableId={`leaderboard-${metric}`}
        caption={t('lb.title')}
        columns={columns}
        rows={q.isLoading ? undefined : [...ranked, ...unranked]}
        rowKey={(r) => r.userId ?? ''}
        loading={q.isLoading}
        empty={<EmptyState icon={Trophy} title={t('lb.empty')} />}
      />

      {!q.isLoading && unranked.length > 0 && (
        <p className="mt-3 flex items-start gap-2 text-sm text-fg-secondary">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          {metric === 'target_achievement' ? t('lb.unrankedTarget', { n: formatNumber(min) }) : t('lb.unranked', { n: formatNumber(min) })}
        </p>
      )}
      <p className="mt-2 flex items-start gap-2 text-sm text-fg-tertiary">
        <Badge tone="neutral" icon={false}>{t(`lb.metric.${metric}`)}</Badge>
        {t(`lb.how.${metric}`)}
      </p>
      </>
      )}
    </>
  );
}
