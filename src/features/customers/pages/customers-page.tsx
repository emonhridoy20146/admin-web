'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ExternalLink, MapPinOff, SearchX, Users } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatMoney, formatNumber, formatRelative } from '@/shared/lib/format';
import { listOf, oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/feedback';
import { FilterChip, Tooltip } from '@/shared/ui/primitives';
import { SearchInput, Select } from '@/shared/ui/form';
import { MoneyText } from '@/shared/ui/money';
import { StatusBadges } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { useCustomers, type CustomerQuery } from '../api/customers';
import { toCustomerRow, type CustomerRowVM } from '../model/customer-row';
import { CustomerDrawer } from '../components/customer-drawer';

const FILTERS = ['overdue', 'due_today', 'promised_today', 'bad_suggested', 'tagged_bad', 'no_location', 'unassigned', 'paid_up'] as const;
const SORTS = ['-daysOverdue', '-totalOutstanding', 'nextDueDate', 'name'] as const;

export function CustomersPage() {
  const { t } = useTranslation('customers');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const filters = listOf(url.getList('filter'), FILTERS);
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

  const params: Omit<CustomerQuery, 'branchId'> = { filter: filters.length ? filters : undefined, sort, q: qParam || undefined, cursor: cursor || undefined, limit };
  const query = useCustomers(params);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const rows = useMemo(() => query.data?.items?.map((c) => toCustomerRow(c, locale)), [query.data, locale]);
  const drawer = url.get('drawer');
  const drawerId = drawer.startsWith('customer:') ? drawer.slice(9) : null;

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
          <span className={cn('h-8 w-[3px] shrink-0 rounded-full', ['bg-transparent', 'bg-warning', 'bg-st-overdue', 'bg-st-tagged-bg'][r.urgency])} aria-hidden />
          <div className="min-w-0">
            <Link href={`/customers/${r.id}/`} onClick={(e) => !(e.metaKey || e.ctrlKey) && e.preventDefault()} className="block max-w-[260px] truncate font-medium text-fg hover:text-primary" lang={locale}>
              {r.name}
            </Link>
            <span className="block max-w-[260px] truncate font-mono text-xs text-fg-tertiary">{r.code}</span>
          </div>
        </div>
      ),
    },
    { id: 'status', header: t('col.status'), priority: 1, mobile: 'badges', cell: (r) => <StatusBadges statuses={r.statuses} /> },
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
          <span className="truncate">{r.address}</span>
        </span>
      ),
    },
  ];

  const asOf = query.data?.items?.[0]?.erpFetchedAt;
  return (
    <>
      <PageHeader title={t('title')} asOf={asOf}>
        {query.data?.total != null && <span>{t('subtitle')}</span>}
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
      <div className="scrollbar-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => (
          <FilterChip key={f} selected={filters.includes(f)} onClick={() => toggleFilter(f)}>
            {t(`filters.${f}`)}
          </FilterChip>
        ))}
      </div>

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
            icon={filters.length || qParam ? SearchX : Users}
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={(filters.length > 0 || !!qParam) && <Button size="sm" onClick={() => (setQ(''), url.set({ filter: null, q: null, cursor: null }))}>{t('clearFilters')}</Button>}
          />
        }
      />

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
