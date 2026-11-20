'use client';
import { useTranslation } from 'react-i18next';
import { Crown, Info, Medal, Trophy } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatMonth, formatNumber, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/form';
import { Avatar, Segmented } from '@/shared/ui/primitives';
import { MoneyText } from '@/shared/ui/money';
import { PrintOnly } from '@/shared/ui/print';
import { useCollectionBoard, type CollectionBoardRow } from '../api/reports';
import { BOARD_PERIODS, sharedRanks, splitRanked } from '../model/leaderboard';

const ISO_MONTH = /^\d{4}-\d{2}$/;
const PODIUM = [
  { icon: Crown, cls: 'bg-st-due-today-bg text-st-due-today' },
  { icon: Medal, cls: 'bg-surface-hover text-fg-secondary' },
  { icon: Medal, cls: 'bg-st-promised-bg text-st-promised' },
];

/**
 * FR-W-043 (master FR-REP-007): everyone who collected, ranked by the money the ERP has accepted, for a month or for
 * all time. Managers and admins who collect are on it by collections alone. Pending money is never counted; the
 * amounts are field-system activity, not ERP balances.
 */
export function CollectionBoard() {
  const { t } = useTranslation('reports');
  const { t: tc } = useTranslation('common');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const today = todayDhaka();
  const period = oneOf(url.get('span'), BOARD_PERIODS, 'month');
  const raw = url.get('month');
  const month = ISO_MONTH.test(raw) ? raw : today.slice(0, 7);
  const q = useCollectionBoard(period, month);
  const rows = q.data?.items ?? [];
  const { ranked, unranked } = splitRanked(rows);
  const shared = sharedRanks(rows);

  const columns: Column<CollectionBoardRow>[] = [
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
          <span className="tabular inline-flex items-center gap-1 font-semibold text-fg">
            {r.rank === 1 && <Crown className="size-4 text-st-due-today" role="img" aria-label={t('lb.board.first')} />}
            {formatNumber(r.rank)}
            {shared.has(r.rank) && <span className="text-xs font-normal text-fg-tertiary">{t('lb.tie')}</span>}
          </span>
        ),
    },
    {
      id: 'person',
      header: t('lb.board.person'),
      priority: 1,
      mobile: 'title',
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={pickText(r.name, locale) || '?'} />
          <span className="min-w-0">
            <span className={cn('block max-w-[240px] truncate font-medium', r.rank == null ? 'text-fg-secondary' : 'text-fg')} lang={locale}>{pickText(r.name, locale)}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-fg-tertiary">
              <span className="font-mono">{r.employeeCode}</span>
              {r.role !== 'field_staff' && <Badge tone="info" icon={false}>{tc(`role.${r.role}`)}</Badge>}
            </span>
          </span>
        </span>
      ),
    },
    { id: 'posted', header: t('lb.board.posted'), align: 'end', priority: 1, mobile: 'amount', cell: (r) => (r.rank == null ? <span className="text-fg-tertiary">—</span> : <MoneyText poisha={r.postedPoisha} className="font-semibold" />) },
    { id: 'count', header: t('lb.board.count'), align: 'end', priority: 2, cell: (r) => <span className="tabular">{formatNumber(r.count)}</span> },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented label={t('lb.period')} value={period} onChange={(v) => url.set({ span: v === 'month' ? null : v })} options={BOARD_PERIODS.map((p) => ({ value: p, label: t(`lb.board.periods.${p}`) }))} />
        {period === 'month' && (
          <>
            <Input type="month" aria-label={t('lb.board.month')} value={month} max={today.slice(0, 7)} onChange={(e) => ISO_MONTH.test(e.target.value) && url.set({ month: e.target.value === today.slice(0, 7) ? null : e.target.value })} className="h-9 w-44 print:hidden" />
            <PrintOnly className="print:inline">({formatMonth(month)})</PrintOnly>
          </>
        )}
        {q.data && <Badge tone="neutral" icon={false}>{t(`lb.board.scope.${q.data.scope}`)}</Badge>}
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
                    <span className="block truncate font-semibold text-fg" lang={locale}>{pickText(r.name, locale)}</span>
                    <MoneyText poisha={r.postedPoisha} className="block text-md font-semibold text-fg" />
                  </span>
                </li>
              );
            })}
      </ol>

      <DataTable
        tableId="collection-board"
        caption={t('lb.board.title')}
        columns={columns}
        rows={q.isLoading ? undefined : [...ranked, ...unranked]}
        rowKey={(r) => r.userId}
        loading={q.isLoading}
        empty={<EmptyState icon={Trophy} title={t('lb.board.empty')} />}
      />

      <p className="mt-3 flex items-start gap-2 text-sm text-fg-secondary">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        {t('lb.board.how')}
      </p>
    </>
  );
}
