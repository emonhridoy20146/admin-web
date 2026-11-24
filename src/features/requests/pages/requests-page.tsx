'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox, Plus, X } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useCan, useSession } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatRelative, pickText } from '@/shared/lib/format';
import { FEED_PRESETS } from '@/shared/lib/date-range';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { EmptyState } from '@/shared/ui/feedback';
import { SearchInput, Select } from '@/shared/ui/form';
import { Segmented } from '@/shared/ui/primitives';
import { StaffSelect } from '@/shared/ui/staff-select';
import { DateRangeFilter, useDateRange } from '@/shared/ui/date-range-filter';
import { useRequest, useRequests, useRequestTotal, type Request, type RequestQuery } from '../api/requests';
import { QUEUES, queueQuery, myQueue, STATUS_FILTERS, statusQuery, type Me, type QueueTab, type StatusFilter } from '../model/requests';
import { PriorityBadge, RequestStatusBadge, WhereNow } from '../components/request-badges';
import { RequestDrawer } from '../components/request-drawer';
import { CreateRequestDialog } from '../components/request-dialogs';

/**
 * FR-W-070 (master FR-REQ-001..006, contract 1.48.0): the requests inbox. Queue tabs with counts, filters (date, status,
 * priority, who sent it; the branch is the header's branch switcher), a drawer with the whole timeline and the actions.
 */
export function RequestsPage() {
  const { t } = useTranslation('requests');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const meId = useSession((s) => s.user?.id ?? '');
  const me: Me = { id: meId, canManage: useCan('request.manage'), canImportant: useCan('request.important.manage') };
  const canCreate = useCan('request.create');
  const branches = useBranches();

  const tab: QueueTab = oneOf(url.get('queue'), QUEUES, 'mine');
  const status: StatusFilter = oneOf(url.get('status'), STATUS_FILTERS, 'active');
  const priority = oneOf(url.get('priority'), ['', 'normal', 'important'] as const, '');
  const staff = url.get('staff');
  const withPerson = url.get('where') === 'assignee';
  const urlQ = url.get('q');
  const cursor = url.get('cursor');
  const [search, setSearch] = useState(urlQ);
  const [limit, setLimit] = useState(25);
  const [creating, setCreating] = useState(false);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const range = useDateRange({ presets: FEED_PRESETS, fallback: 'all', reset: ['cursor'] });

  useEffect(() => {
    const h = setTimeout(() => search !== urlQ && (pager.reset(), url.set({ q: search || null, cursor: null })), 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // the filters every tab shares; the tab adds its queue
  const shared: Omit<RequestQuery, 'branchId'> = {
    from: range.from || undefined,
    to: range.to || undefined,
    status: statusQuery(status),
    priority: priority || undefined,
    createdBy: staff || undefined,
    q: urlQ || undefined,
    ...(withPerson ? { queue: 'assignee' as const } : {}),
  };
  const q = useRequests({ ...shared, ...queueQuery(tab, me), cursor: cursor || undefined, limit });
  // counts per tab, for the same filters (one row asked for each; the server's total is the count)
  const totals: Record<QueueTab, number | undefined> = {
    mine: useRequestTotal({ ...shared, ...queueQuery('mine', me) }, !!meId),
    area_manager: useRequestTotal({ ...shared, ...queueQuery('area_manager', me) }, !!meId),
    super_admin: useRequestTotal({ ...shared, ...queueQuery('super_admin', me) }, !!meId),
    assigned: useRequestTotal({ ...shared, ...queueQuery('assigned', me) }, !!meId),
    all: useRequestTotal({ ...shared, ...queueQuery('all', me) }, !!meId),
  };

  // ⌘K "New request" opens the form (`?new=1`)
  const askNew = url.get('new') === '1';
  useEffect(() => {
    if (askNew && canCreate) {
      setCreating(true);
      url.set({ new: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askNew, canCreate]);

  const openId = url.get('drawer');
  const inList = q.data?.items.find((x) => x.id === openId) ?? null;
  const one = useRequest(openId);
  // the single read keeps the open drawer fresh after an action; the row shows at once while it loads
  const open = one.data ?? inList ?? null;
  const show = (r: Request) => url.set({ drawer: r.id }, { push: true });
  const reset = (patch: Record<string, string | null>) => (pager.reset(), url.set({ ...patch, cursor: null }));
  const branchName = (id: string) => pickText(branches.data?.find((b) => b.id === id)?.name, locale) || id;

  const columns: Column<Request>[] = [
    {
      id: 'title', header: t('col.title'), priority: 1, mobile: 'title',
      cell: (r) => (
        <button type="button" onClick={() => show(r)} className="block max-w-[380px] text-start">
          <span className="block truncate font-medium text-fg hover:text-primary" lang={locale}>{r.title}</span>
          <span className="block truncate text-xs text-fg-tertiary" lang={locale}>{t(`type.${r.type}`, { defaultValue: r.type })} · {r.body}</span>
        </button>
      ),
    },
    { id: 'priority', header: t('col.priority'), priority: 2, mobile: 'badges', cell: (r) => <PriorityBadge priority={r.priority} /> },
    { id: 'status', header: t('col.status'), priority: 1, mobile: 'badges', cell: (r) => <RequestStatusBadge status={r.status} /> },
    { id: 'where', header: t('col.where'), priority: 2, mobile: 'meta', cell: (r) => <WhereNow r={r} /> },
    {
      id: 'from', header: t('col.from'), priority: 1, mobile: 'subtitle',
      cell: (r) => (
        <span className="inline-flex flex-col">
          <span lang={locale}>{r.createdBy.name}</span>
          <span className="tabular whitespace-nowrap text-xs text-fg-tertiary">{formatDateTime(r.createdAt)}</span>
        </span>
      ),
    },
    { id: 'branch', header: t('col.branch'), priority: 3, cell: (r) => <span className="whitespace-nowrap text-fg-secondary" lang={locale}>{branchName(r.branchId)}</span> },
    { id: 'updated', header: t('col.updated'), priority: 4, cell: (r) => <span className="whitespace-nowrap text-fg-secondary">{formatRelative(r.updatedAt ?? r.createdAt)}</span> },
  ];

  const statusCount = (s: StatusFilter) => {
    const c = q.data?.counts;
    if (!c) return undefined;
    if (s === 'any') return Object.values(c).reduce((a, n) => a + n, 0);
    if (s === 'active') return c.open + c.in_progress + c.forwarded + c.reopened;
    return c[s];
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        print
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              {t('new')}
            </Button>
          ) : undefined
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3">
        <Segmented
          label={t('queues')}
          value={tab}
          onChange={(v) => reset({ queue: v === 'mine' ? null : v, drawer: null })}
          options={QUEUES.map((x) => ({ value: x, label: t(`queue.${x}`), count: totals[x] }))}
        />
        {tab === 'mine' && <p className="text-xs text-fg-tertiary">{myQueue(me) ? t('queueHelp.mine') : t('queueHelp.mineSent')}</p>}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <DateRangeFilter className="col-span-2" value={range} onChange={(c, r) => (pager.reset(), range.set(c, r))} label={t('when')} />
          <Select aria-label={t('statusFilter')} value={status} onChange={(e) => reset({ status: e.target.value === 'active' ? null : e.target.value })} className="h-9 w-full sm:w-44">
            {STATUS_FILTERS.map((s) => {
              const n = statusCount(s);
              return <option key={s} value={s}>{t(`status.${s}`)}{n != null ? ` (${n})` : ''}</option>;
            })}
          </Select>
          <Select aria-label={t('priority.label')} value={priority} onChange={(e) => reset({ priority: e.target.value || null })} className="h-9 w-full sm:w-40">
            <option value="">{t('priority.all')}</option>
            <option value="normal">{t('priority.normal')}</option>
            <option value="important">{t('priority.important')}</option>
          </Select>
          <div className="col-span-2 sm:w-56">
            <StaffSelect className="w-full sm:w-56" label={t('staff')} value={staff} onChange={(id) => reset({ staff: id })} />
          </div>
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} aria-label={t('search')} className="col-span-2 sm:w-64" />
        </div>
        {withPerson && (
          <div>
            <Badge tone="info" icon={false} className="gap-2">
              {t('withPerson')}
              <button type="button" onClick={() => reset({ where: null })} aria-label={t('clear')} className="rounded-full hover:bg-info/10"><X className="size-3.5" aria-hidden /></button>
            </Badge>
          </div>
        )}
      </div>

      <DataTable
        tableId="requests"
        caption={t('title')}
        columns={columns}
        rows={q.data?.items}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={show}
        activeRowKey={openId || undefined}
        pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!q.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(q.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n), url.set({ cursor: null })) }}
        empty={<EmptyState icon={Inbox} title={t('empty.title')} body={tab === 'mine' && status === 'active' ? t('empty.mine') : t('empty.body')} />}
      />

      <RequestDrawer r={openId ? open : null} me={me} onClose={() => url.set({ drawer: null })} />
      <CreateRequestDialog open={creating} onOpenChange={setCreating} onCreated={(r) => url.set({ drawer: r.id }, { push: true })} />
    </>
  );
}
