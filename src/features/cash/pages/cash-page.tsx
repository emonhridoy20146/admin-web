'use client';
import { InHandDrawer } from '../components/in-hand-drawer';
import { DepositDrawer } from '../components/deposit-drawer';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Banknote, Check, CircleAlert, Clock, Hourglass, Landmark, ListOrdered, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelative,
} from '@/shared/lib/format';
import { startOfTodayDhakaIso } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, Section, DescList } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { Card } from '@/shared/ui/card';
import { KpiCard } from '@/shared/ui/kpi-card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import { Avatar, Segmented, Tooltip } from '@/shared/ui/primitives';
import { MoneyText } from '@/shared/ui/money';
import { Button } from '@/shared/ui/button';
import { Dialog } from '@/shared/ui/overlay';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import {
  useCashPositions,
  useDeposits,
  useRejectDeposit,
  useVerifyDeposit,
  type CashPosition,
  type Deposit,
  type DepositStatus,
} from '../api/cash';
import { depositUserName, isCarriedOver, sortPositions, summarize, usage } from '../model/cash';

const DEPOSIT_TABS = ['pending', 'verified', 'rejected'] as const;

export function CashPage() {
  const { t } = useTranslation('cash');
  useUi((s) => s.bnDigits);
  useUi((s) => s.locale);
  const url = useUrlState();
  const positions = useCashPositions();
  const sorted = useMemo(() => sortPositions(positions.data ?? []), [positions.data]);
  const sum = useMemo(() => summarize(positions.data ?? []), [positions.data]);
  const pendingCount = useDeposits('pending', undefined, 100);
  const loading = positions.isLoading;
  const todayStart = startOfTodayDhakaIso();
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
      id: 'pending',
      header: t('col.pendingDeposits'),
      align: 'end',
      priority: 3,
      cell: (p) =>
        (p.pendingDepositsPoisha ?? 0) > 0 ? (
          <MoneyText poisha={p.pendingDepositsPoisha} pending />
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
          label={t('kpi.pending')}
          icon={Landmark}
          href="/cash/#deposits"
          loading={pendingCount.isLoading}
          value={formatNumber(pendingCount.data?.items.length ?? 0)}
          sub={
            sum.pendingDepositsPoisha
              ? t('kpi.pendingSub', { amount: formatMoney(sum.pendingDepositsPoisha) })
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

      <DepositsSection
        positions={positions.data}
        initialTab={oneOf(url.get('deposits'), DEPOSIT_TABS, 'pending')}
        pendingCount={pendingCount.data?.items.length}
      />

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

function DepositsSection({
  positions,
  initialTab,
  pendingCount,
}: {
  positions: CashPosition[] | undefined;
  initialTab: DepositStatus;
  pendingCount?: number;
}) {
  const { t } = useTranslation('cash');
  const url = useUrlState();
  const tab = initialTab;
  const cursor = url.get('dcursor');
  const pager = useCursorPager(cursor, (c) => url.set({ dcursor: c }));
  const q = useDeposits(tab, cursor || undefined);
  const drawer = url.get('drawer');
  const focusId = drawer.startsWith('deposit:') ? drawer.slice(8) : null;
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
      header: t('col.amount'),
      align: 'end',
      priority: 1,
      mobile: 'amount',
      cell: (d) => <MoneyText poisha={d.amountPoisha} className="font-medium" />,
    },
    {
      id: 'status',
      header: t('col.status'),
      priority: 1,
      mobile: 'badges',
      cell: (d) => <StatusBadge status={d.status ?? 'pending'} />,
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
          {d.verifiedAt ? formatDateTime(d.verifiedAt) : '—'}
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
            onChange={(v) => (
              pager.reset(),
              url.set({ deposits: v === 'pending' ? null : v, dcursor: null })
            )}
            options={DEPOSIT_TABS.map((s) => ({
              value: s,
              label: t(`depositStatus.${s}`),
              count: s === 'pending' ? pendingCount : undefined,
            }))}
          />
        }
      >
        {tab === 'pending' ? (
          <>
            <p className="mb-3 text-sm text-fg-secondary">{t('depositsHint')}</p>
            {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
            {q.isLoading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-44 rounded-md" />
                ))}
              </div>
            ) : !items?.length ? (
              <Card>
                <EmptyState icon={Check} title={t('emptyPending')} body={t('emptyPendingBody')} />
              </Card>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((d) => (
                  <DepositCard
                    key={d.id}
                    d={d}
                    name={depositUserName(d, positions) ?? '—'}
                    position={positions?.find((p) => p.userId === d.userId)}
                    focused={d.id === focusId}
                  />
                ))}
              </ul>
            )}
          </>
        ) : (
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
        )}
      </Section>
    </section>
  );
}

function DepositCard({
  d,
  name,
  position,
  focused,
}: {
  d: Deposit;
  name: string;
  position?: CashPosition;
  focused: boolean;
}) {
  const { t } = useTranslation('cash');
  const { t: tc } = useTranslation();
  const canVerify = useCan('cash.deposit.verify');
  const verify = useVerifyDeposit();
  const reject = useRejectDeposit();
  const [confirm, setConfirm] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const amount = formatMoney(d.amountPoisha ?? 0);
  const url = useUrlState();

  return (
    <li
      className={cn(
        'flex flex-col rounded-md border bg-surface p-4 shadow-e1',
        focused ? 'border-primary ring-2 ring-primary/20' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-fg">{name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-sm text-fg-tertiary">
            <Clock className="size-3.5" aria-hidden />
            <Tooltip content={formatDateTime(d.depositedAt)}>
              <span tabIndex={0}>{formatRelative(d.depositedAt)}</span>
            </Tooltip>
          </div>
        </div>
        <MoneyText poisha={d.amountPoisha} className="text-lg font-semibold" />
      </div>
      <DescList
        className="mt-4 grid-cols-3 gap-x-3 sm:grid-cols-3"
        items={[
          { label: t('col.destination'), value: t(`destination.${d.destination}`) },
          {
            label: t('col.reference'),
            value: <span className="font-mono text-sm">{d.reference ?? '—'}</span>,
          },
          ...(position
            ? [
                {
                  label: t('col.onHand'),
                  value: <MoneyText poisha={position.onHandPoisha} className="text-sm" />,
                },
              ]
            : []),
        ]}
      />
      <Button size="sm" className="mt-3 self-start" onClick={() => d.id && url.set({ dep: d.id }, { push: true })} aria-label={t('depositDetail.open', { name })}>
        <ListOrdered className="size-4" aria-hidden />
        {t('depositDetail.openShort')}
      </Button>
      {canVerify && (
        <div className="mt-4 flex gap-2 border-t border-line pt-3">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => setConfirm(true)}>
            <Check className="size-4" aria-hidden />
            {t('verify')}
          </Button>
          <Button size="sm" className="flex-1" onClick={() => setRejecting(true)}>
            <X className="size-4" aria-hidden />
            {t('reject')}
          </Button>
        </div>
      )}

      <Dialog
        open={confirm}
        onOpenChange={(o) => !verify.isPending && setConfirm(o)}
        title={t('verifyTitle', { amount, name })}
        description={t('verifyDesc', { amount })}
        footer={
          <>
            <Button onClick={() => setConfirm(false)} disabled={verify.isPending}>
              {tc('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={verify.isPending}
              onClick={() =>
                verify.mutate(d.id!, {
                  onSuccess: () => (setConfirm(false), toast.success(t('verified'))),
                })
              }
            >
              {t('verifyConfirm', { amount })}
            </Button>
          </>
        }
      >
        <div className="rounded-md bg-surface-subtle p-4 text-center">
          <MoneyText poisha={d.amountPoisha} className="text-3xl font-semibold" />
          <div className="mt-1 text-sm text-fg-secondary">{`${t(`destination.${d.destination}`)} · ${d.reference ?? ''}`}</div>
        </div>
        {verify.error ? <ErrorBanner error={verify.error} className="mt-3" /> : null}
      </Dialog>

      <ReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={t('rejectTitle', { amount, name })}
        description={t('rejectDesc')}
        codes={(['amount_mismatch', 'slip_missing', 'not_received', 'other'] as const).map((c) => [
          c,
          t(`rejectCodes.${c}`),
        ])}
        minLength={5}
        destructive
        confirmLabel={t('rejectConfirm')}
        onSubmit={async ({ reasonCode, reason }) => {
          await reject.mutateAsync({
            id: d.id!,
            reason: `${t(`rejectCodes.${reasonCode}`, { lng: 'en' })}: ${reason}`,
          });
          toast.success(t('rejected'));
        }}
      />
    </li>
  );
}
