'use client';
import { InHandDrawer } from '../components/in-hand-drawer';
import { DepositDrawer } from '../components/deposit-drawer';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CircleAlert, Hourglass, Landmark } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelative,
} from '@/shared/lib/format';
import { startOfTodayDhakaIso } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, Section } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { KpiCard } from '@/shared/ui/kpi-card';
import { EmptyState } from '@/shared/ui/feedback';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import { Avatar, Segmented, Tooltip } from '@/shared/ui/primitives';
import { MoneyText } from '@/shared/ui/money';
import { useCashPositions, useDeposits, type CashPosition, type Deposit } from '../api/cash';
import { depositsSince, depositUserName, isCarriedOver, sortPositions, summarize, usage } from '../model/cash';

/**
 * FR-W-053 (master FR-CASH-010, contract 1.35.0): deposits are final and need no office step, so the list defaults to
 * the deposits made since 1.35.0 (`submitted`); "all" also shows the older pending, verified, rejected and deleted ones.
 */
const DEPOSIT_TABS = ['submitted', 'all'] as const;
type DepositTab = (typeof DEPOSIT_TABS)[number];

export function CashPage() {
  const { t } = useTranslation('cash');
  useUi((s) => s.bnDigits);
  useUi((s) => s.locale);
  const url = useUrlState();
  const positions = useCashPositions();
  const sorted = useMemo(() => sortPositions(positions.data ?? []), [positions.data]);
  const sum = useMemo(() => summarize(positions.data ?? []), [positions.data]);
  // deposits today: the newest 100 final deposits are more than a branch makes in a day
  const recent = useDeposits('submitted', undefined, 100);
  const loading = positions.isLoading;
  const todayStart = startOfTodayDhakaIso();
  const today = useMemo(() => depositsSince(recent.data?.items ?? [], todayStart), [recent.data, todayStart]);
  // FR-W-044: a row opens the collections behind that collector's cash (kept in the URL so the view can be shared)
  const hand = url.get('hand') || null;
  const handName = positions.data?.find((p) => p.userId === hand)?.userName ?? '';
  // FR-W-048: a deposit opens the collections it covered (also in the URL)
  const dep = url.get('dep') || null;

  const columns: Column<CashPosition>[] = [
    {
      id: 'user',
      header: t('col.user'),
      priority: 1,
      mobile: 'title',
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={p.userName ?? ''} className="size-7" />
          <span className="truncate font-medium text-fg">{p.userName}</span>
        </span>
      ),
    },
    {
      id: 'onHand',
      header: t('col.onHand'),
      align: 'end',
      priority: 1,
      mobile: 'amount',
      cell: (p) => <MoneyText poisha={p.onHandPoisha} className="font-medium" />,
    },
    {
      id: 'limit',
      header: t('col.limit'),
      priority: 2,
      width: '200px',
      cell: (p) => {
        const u = usage(p);
        return (
          <div className="min-w-[150px]">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(u * 100)}
              aria-label={t('col.limit')}
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  p.state === 'exceeded'
                    ? 'bg-st-overdue'
                    : p.state === 'warning'
                      ? 'bg-warning'
                      : 'bg-success',
                )}
                style={{ width: `${Math.min(100, u * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-fg-tertiary">
              <span className={cn('tabular', u >= 1 && 'font-medium text-st-overdue')}>
                {formatPercent(u)}
              </span>
              <span className="tabular">{t('ofLimit', { limit: formatMoney(p.limitPoisha ?? 0) })}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'state',
      header: t('col.state'),
      priority: 1,
      mobile: 'badges',
      cell: (p) => <StatusBadge status={p.state ?? 'ok'} />,
    },
    {
      id: 'oldest',
      header: t('col.oldest'),
      priority: 2,
      mobile: 'meta',
      cell: (p) =>
        p.oldestUndepositedAt ? (
          <span className="inline-flex items-center gap-1.5">
            <Tooltip content={formatDateTime(p.oldestUndepositedAt)}>
              <span
                tabIndex={0}
                className={cn(isCarriedOver(p, todayStart) && 'font-medium text-st-overdue')}
              >
                {formatRelative(p.oldestUndepositedAt)}
              </span>
            </Tooltip>
            {isCarriedOver(p, todayStart) && (
              <Badge tone="danger" icon={false} className="hidden lg:inline-flex">
                {t('carriedOver')}
              </Badge>
            )}
          </span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    {
      id: 'today',
      header: t('col.today'),
      priority: 4,
      cell: (p) => (
        <span className="tabular text-sm text-fg-secondary">
          {t('todaySplit', {
            cash: formatMoney(p.todayCashPoisha ?? 0),
            mobile: formatMoney(p.todayMobilePoisha ?? 0),
          })}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('title')} print>
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('kpi.onHand')}
          icon={Banknote}
          href="/cash/#positions"
          loading={loading}
          value={<MoneyText poisha={sum.onHandPoisha} />}
          sub={t('kpi.holders', { n: formatNumber(sum.holders) })}
        />
        <KpiCard
          label={t('kpi.overLimit')}
          icon={CircleAlert}
          href="/cash/#positions"
          loading={loading}
          tone={sum.exceeded ? 'attention' : 'default'}
          value={formatNumber(sum.exceeded)}
          sub={sum.warning ? t('kpi.nearLimit', { n: formatNumber(sum.warning) }) : undefined}
        />
        <KpiCard
          label={t('kpi.depositedToday')}
          icon={Landmark}
          href="/cash/#deposits"
          loading={recent.isLoading}
          value={formatNumber(today.count)}
          sub={
            today.count
              ? t('kpi.depositedTodaySub', { cash: formatMoney(today.cashPoisha), nonCash: formatMoney(today.nonCashPoisha) })
              : undefined
          }
        />
        <KpiCard
          label={t('kpi.oldest')}
          icon={Hourglass}
          href="/cash/#positions"
          loading={loading}
          tone={sum.oldest && sum.oldest < todayStart ? 'attention' : 'default'}
          value={sum.oldest ? formatRelative(sum.oldest) : t('kpi.none')}
          sub={sum.oldest ? t('kpi.oldestSub', { at: formatDateTime(sum.oldest) }) : undefined}
        />
      </div>

      <DepositsSection positions={positions.data} tab={oneOf(url.get('deposits'), DEPOSIT_TABS, 'submitted')} />

      <section id="positions" className="scroll-mt-20">
        <Section
          title={t('positions')}
          actions={<span className="text-sm text-fg-tertiary">{t('positionsHint')}</span>}
        >
          <DataTable
            tableId="cash-positions"
            caption={t('positions')}
            columns={columns}
            rows={sorted}
            rowKey={(p) => p.userId ?? ''}
            onRowClick={(p) => p.userId && url.set({ hand: p.userId }, { push: true })}
            loading={loading}
            error={positions.error}
            onRetry={() => positions.refetch()}
            empty={<EmptyState icon={Banknote} title={t('emptyPositions')} />}
          />
        </Section>
      </section>
      <InHandDrawer userId={hand} userName={handName} onClose={() => url.set({ hand: null })} />
      <DepositDrawer depositId={dep} onClose={() => url.set({ dep: null })} />
    </>
  );
}

function DepositsSection({ positions, tab }: { positions: CashPosition[] | undefined; tab: DepositTab }) {
  const { t } = useTranslation('cash');
  const url = useUrlState();
  const cursor = url.get('dcursor');
  const pager = useCursorPager(cursor, (c) => url.set({ dcursor: c }));
  const q = useDeposits(tab === 'all' ? undefined : tab, cursor || undefined);
  const items = q.data?.items;

  const history: Column<Deposit>[] = [
    {
      id: 'user',
      header: t('col.depositor'),
      priority: 1,
      mobile: 'title',
      cell: (d) => <span className="font-medium text-fg">{depositUserName(d, positions) ?? '—'}</span>,
    },
    {
      id: 'amount',
      header: t('col.cash'),
      align: 'end',
      priority: 1,
      mobile: 'amount',
      cell: (d) => <MoneyText poisha={d.amountPoisha} className="font-medium" />,
    },
    {
      id: 'nonCash',
      header: t('col.nonCash'),
      align: 'end',
      priority: 2,
      mobile: 'meta',
      cell: (d) =>
        d.nonCashPoisha ? (
          <span className="tabular">
            <MoneyText poisha={d.nonCashPoisha} />
            <span className="ms-1 text-xs text-fg-tertiary">({formatNumber(d.nonCashCount ?? 0)})</span>
          </span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    {
      id: 'count',
      header: t('col.collections'),
      align: 'end',
      priority: 3,
      cell: (d) =>
        d.collectionCount != null ? (
          <span className="tabular">{formatNumber(d.collectionCount)}</span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    {
      id: 'status',
      header: t('col.status'),
      priority: 1,
      mobile: 'badges',
      cell: (d) => <StatusBadge status={d.status ?? 'submitted'} />,
    },
    {
      id: 'dest',
      header: t('col.destination'),
      priority: 2,
      mobile: 'meta',
      cell: (d) => t(`destination.${d.destination}`),
    },
    {
      id: 'ref',
      header: t('col.reference'),
      priority: 3,
      cell: (d) => <span className="font-mono text-xs">{d.reference ?? '—'}</span>,
    },
    {
      id: 'at',
      header: t('col.depositedAt'),
      priority: 2,
      mobile: 'meta',
      cell: (d) => formatDateTime(d.depositedAt),
    },
    {
      id: 'decided',
      header: t('col.decidedAt'),
      priority: 4,
      cell: (d) => (
        <span className="block max-w-[280px]">
          {d.status === 'deleted' && d.deletedAt ? formatDateTime(d.deletedAt) : d.verifiedAt ? formatDateTime(d.verifiedAt) : d.status === 'submitted' ? t('finalNote') : '—'}
          {d.status === 'deleted' && d.deleteReason && (
            <span className="block truncate text-xs text-fg-tertiary" title={d.deleteReason}>
              {t('depositDetail.deletedBy', { reason: d.deleteReason })}
            </span>
          )}
          {d.rejectReason && (
            <span className="block truncate text-xs text-fg-tertiary" title={d.rejectReason}>
              {t('rejectReason', { reason: d.rejectReason })}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <section id="deposits" className="mb-8 scroll-mt-20">
      <Section
        title={t('deposits')}
        actions={
          <Segmented
            label={t('deposits')}
            value={tab}
            onChange={(v) => (pager.reset(), url.set({ deposits: v === 'submitted' ? null : v, dcursor: null }))}
            options={DEPOSIT_TABS.map((s) => ({ value: s, label: t(`depositTab.${s}`) }))}
          />
        }
      >
        <p className="mb-3 text-sm text-fg-secondary">{t('depositsHint')}</p>
        <DataTable
          tableId="cash-deposits"
          caption={t('deposits')}
          columns={history}
          rows={items}
          rowKey={(d) => d.id ?? ''}
          onRowClick={(d) => d.id && url.set({ dep: d.id }, { push: true })}
          loading={q.isLoading}
          error={q.error}
          onRetry={() => q.refetch()}
          empty={<EmptyState icon={Landmark} title={t('emptyDeposits')} />}
          pager={{
            page: pager.page,
            hasPrev: pager.hasPrev,
            hasNext: !!q.data?.nextCursor,
            onPrev: pager.prev,
            onNext: () => pager.next(q.data?.nextCursor),
            pageSize: 25,
            onPageSize: () => undefined,
          }}
        />
      </Section>
    </section>
  );
}
