'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { GitMerge, Receipt, ArrowRight, Ban, MapPin, MapPinOff, Clock, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatTime,
  formatDate,
  pickText,
} from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, DescList } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { Card } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge, StatusBadge, StatusBadges } from '@/shared/ui/badge';
import { FilterChip } from '@/shared/ui/primitives';
import { Select } from '@/shared/ui/form';
import { MoneyText } from '@/shared/ui/money';
import { Button } from '@/shared/ui/button';
import { Drawer } from '@/shared/ui/overlay';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useCollection, useCollections, useVoid, type Collection } from '../api/collections';
import { CollectDialog } from '../components/collect-dialog';
import {
  canVoid,
  METHOD_COLOR,
  METHOD_ORDER,
  orderedTotals,
  presetFor,
  rangeFor,
  RANGES,
} from '../model/collection';

const STATUSES = [
  'posted',
  'posting',
  'received',
  'conflict',
  'posting_failed',
  'resolved_posted',
  'voided',
] as const;

export function CollectionsPage() {
  const { t } = useTranslation('collections');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canRecord = useCan('collection.record');
  const [collectOpen, setCollectOpen] = useState(false);
  const url = useUrlState();
  const today = todayDhaka();
  const from = url.get('from') || today;
  const to = url.get('to') || from;
  const preset = presetFor(from, to, today);
  const method = oneOf(url.get('method'), ['', ...METHOD_ORDER] as const, '');
  const status = oneOf(url.get('status'), ['', ...STATUSES] as const, '');
  const flag = url.get('flag');
  const collectorId = url.get('collectorId');
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const q = useCollections({
    from,
    to,
    method: method || undefined,
    status: status || undefined,
    flag: flag || undefined,
    collectorId: collectorId || undefined,
    cursor: cursor || undefined,
    limit,
  });
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const drawer = url.get('drawer');
  const drawerId = drawer.startsWith('collection:') ? drawer.slice(11) : null;
  const totals = useMemo(() => orderedTotals(q.data?.totals), [q.data?.totals]);
  const sum = totals.reduce((a, b) => a + b.poisha, 0);
  const reset = () => pager.reset();

  const columns: Column<Collection>[] = [
    {
      id: 'customer',
      header: t('col.customer'),
      priority: 1,
      mobile: 'title',
      cell: (c) => (
        <div className="min-w-0">
          <span className="block max-w-[220px] truncate font-medium" lang={locale}>
            {pickText(c.customer?.name, locale)}
          </span>
          <span className="block font-mono text-xs text-fg-tertiary">{c.receiptNo}</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: t('col.amount'),
      align: 'end',
      priority: 1,
      mobile: 'amount',
      cell: (c) => (
        <MoneyText
          poisha={c.amountPoisha ?? 0}
          pending={['received', 'posting', 'posting_failed', 'conflict'].includes(c.status!)}
          className="font-medium"
        />
      ),
    },
    {
      id: 'status',
      header: t('col.status'),
      priority: 1,
      mobile: 'badges',
      cell: (c) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <StatusBadge status={c.status!} />
          {c.edited && <Badge tone="warning">{t('editedBadge')}</Badge>}
        </span>
      ),
    },
    {
      id: 'method',
      header: t('col.method'),
      priority: 2,
      mobile: 'meta',
      cell: (c) => (
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('size-2 rounded-full', METHOD_COLOR[c.method!])} aria-hidden />
          {tc(`method.${c.method}`)}
        </span>
      ),
    },
    {
      id: 'collector',
      header: t('col.collector'),
      priority: 2,
      mobile: 'meta',
      cell: (c) => c.collector?.name,
    },
    {
      id: 'recordedAt',
      header: t('col.recordedAt'),
      priority: 3,
      mobile: 'subtitle',
      cell: (c) => (from === to ? formatTime(c.recordedAt!) : formatDateTime(c.recordedAt!)),
    },
    {
      id: 'flags',
      header: t('col.flags'),
      priority: 4,
      cell: (c) =>
        c.flags?.length ? (
          <StatusBadges statuses={c.flags} max={1} />
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        print
        actions={
          <div className="flex items-center gap-2">
            {canRecord && (
              <Button variant="primary" onClick={() => setCollectOpen(true)}>
                <Plus className="size-4" aria-hidden />
                {t('collect')}
              </Button>
            )}
            <Link
              href="/collections/conflicts/"
              className="inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-base font-medium shadow-e1 hover:bg-surface-hover"
            >
              <GitMerge className="size-4 text-danger" aria-hidden />
              {t('conflicts')}
              <ArrowRight className="size-4 text-fg-tertiary" aria-hidden />
            </Link>
          </div>
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div
          className="inline-flex w-fit overflow-x-auto rounded-md border border-line bg-surface p-0.5 shadow-e1"
          role="group"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={preset === r}
              onClick={() => (reset(), url.set({ ...rangeFor(r, today), cursor: null }))}
              className={cn(
                'h-8 rounded-sm px-3 text-sm font-medium whitespace-nowrap [@media(pointer:coarse)]:h-10',
                preset === r ? 'bg-primary-subtle text-primary-subtle-fg' : 'text-fg-secondary hover:text-fg',
              )}
            >
              {t(`range.${r}`)}
            </button>
          ))}
        </div>
        {!preset && (
          <span className="text-sm text-fg-secondary">
            {formatDate(from)} – {formatDate(to)}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2 lg:ms-auto">
          <Select
            aria-label={t('col.method')}
            value={method}
            onChange={(e) => (reset(), url.set({ method: e.target.value || null, cursor: null }))}
            className="h-9 w-40"
          >
            <option value="">{t('allMethods')}</option>
            {METHOD_ORDER.map((m) => (
              <option key={m} value={m}>
                {tc(`method.${m}`)}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('col.status')}
            value={status}
            onChange={(e) => (reset(), url.set({ status: e.target.value || null, cursor: null }))}
            className="h-9 w-44"
          >
            <option value="">{t('allStatus')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tc(`status.${s}`)}
              </option>
            ))}
          </Select>
          <FilterChip
            selected={!!flag}
            onClick={() => (reset(), url.set({ flag: flag ? null : 'far_from_pin', cursor: null }))}
          >
            {t('flagged')}
          </FilterChip>
          {collectorId && (
            <FilterChip selected onClick={() => url.set({ collectorId: null, cursor: null })}>
              {q.data?.items?.[0]?.collector?.name ?? t('col.collector')}
            </FilterChip>
          )}
        </div>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-sm text-fg-tertiary">
              {t('total')} · {t('excludesVoided')}
            </div>
            {q.isLoading ? (
              <Skeleton className="mt-1 h-8 w-40" />
            ) : (
              <MoneyText poisha={sum} className="text-3xl font-semibold tracking-tight" />
            )}
          </div>
          <div className="text-sm text-fg-tertiary">
            {preset ? t(`range.${preset}`) : `${formatDate(from)} – ${formatDate(to)}`}
          </div>
        </div>
        {sum > 0 && (
          <>
            <div
              className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-xs"
              role="img"
              aria-label={totals
                .map((x) => `${tc(`method.${x.method}`)} ${formatPercent(x.share)}`)
                .join(', ')}
            >
              {totals.map((x) => (
                <div
                  key={x.method}
                  className={cn('h-full first:rounded-s-xs last:rounded-e-xs', METHOD_COLOR[x.method])}
                  style={{ width: `${x.share * 100}%` }}
                />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {totals.map((x) => (
                <li key={x.method}>
                  <button
                    type="button"
                    onClick={() => (
                      reset(),
                      url.set({ method: method === x.method ? null : x.method, cursor: null })
                    )}
                    className="flex items-center gap-2 text-sm hover:text-primary"
                  >
                    <span className={cn('size-2.5 rounded-full', METHOD_COLOR[x.method])} aria-hidden />
                    <span className="text-fg-secondary">{tc(`method.${x.method}`)}</span>
                    <MoneyText poisha={x.poisha} className="font-medium text-fg" />
                    <span className="tabular text-xs text-fg-tertiary">{formatPercent(x.share)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <DataTable
        tableId="collections"
        caption={t('title')}
        columns={columns}
        rows={q.data?.items}
        rowKey={(c) => c.id!}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        activeRowKey={drawerId}
        onRowClick={(c) => url.set({ drawer: `collection:${c.id}` }, { push: true })}
        pager={{
          page: pager.page,
          hasPrev: pager.hasPrev,
          hasNext: !!q.data?.nextCursor,
          onPrev: pager.prev,
          onNext: () => pager.next(q.data?.nextCursor),
          pageSize: limit,
          onPageSize: (n) => (reset(), setLimit(n), url.set({ cursor: null })),
        }}
        empty={<EmptyState icon={Receipt} title={t('emptyTitle')} body={t('emptyBody')} />}
      />
      <CollectDialog open={collectOpen} onOpenChange={setCollectOpen} />
      <CollectionDrawer id={drawerId} onClose={() => url.set({ drawer: null })} />
    </>
  );
}

function CollectionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation('collections');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const q = useCollection(id);
  const c = q.data;
  const canVoidPerm = useCan('collection.void');
  const voidM = useVoid();
  const [voiding, setVoiding] = useState(false);
  const name = pickText(c?.customer?.name, locale);
  return (
    <>
      <Drawer
        open={!!id}
        onOpenChange={(o) => !o && onClose()}
        title={c ? <span className="font-mono">{c.receiptNo}</span> : <Skeleton className="h-5 w-48" />}
        subtitle={c ? name : undefined}
        headerExtra={
          c ? (
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge status={c.status!} />
              {c.flags?.map((f) => (
                <StatusBadge key={f} status={f} />
              ))}
            </div>
          ) : null
        }
        footer={
          c && (
            <>
              <Link
                href={`/customers/${c.customer?.id}/`}
                className="inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong px-4 text-base font-medium hover:bg-surface-hover"
              >
                {t('detail.openCustomer')}
              </Link>
              {canVoidPerm && canVoid(c.status) && (
                <Button variant="destructive" onClick={() => setVoiding(true)}>
                  <Ban className="size-4" aria-hidden />
                  {t('void')}
                </Button>
              )}
            </>
          )
        }
      >
        <div className="space-y-5 p-5">
          {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
          {!c ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <div className="rounded-md border border-line bg-surface-subtle p-4">
                <div className="text-sm text-fg-tertiary">{t('col.amount')}</div>
                <MoneyText poisha={c.amountPoisha ?? 0} className="text-3xl font-semibold" />
                <div className="mt-1 flex items-center gap-1.5 text-sm text-fg-secondary">
                  <span className={cn('size-2 rounded-full', METHOD_COLOR[c.method!])} aria-hidden />
                  {tc(`method.${c.method}`)}
                </div>
              </div>
              {c.conflict && (
                <div className="rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
                  <div className="font-semibold text-danger">
                    {t('detail.conflict')} · <span className="font-mono text-xs">{c.conflict.code}</span>
                  </div>
                  <p className="mt-1 text-fg" lang={locale}>
                    {pickText(c.conflict.message, locale)}
                  </p>
                </div>
              )}
              {c.resolution && (
                <div className="rounded-md border border-line px-4 py-3 text-sm">
                  <div className="font-semibold">
                    {t('detail.resolution')} ·{' '}
                    {t(`actions.${c.resolution.action}`, { defaultValue: c.resolution.action })}
                  </div>
                  <p className="mt-1 text-fg-secondary">{c.resolution.reason}</p>
                  {c.resolution.at && (
                    <p className="mt-1 text-xs text-fg-tertiary">{formatDateTime(c.resolution.at)}</p>
                  )}
                </div>
              )}
              {c.voided && (
                <div className="rounded-md border border-line px-4 py-3 text-sm" data-testid="voided-block">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {t('detail.voided')}
                    <Badge tone={c.voided.kind === 'withdrawn' ? 'warning' : 'neutral'}>
                      {t(`detail.voidKind.${c.voided.kind ?? 'admin'}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-fg-secondary">{c.voided.reason}</p>
                  <p className="mt-1 text-xs text-fg-tertiary">
                    {t('detail.voidedBy', { name: c.voided.byName || '—', date: c.voided.at ? formatDateTime(c.voided.at) : '—' })}
                  </p>
                </div>
              )}
              {c.edited && (
                <div className="rounded-md border border-line px-4 py-3 text-sm" data-testid="edited-block">
                  <div className="font-semibold">{t('detail.edited')}</div>
                  <p className="mt-1 text-fg-secondary">
                    {t('detail.editedLine', {
                      name: c.edited.byName || '—',
                      date: c.edited.at ? formatDateTime(c.edited.at) : '—',
                      was: formatMoney(c.edited.previousAmountPoisha ?? 0),
                      now: formatMoney(c.amountPoisha ?? 0),
                    })}
                  </p>
                  {(c.edited.count ?? 0) > 1 && <p className="mt-1 text-xs text-fg-tertiary">{t('detail.editedTimes', { count: c.edited.count })}</p>}
                </div>
              )}
              <DescList
                items={[
                  {
                    label: t('col.customer'),
                    value: (
                      <Link href={`/customers/${c.customer?.id}/`} className="text-primary hover:underline">
                        {name}
                      </Link>
                    ),
                  },
                  { label: t('col.collector'), value: c.collector?.name },
                  {
                    label: t('detail.erpReceipt'),
                    value: <span className="font-mono text-sm">{c.erpReceiptNo ?? '—'}</span>,
                  },
                  {
                    label: t('detail.plan'),
                    value: <span className="font-mono text-sm">{c.erpPlanId ?? '—'}</span>,
                  },
                  {
                    label: t('detail.txn'),
                    value: <span className="font-mono text-sm">{c.transactionRef ?? '—'}</span>,
                  },
                  {
                    label: t('detail.recorded'),
                    value: (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5 text-fg-tertiary" aria-hidden />
                        {formatDateTime(c.recordedAt!)}
                      </span>
                    ),
                  },
                  { label: t('detail.received'), value: formatDateTime(c.receivedAt!) },
                  {
                    label: t('detail.distance'),
                    value:
                      c.distanceToPinM != null ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            (c.distanceToPinM ?? 0) > 300 && 'font-medium text-warning',
                          )}
                        >
                          <MapPin className="size-3.5" aria-hidden />
                          {t('detail.metres', { n: formatNumber(c.distanceToPinM) })}
                        </span>
                      ) : c.flags?.includes('no_location') ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <MapPinOff className="size-3.5" aria-hidden />
                          {tc('flags.no_location')}
                        </span>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
              {c.cashOnHand && (
                <div className="flex items-center justify-between rounded-md border border-line px-4 py-3 text-sm">
                  <span className="text-fg-secondary">{t('detail.cashOnHand')}</span>
                  <span className="flex items-center gap-2">
                    <MoneyText poisha={c.cashOnHand.onHandPoisha ?? 0} className="font-medium" />
                    {c.cashOnHand.state && c.cashOnHand.state !== 'ok' && (
                      <Badge tone={c.cashOnHand.state === 'exceeded' ? 'danger' : 'warning'}>
                        {tc(`status.cash_${c.cashOnHand.state}`)}
                      </Badge>
                    )}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Drawer>
      {c && (
        <ReasonDialog
          open={voiding}
          onOpenChange={setVoiding}
          destructive
          title={t('voidTitle', { amount: formatMoney(c.amountPoisha ?? 0), name })}
          description={t('voidDesc')}
          codes={(['duplicate', 'wrong_customer', 'wrong_amount', 'other'] as const).map(
            (k) => [k, t(`voidCodes.${k}`)] as [string, string],
          )}
          confirmLabel={t('voidConfirm', { amount: formatMoney(c.amountPoisha ?? 0) })}
          onSubmit={async (v) => {
            await voidM.mutateAsync({ id: c.id!, reason: `${t(`voidCodes.${v.reasonCode}`)}: ${v.reason}` });
            toast.success(t('voided'));
            void q.refetch();
          }}
        />
      )}
    </>
  );
}
