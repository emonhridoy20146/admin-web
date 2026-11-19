'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Map as MapIcon, MapPinOff, SearchX, UserPlus, Users } from 'lucide-react';
import { BulkAssignDialog } from '@/features/assignments';
import { useGate } from '@/shared/feature/useGate';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatMoney, formatNumber, formatRelative } from '@/shared/lib/format';
import { listOf, oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/feedback';
import { FilterChip, Segmented, Tooltip } from '@/shared/ui/primitives';
import { SearchInput, Select } from '@/shared/ui/form';
import { MoneyText } from '@/shared/ui/money';
import { StatusBadges } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { useCustomers, type CustomerQuery } from '../api/customers';
import { extraStatuses, toCustomerRow, type CustomerRowVM } from '../model/customer-row';
import { PAY_STATES, PS_CLASS } from '../model/pay-state';
import { CustomerDrawer } from '../components/customer-drawer';
import { PayLegend, PayStateBadge } from '../components/pay-state';

const FILTERS = ['overdue', 'due_today', 'promised_today', 'bad_suggested', 'tagged_bad', 'no_location', 'unassigned', 'paid_up'] as const;
const SORTS = ['-daysOverdue', '-totalOutstanding', 'nextDueDate', 'name'] as const;
const KINDS = ['all', 'installment', 'credit'] as const;

export function CustomersPage() {
  const { t } = useTranslation('customers');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const filters = listOf(url.getList('filter'), FILTERS);
  const pay = listOf(url.getList('pay'), PAY_STATES);
  const kind = oneOf(url.get('kind'), KINDS, 'all');
  const sort = oneOf(url.get('sort'), SORTS, '-daysOverdue');
  const qParam = url.get('q');
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const [q, setQ] = useState(qParam);
  useEffect(() => setQ(qParam), [qParam]);
  useEffect(() => {
    const id = setTimeout(() => q !== qParam && url.set({ q: q || null, cursor: null }), 300);
    return () => clearTimeout(id);
  }, [q, qParam, url]);

  const params: Omit<CustomerQuery, 'branchId'> = {
    filter: filters.length ? filters : undefined,
    payState: pay.length ? pay : undefined,
    invoiceKind: kind === 'all' ? undefined : kind,
    sort,
    q: qParam || undefined,
    cursor: cursor || undefined,
    limit,
  };
  const query = useCustomers(params);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const rows = useMemo(() => query.data?.items?.map((c) => toCustomerRow(c, locale)), [query.data, locale]);
  const drawer = url.get('drawer');
  const drawerId = drawer.startsWith('customer:') ? drawer.slice(9) : null;
  const gate = useGate();
  const canAssign = gate.can('assignment.manage') && gate.flag('module.assignments');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const { t: ta } = useTranslation('assignments');

  const toggleFilter = (f: string) => {
    pager.reset();
    url.set({ filter: filters.includes(f as never) ? filters.filter((x) => x !== f) : [...filters, f], cursor: null });
  };

  const columns: Column<CustomerRowVM>[] = [
    {
      id: 'customer',
      header: t('col.customer'),
      priority: 1,
      mobile: 'title',
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('h-8 w-[3px] shrink-0 rounded-full', PS_CLASS[r.payState].bar)} aria-hidden />
          <div className="min-w-0">
            <Link href={`/customers/${r.id}/`} onClick={(e) => !(e.metaKey || e.ctrlKey) && e.preventDefault()} className="block max-w-[260px] truncate font-medium text-fg hover:text-primary" lang={locale}>
              {r.name}
            </Link>
            <span className="block max-w-[260px] truncate font-mono text-xs text-fg-tertiary">{r.code}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: t('col.status'),
      priority: 1,
      mobile: 'badges',
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <PayStateBadge state={r.payState} missed={r.missedCount} />
          <StatusBadges statuses={extraStatuses(r.statuses)} max={1} />
        </span>
      ),
    },
    {
      id: 'outstanding',
      header: t('col.outstanding'),
      align: 'end',
      priority: 1,
      sortKey: 'totalOutstanding',
      mobile: 'amount',
      cell: (r) => (
        <span className="inline-flex flex-col items-end">
          <MoneyText poisha={r.outstandingPoisha} className="font-medium" />
          {r.overduePoisha > 0 && <span className="text-xs text-st-overdue">{t('overdueAmount', { amount: formatMoney(r.overduePoisha) })}</span>}
          {r.pendingFieldPoisha > 0 && <MoneyText poisha={r.pendingFieldPoisha} pending className="text-xs" />}
        </span>
      ),
    },
    {
      id: 'daysOverdue',
      header: t('col.daysOverdue'),
      align: 'end',
      priority: 2,
      sortKey: 'daysOverdue',
      mobile: 'meta',
      cell: (r) => (r.daysOverdue > 0 ? <span className={cn('font-medium', r.daysOverdue > 30 ? 'text-st-overdue' : 'text-fg')}>{t('days', { n: formatNumber(r.daysOverdue) })}</span> : <span className="text-fg-tertiary">—</span>),
    },
    { id: 'installment', header: t('col.installment'), align: 'end', priority: 4, cell: (r) => (r.installmentPoisha != null ? <MoneyText poisha={r.installmentPoisha} /> : <span className="text-fg-tertiary">—</span>) },
    {
      id: 'invoices',
      header: t('col.invoices'),
      priority: 3,
      cell: (r) =>
        r.openInvoices && (r.openInvoices.installment || r.openInvoices.credit) ? (
          <span className="inline-flex flex-wrap gap-1 text-xs">
            {r.openInvoices.installment > 0 && <span className="rounded-xs bg-surface-hover px-1.5 py-0.5 text-fg-secondary">{t('openInv.installment', { n: formatNumber(r.openInvoices.installment) })}</span>}
            {r.openInvoices.credit > 0 && <span className="rounded-xs bg-info-bg px-1.5 py-0.5 text-info">{t('openInv.credit', { n: formatNumber(r.openInvoices.credit) })}</span>}
          </span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    { id: 'nextDue', header: t('col.nextDue'), priority: 3, mobile: 'meta', cell: (r) => (r.nextDue ? formatDate(r.nextDue, { withYear: false }) : <span className="text-fg-tertiary">—</span>) },
    {
      id: 'promise',
      header: t('col.promise'),
      priority: 4,
      cell: (r) => (r.openPromise ? <span className="tabular text-st-promised">{t('promiseOn', { date: formatDate(r.openPromise.date, { withYear: false }), amount: formatMoney(r.openPromise.amountPoisha) })}</span> : <span className="text-fg-tertiary">—</span>),
    },
    { id: 'assignee', header: t('col.assignee'), priority: 3, mobile: 'meta', cell: (r) => r.assigneeName ?? <span className="text-fg-tertiary">—</span> },
    {
      id: 'lastVisit',
      header: t('col.lastVisit'),
      priority: 4,
      cell: (r) =>
        r.lastVisitAt ? (
          <Tooltip content={formatDate(r.lastVisitAt)}>
            <span tabIndex={0}>{formatRelative(r.lastVisitAt)}</span>
          </Tooltip>
        ) : (
          <span className="text-fg-tertiary">{t('never')}</span>
        ),
    },
    { id: 'phone', header: t('col.phone'), priority: 5, mobile: 'subtitle', cell: (r) => <span className="tabular font-mono text-xs">{r.phone}</span> },
    {
      id: 'area',
      header: t('col.area'),
      priority: 5,
      cell: (r) => (
        <span className="inline-flex max-w-[220px] items-center gap-1 truncate text-fg-secondary">
          {!r.hasLocation && <MapPinOff className="size-3.5 shrink-0 text-warning" aria-label={t('locationMissing')} />}
          <span className="truncate" title={r.address}>{r.areaName ?? r.address}</span>
        </span>
      ),
    },
  ];

  const asOf = query.data?.items?.[0]?.erpFetchedAt;
  return (
    <>
      <PageHeader
        title={t('title')}
        asOf={asOf}
        actions={
          <Link href="/map/" className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-sm font-medium text-fg shadow-e1 hover:bg-surface-hover">
            <MapIcon className="size-4" aria-hidden />
            {t('map.open')}
          </Link>
        }
      >
        {query.data?.total != null && (
          <span className="tabular font-medium text-fg-secondary" data-testid="customer-total">
            {query.data.total >= 10_000 ? t('totalCapped', { n: formatNumber(10_000) }) : t('total', { n: formatNumber(query.data.total) })}
          </span>
        )}
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="sm:w-80" aria-label={t('search')} />
        <label className="flex shrink-0 items-center gap-2 text-sm text-fg-secondary sm:ms-auto">
          <span className="whitespace-nowrap">{t('sort.label')}</span>
          <Select value={sort} onChange={(e) => (pager.reset(), url.set({ sort: e.target.value === '-daysOverdue' ? null : e.target.value, cursor: null }))} className="h-9 w-56">
            {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
          </Select>
        </label>
      </div>
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Segmented
          label={t('invoiceKind.label')}
          value={kind}
          onChange={(v) => (pager.reset(), url.set({ kind: v === 'all' ? null : v, cursor: null }))}
          options={KINDS.map((k) => ({ value: k, label: t(`invoiceKind.${k}`) }))}
        />
        <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {FILTERS.map((f) => (
            <FilterChip key={f} selected={filters.includes(f)} onClick={() => toggleFilter(f)}>
              {t(`filters.${f}`)}
            </FilterChip>
          ))}
        </div>
      </div>
      <PayLegend
        selected={pay}
        counts={null}
        onToggle={(s) => (pager.reset(), url.set({ pay: pay.includes(s) ? pay.filter((x) => x !== s) : [...pay, s], cursor: null }))}
        onClear={() => (pager.reset(), url.set({ pay: null, cursor: null }))}
      />

      <DataTable
        tableId="customers"
        caption={t('title')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        activeRowKey={drawerId}
        selectable={canAssign}
        selection={picked}
        onSelectionChange={setPicked}
        bulkBar={
          <Button size="sm" variant="primary" onClick={() => setAssignOpen(true)}>
            <UserPlus className="size-3.5" aria-hidden />
            {ta('bulk.open')}
          </Button>
        }
        sort={sort}
        onSortChange={(s) => {
          const allowed = SORTS as readonly string[];
          const next = allowed.includes(s) ? s : allowed.includes(`-${s.replace('-', '')}`) ? `-${s.replace('-', '')}` : s.replace('-', '');
          pager.reset();
          url.set({ sort: allowed.includes(next) ? next : null, cursor: null });
        }}
        onRowClick={(r) => url.set({ drawer: `customer:${r.id}` }, { push: true })}
        pager={{
          page: pager.page,
          hasPrev: pager.hasPrev,
          hasNext: !!query.data?.nextCursor,
          onPrev: pager.prev,
          onNext: () => pager.next(query.data?.nextCursor),
          pageSize: limit,
          onPageSize: (n) => (pager.reset(), setLimit(n), url.set({ cursor: null })),
          total: query.data?.total,
        }}
        empty={
          <EmptyState
            icon={filters.length || pay.length || kind !== 'all' || qParam ? SearchX : Users}
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={(filters.length > 0 || pay.length > 0 || kind !== 'all' || !!qParam) && <Button size="sm" onClick={() => (setQ(''), url.set({ filter: null, pay: null, kind: null, q: null, cursor: null }))}>{t('clearFilters')}</Button>}
          />
        }
      />

      {canAssign && <BulkAssignDialog open={assignOpen} customerIds={[...picked]} onClose={() => setAssignOpen(false)} onDone={() => (setPicked(new Set()), void query.refetch())} />}
      <CustomerDrawer
        id={drawerId}
        onClose={() => url.set({ drawer: null })}
        footer={
          drawerId && (
            <Link href={`/customers/${drawerId}/`} className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-base font-medium text-primary-fg hover:bg-primary-hover">
              {t('openFull')}
              <ExternalLink className="size-4" aria-hidden />
            </Link>
          )
        }
      />
    </>
  );
}
