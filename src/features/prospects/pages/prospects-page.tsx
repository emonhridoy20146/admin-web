'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, SearchX, UserRoundSearch } from 'lucide-react';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatNumber, formatTime, pickText } from '@/shared/lib/format';
import { FEED_PRESETS } from '@/shared/lib/date-range';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { useBranches } from '@/features/shell';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { DateRangeFilter, useDateRange } from '@/shared/ui/date-range-filter';
import { StaffSelect } from '@/shared/ui/staff-select';
import { EmptyState } from '@/shared/ui/feedback';
import { SearchInput } from '@/shared/ui/form';
import { Segmented } from '@/shared/ui/primitives';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { useProspects, type Prospect } from '../api/prospects';
import { displayPhone, STATUS_TONE, STATUSES } from '../model/prospect';
import { ProspectDrawer } from '../components/prospect-drawer';
import { CreateProspectDialog } from '../components/prospect-dialogs';

const textLang = (s: string) => (/[ঀ-৿]/.test(s) ? 'bn' : 'en');

/**
 * FR-PRO-001 (field-api 1.45.0): possible customers staff met in the field or the office took down, newest first.
 * Filters (all in the link): when created (shared date filter, all time by default), status, who recorded it, search;
 * the branch is the global branch switcher. A row opens the drawer with the history and the next steps.
 */
export function ProspectsPage() {
  const { t } = useTranslation('prospects');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branchId = useUi((s) => s.branchId);
  const branches = useBranches();
  const url = useUrlState();
  const range = useDateRange({ presets: FEED_PRESETS, fallback: 'all', reset: ['cursor'] });
  const status = oneOf(url.get('status'), ['all', ...STATUSES] as const, 'all');
  const createdBy = url.get('staff');
  const qParam = url.get('q');
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const [q, setQ] = useState(qParam);
  useEffect(() => setQ(qParam), [qParam]);
  useEffect(() => {
    const h = setTimeout(() => q !== qParam && (pager.reset(), url.set({ q: q.trim() || null, cursor: null })), 300);
    return () => clearTimeout(h);
  }, [q, qParam, url, pager]);
  const list = useProspects({
    from: range.from || undefined,
    to: range.to || undefined,
    status: status === 'all' ? undefined : status,
    createdBy: createdBy || undefined,
    q: qParam || undefined,
    cursor: cursor || undefined,
    limit,
  });
  const drawerId = url.get('drawer') || null;
  const seed = list.data?.items.find((p) => p.id === drawerId) ?? null;
  const canCreate = useCan('prospect.create');
  const [createOpen, setCreateOpen] = useState(false);
  const branchName = useMemo(() => {
    const m = new Map((branches.data ?? []).map((b) => [b.id, pickText(b.name, locale) || b.code || '']));
    return (id: string) => m.get(id) ?? '';
  }, [branches.data, locale]);
  const filtered = status !== 'all' || !!createdBy || !!qParam || range.choice !== 'all';

  const columns: Column<Prospect>[] = [
    {
      id: 'name',
      header: t('col.name'),
      priority: 1,
      mobile: 'title',
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block max-w-[220px] truncate font-medium text-fg" lang={textLang(p.name)}>{p.name}</span>
          {!branchId && <span className="block text-xs text-fg-tertiary">{branchName(p.branchId)}</span>}
        </span>
      ),
    },
    { id: 'status', header: t('col.status'), priority: 1, mobile: 'badges', cell: (p) => <Badge tone={STATUS_TONE[p.status]}>{t(`status.${p.status}`)}</Badge> },
    {
      id: 'phones',
      header: t('col.phones'),
      priority: 2,
      mobile: 'subtitle',
      cell: (p) =>
        p.phones.length ? (
          <span className="tabular font-mono text-xs">
            {displayPhone(p.phones[0]!.number)}
            {p.phones.length > 1 && <span className="ms-1 font-sans text-fg-tertiary">+{formatNumber(p.phones.length - 1)}</span>}
          </span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
    { id: 'address', header: t('col.address'), priority: 3, mobile: 'meta', cell: (p) => (p.address ? <span className="block max-w-[240px] truncate text-fg-secondary" title={p.address} lang={textLang(p.address)}>{p.address}</span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'note', header: t('col.note'), priority: 4, cell: (p) => (p.note ? <span className="block max-w-[260px] truncate text-fg-secondary" title={p.note} lang={textLang(p.note)}>{p.note}</span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'createdBy', header: t('col.createdBy'), priority: 2, mobile: 'meta', cell: (p) => p.createdBy.name },
    {
      id: 'createdAt',
      header: t('col.createdAt'),
      priority: 2,
      mobile: 'meta',
      cell: (p) => (
        <span className="tabular whitespace-nowrap">
          {formatDate(p.createdAt, { withYear: false })} <span className="text-fg-tertiary">{formatTime(p.createdAt)}</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        print
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              {t('create.open')}
            </Button>
          ) : undefined
        }
      >
        {list.data?.total != null && <span className="tabular font-medium text-fg-secondary" data-testid="prospect-total">{t('total', { n: formatNumber(list.data.total) })}</span>}
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-3 rounded-lg border border-line bg-surface shadow-e1">
        <div className="flex flex-col gap-2.5 p-3 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} className="lg:w-72" />
          <DateRangeFilter value={range} onChange={(c, r) => (pager.reset(), range.set(c, r))} label={t('col.createdAt')} />
          <StaffSelect value={createdBy} onChange={(id) => (pager.reset(), url.set({ staff: id, cursor: null }))} label={t('col.createdBy')} className="lg:ms-auto" />
        </div>
        <div className="border-t border-line px-3 py-2.5">
          <Segmented
            label={t('col.status')}
            value={status}
            onChange={(v) => (pager.reset(), url.set({ status: v === 'all' ? null : v, cursor: null }))}
            options={(['all', ...STATUSES] as const).map((s) => ({ value: s, label: s === 'all' ? t('all') : t(`status.${s}`) }))}
          />
        </div>
      </div>

      <DataTable
        tableId="prospects"
        caption={t('title')}
        columns={columns}
        rows={list.data?.items}
        rowKey={(p) => p.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        activeRowKey={drawerId}
        onRowClick={(p) => url.set({ drawer: p.id }, { push: true })}
        empty={
          <EmptyState
            icon={filtered ? SearchX : UserRoundSearch}
            title={filtered ? t('emptyFiltered') : t('empty')}
            body={filtered ? undefined : t('emptyBody')}
            action={filtered ? <Button size="sm" onClick={() => (setQ(''), pager.reset(), url.set({ status: null, staff: null, q: null, range: null, from: null, to: null, cursor: null }))}>{t('clear')}</Button> : undefined}
          />
        }
        pager={{
          page: pager.page,
          hasPrev: pager.hasPrev,
          hasNext: !!list.data?.nextCursor,
          onPrev: pager.prev,
          onNext: () => pager.next(list.data?.nextCursor),
          pageSize: limit,
          onPageSize: (n) => (pager.reset(), setLimit(n), url.set({ cursor: null })),
          total: list.data?.total,
          rowsOnPage: list.data?.items.length,
        }}
      />

      <ProspectDrawer id={drawerId} seed={seed} onClose={() => url.set({ drawer: null })} onOpen={(id) => url.set({ drawer: id }, { push: true })} />
      <CreateProspectDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => url.set({ drawer: id }, { push: true })} />
    </>
  );
}
