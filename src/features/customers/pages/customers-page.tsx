'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Map as MapIcon, MapPinOff, SearchX, UserPlus, Users } from 'lucide-react';
import { BulkAssignDialog } from '@/features/assignments';
import { useGate } from '@/shared/feature/useGate';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatMoney, formatNumber, formatRelative, formatDaySpan } from '@/shared/lib/format';
import { listOf, oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { pageCountOf, parsePage } from '@/shared/lib/pages';
import { EmptyState } from '@/shared/ui/feedback';
import { FilterChip, Segmented, Tooltip } from '@/shared/ui/primitives';
import { SearchInput, Select } from '@/shared/ui/form';
import { MoneyText } from '@/shared/ui/money';
import { ReturnedMark, StatusBadges } from '@/shared/ui/badge';
import { opensCustomer } from '@/shared/ui/status';
import { Button } from '@/shared/ui/button';
import { TagChip } from '@/shared/ui/tag-chip';
import { CUSTOMER_PAGE_SIZES, useCustomerPage, type CustomerPageSize, type CustomerQuery } from '../api/customers';
import { extraStatuses, toCustomerRow, type CustomerRowVM } from '../model/customer-row';
import { PAY_STATES, PS_CLASS } from '../model/pay-state';
import { CustomerDrawer } from '../components/customer-drawer';
import { PayLegend, PayStateBadge } from '../components/pay-state';
import { WorkMarks, WorkMarksLegend } from '../components/work-marks';

const FILTERS = ['overdue', 'due_today', 'promised_today', 'bad_suggested', 'tagged_bad', 'no_location', 'unassigned', 'paid_up'] as const;
const SORTS = ['-daysOverdue', '-totalOutstanding', 'nextDueDate', 'name'] as const;
const KINDS = ['all', 'installment', 'credit'] as const;
/** FR-W-047 (contract 1.29.0): who paid something this month and who did not. */
const PAID_MONTH = ['all', 'yes', 'no'] as const;

export function CustomersPage() {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const filters = listOf(url.getList('filter'), FILTERS);
  const pay = listOf(url.getList('pay'), PAY_STATES);
  const kind = oneOf(url.get('kind'), KINDS, 'all');
  const paidMonth = oneOf(url.get('paid'), PAID_MONTH, 'all');
  const sort = oneOf(url.get('sort'), SORTS, '-daysOverdue');
  const qParam = url.get('q');
  // FR-W-060: page and page size live in the link (a shared link opens on the same page)
  const page = parsePage(url.get('page'));
  const size = Number(oneOf(url.get('size'), CUSTOMER_PAGE_SIZES.map(String), '100')) as CustomerPageSize;
  const [q, setQ] = useState(qParam);
  useEffect(() => setQ(qParam), [qParam]);
  useEffect(() => {
    const id = setTimeout(() => q !== qParam && url.set({ q: q || null, page: null }), 300);
    return () => clearTimeout(id);
  }, [q, qParam, url]);

  const params: Omit<CustomerQuery, 'branchId' | 'cursor' | 'limit' | 'offset'> = {
    filter: filters.length ? filters : undefined,
    payState: pay.length ? pay : undefined,
    invoiceKind: kind === 'all' ? undefined : kind,
    paidThisMonth: paidMonth === 'all' ? undefined : paidMonth,
    sort,
    q: qParam || undefined,
  };
  const query = useCustomerPage(params, page, size);
  const total = query.data?.total;
  const pageCount = total != null ? pageCountOf(total, size) : undefined;
  const goPage = (n: number) => {
    url.set({ page: n > 1 ? String(n) : null }, { push: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const rows = useMemo(() => query.data?.items?.map((c) => toCustomerRow(c, locale)), [query.data, locale]);
  const drawer = url.get('drawer');
  const drawerId = drawer.startsWith('customer:') ? drawer.slice(9) : null;
  const gate = useGate();
  const canAssign = gate.can('assignment.manage') && gate.flag('module.assignments');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const { t: ta } = useTranslation('assignments');

  const toggleFilter = (f: string) => {
    url.set({ filter: filters.includes(f as never) ? filters.filter((x) => x !== f) : [...filters, f], page: null });
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
            <span className="flex min-w-0 items-center gap-1.5">
              {opensCustomer(r.item) ? (
                <Link href={`/customers/${r.id}/`} onClick={(e) => !(e.metaKey || e.ctrlKey) && e.preventDefault()} className="block max-w-[260px] min-w-0 truncate font-medium text-fg hover:text-primary" lang={locale}>
                  {r.name}
                </Link>
              ) : (
                // FR-W-074: an only-returned customer does not open, so its name is not a link
                <span className="block max-w-[260px] min-w-0 truncate font-medium text-fg" lang={locale} data-testid="customer-name">{r.name}</span>
              )}
              <TagChip look={r.tagLook} />
            </span>
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
          {/* FR-W-074: returned invoices are shown, never counted; an only-returned row keeps its marker but does not open (owner 2026-11-26) */}
          <ReturnedMark of={r.item} />
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
      cell: (r) => (r.daysOverdue > 0 ? <span className={cn('font-medium', r.daysOverdue > 30 ? 'text-st-overdue' : 'text-fg')}>{t('days', { n: formatDaySpan(r.daysOverdue) })}</span> : <span className="text-fg-tertiary">—</span>),
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
            {r.invoiceTotal != null && r.invoiceTotal > r.openInvoices.installment + r.openInvoices.credit && <span className="px-0.5 py-0.5 text-fg-tertiary">{t('invTotal', { n: formatNumber(r.invoiceTotal) })}</span>}
          </span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    // FR-W-037: what was done with the customer this month, shown in every filter
    { id: 'marks', header: t('marks.col'), priority: 2, mobile: 'badges', cell: (r) => <WorkMarks c={r.item} className="ms-0 mt-1 sm:mt-0" /> },
    { id: 'nextDue', header: t('col.nextDue'), priority: 3, mobile: 'meta', cell: (r) => (r.nextDue ? formatDate(r.nextDue, { withYear: false }) : <span className="text-fg-tertiary">—</span>) },
    {
      id: 'promise',
      header: t('col.promise'),
      priority: 4,
      cell: (r) =>
        r.openPromise ? (
          <span className="tabular text-st-promised">
            {t('promiseOn', { date: formatDate(r.openPromise.date, { withYear: false }), amount: formatMoney(r.openPromise.amountPoisha) })}
            {r.openPromise.byName && <span className="block text-xs text-fg-tertiary">{t('who.promisedBy', { name: r.openPromise.byName })}</span>}
          </span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    { id: 'assignee', header: t('col.assignee'), priority: 3, mobile: 'meta', cell: (r) => r.assigneeName ?? <span className="text-fg-tertiary">—</span> },
    {
      id: 'lastVisit',
      header: t('col.lastVisit'),
      priority: 4,
      cell: (r) =>
        r.lastVisitAt ? (
          <Tooltip content={formatDate(r.lastVisitAt)}>
            <span tabIndex={0}>
              {formatRelative(r.lastVisitAt)}
              {r.lastVisitByName && <span className="block text-xs text-fg-tertiary">{t('who.by', { name: r.lastVisitByName })}</span>}
            </span>
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
        print
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
            {t('total', { n: formatNumber(query.data.total) })}
          </span>
        )}
        {query.data?.invoiceTotals && (
          <span className="tabular font-medium text-fg-secondary" data-testid="invoice-totals">
            {t('invoiceTotals', { total: formatNumber(query.data.invoiceTotals.total ?? 0), open: formatNumber(query.data.invoiceTotals.open ?? 0) })}
          </span>
        )}
        <span>{t('subtitle')}</span>
      </PageHeader>

      {/* One filter panel: find and order on the first line, narrow down on the second, the two legends last. */}
      <div className="mb-3 rounded-lg border border-line bg-surface shadow-e1 print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-col gap-2.5 p-3 lg:flex-row lg:flex-wrap lg:items-center print:p-0">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="lg:w-72" aria-label={t('search')} />
          <Segmented
            className="shrink-0"
            label={t('invoiceKind.label')}
            value={kind}
            onChange={(v) => (url.set({ kind: v === 'all' ? null : v, page: null }))}
            options={KINDS.map((k) => ({ value: k, label: t(`invoiceKind.${k}`) }))}
          />
          <Segmented
            className="shrink-0"
            label={t('paidMonth.label')}
            value={paidMonth}
            onChange={(v) => (url.set({ paid: v === 'all' ? null : v, page: null }))}
            options={PAID_MONTH.map((k) => ({ value: k, label: t(`paidMonth.${k}`) }))}
          />
        </div>
        {/* chips and the sort share one row: the sort sits at the end and wraps under the chips only when they fill it */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5 print:border-0 print:p-0">
          {FILTERS.map((f) => (
            <FilterChip key={f} selected={filters.includes(f)} onClick={() => toggleFilter(f)}>
              {t(`filters.${f}`)}
            </FilterChip>
          ))}
          <label className="ms-auto flex shrink-0 items-center gap-2 text-sm text-fg-secondary" data-testid="customer-sort">
            <span className="whitespace-nowrap">{t('sort.label')}</span>
            <Select value={sort} onChange={(e) => url.set({ sort: e.target.value === '-daysOverdue' ? null : e.target.value, page: null })} className="h-8 w-auto max-w-52 rounded-full py-0 pe-8 text-sm">
              {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
            </Select>
          </label>
        </div>
        <div className="space-y-2 border-t border-line bg-surface-subtle/60 px-3 py-2.5 [&>div]:mb-0 print:border-0 print:bg-transparent print:p-0">
          <PayLegend
            selected={pay}
            counts={null}
            onToggle={(s) => (url.set({ pay: pay.includes(s) ? pay.filter((x) => x !== s) : [...pay, s], page: null }))}
            onClear={() => (url.set({ pay: null, page: null }))}
          />
          <WorkMarksLegend />
        </div>
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
        rowBorderClass={(r) => r.tagLook?.className}
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
                url.set({ sort: allowed.includes(next) ? next : null, page: null });
        }}
        onRowClick={(r) => url.set({ drawer: `customer:${r.id}` }, { push: true })}
        // FR-W-074 (owner decision 2026-11-26, as the staff app): an only-returned customer's row and card do not open
        rowInert={(r) => (opensCustomer(r.item) ? null : tc('status.only_returned_hint'))}
        pager={{
          page,
          hasPrev: page > 1,
          hasNext: !!query.data?.hasNext,
          onPrev: () => goPage(page - 1),
          onNext: () => goPage(page + 1),
          onPage: goPage,
          pageCount,
          pageSize: size,
          pageSizes: [...CUSTOMER_PAGE_SIZES],
          onPageSize: (n) => url.set({ size: n === 100 ? null : String(n), page: null }),
          total,
          rowsOnPage: query.isPlaceholderData ? undefined : rows?.length,
          busy: query.isFetching && query.isPlaceholderData,
        }}
        empty={
          <EmptyState
            icon={filters.length || pay.length || kind !== 'all' || paidMonth !== 'all' || qParam ? SearchX : Users}
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={(filters.length > 0 || pay.length > 0 || kind !== 'all' || paidMonth !== 'all' || !!qParam) && <Button size="sm" onClick={() => (setQ(''), url.set({ filter: null, pay: null, kind: null, paid: null, q: null, page: null }))}>{t('clearFilters')}</Button>}
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
