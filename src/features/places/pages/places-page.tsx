'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Inbox, Plus } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatRelative, pickText } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { boundsOf, branchPoint, DEFAULT_POINT } from '@/shared/map/geo';
import { MapView } from '@/shared/map/map-view';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { SearchInput, Select } from '@/shared/ui/form';
import { Segmented } from '@/shared/ui/primitives';
import { useMoveRequestBadge, usePlace, usePlaces, type Place } from '../api/places';
import { isPlaceIcon, PLACE_ICONS, placeMarkers } from '../model/places';
import { PlaceKind } from '../components/place-icon';
import { PlaceDialog } from '../components/place-dialog';
import { PlaceDrawer } from '../components/place-drawer';

const SHOW = ['active', 'deleted'] as const;

/** FR-PLC-001..006: every place of the branch as a list and on a map; add, change, move, delete. */
export function PlacesPage() {
  const { t } = useTranslation('places');
  const locale = useUi((s) => s.locale);
  const branchId = useUi((s) => s.branchId);
  useUi((s) => s.bnDigits);
  const canCreate = useCan('place.create');
  const canManage = useCan('place.manage');
  const url = useUrlState();
  const branches = useBranches();
  const status = canManage ? oneOf(url.get('status'), SHOW, 'active') : 'active';
  const iconParam = url.get('icon');
  const icon = isPlaceIcon(iconParam) ? iconParam : undefined;
  const cursor = url.get('cursor');
  const urlQ = url.get('q');
  const [search, setSearch] = useState(urlQ);
  const [limit, setLimit] = useState(25);
  const [creating, setCreating] = useState(false);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const q = usePlaces({ status, icon, q: urlQ || undefined, cursor: cursor || undefined, limit });
  const moves = useMoveRequestBadge();

  useEffect(() => {
    const h = setTimeout(() => search !== urlQ && (pager.reset(), url.set({ q: search || null, cursor: null })), 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openId = url.get('drawer');
  const items = useMemo(() => q.data?.items ?? [], [q.data?.items]);
  const inList = items.find((x) => x.id === openId) ?? null;
  const one = usePlace(openId, !inList && !q.isLoading);
  const open = inList ?? one.data ?? null;
  const show = (x: Place) => url.set({ drawer: x.id }, { push: true });
  const branchName = (id: string) => pickText(branches.data?.find((b) => b.id === id)?.name, locale) || id;
  const map = useMemo(() => placeMarkers(items, { selectedId: openId, movedTitle: (p) => t('map.requestedPoint', { name: p.name }) }), [items, openId, t]);
  const fit = useMemo(() => boundsOf(items.filter((p) => p.status === 'active').map((p) => p.location)), [items]);
  const center = branchPoint(branches.data, branchId || undefined) ?? DEFAULT_POINT;

  const columns: Column<Place>[] = [
    {
      id: 'name',
      header: t('col.name'),
      priority: 1,
      mobile: 'title',
      cell: (x) => (
        <button type="button" onClick={() => show(x)} className="block max-w-[320px] text-start">
          <span className="block truncate font-medium text-fg hover:text-primary" lang={locale}>{x.name}</span>
          {x.note && <span className="block truncate text-xs text-fg-tertiary" lang={locale}>{x.note}</span>}
        </button>
      ),
    },
    { id: 'icon', header: t('col.icon'), priority: 1, mobile: 'meta', cell: (x) => <PlaceKind icon={x.icon} /> },
    {
      id: 'state',
      header: t('col.state'),
      priority: 2,
      mobile: 'badges',
      cell: (x) => (x.status === 'deleted' ? <Badge tone="danger">{t('status.deleted')}</Badge> : x.pendingMove ? <Badge tone="warning">{t('status.movePending')}</Badge> : <Badge tone="info">{t('status.active')}</Badge>),
    },
    { id: 'by', header: t('col.addedBy'), priority: 3, cell: (x) => <span lang={locale}>{x.createdBy.name}</span> },
    { id: 'branch', header: t('col.branch'), priority: 4, cell: (x) => <span className="whitespace-nowrap text-fg-secondary" lang={locale}>{branchName(x.branchId)}</span> },
    { id: 'updated', header: t('col.updated'), priority: 4, cell: (x) => <span className="whitespace-nowrap text-fg-secondary">{formatRelative(x.updatedAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Link href="/places/move-requests/" className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-sm font-medium text-fg shadow-e1 hover:bg-surface-hover">
                <Inbox className="size-4" aria-hidden />
                {t('moves.link')}
                {moves ? <Badge tone="warning">{moves}</Badge> : null}
              </Link>
            )}
            {canCreate && (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                {t('new')}
              </Button>
            )}
          </div>
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} aria-label={t('search')} className="sm:w-80" />
        <Select aria-label={t('col.icon')} value={icon ?? ''} onChange={(e) => (pager.reset(), url.set({ icon: e.target.value || null, cursor: null }))} className="h-9 sm:w-52">
          <option value="">{t('allIcons')}</option>
          {PLACE_ICONS.map((ic) => (
            <option key={ic} value={ic}>{t(`icon.${ic}`)}</option>
          ))}
        </Select>
        {canManage && (
          <Segmented label={t('show')} value={status} onChange={(v) => (pager.reset(), url.set({ status: v === 'active' ? null : v, cursor: null, drawer: null }))} options={SHOW.map((s) => ({ value: s, label: t(`show_${s}`) }))} />
        )}
      </div>

      {/* The map above the list, both full width: side by side the table scrolled sideways at 1440 px. */}
      <div className="flex flex-col gap-4">
        {status === 'active' && (
          <div className="h-[40vh] min-h-72">
            <MapView label={t('map.label')} center={center} zoom={14} markers={map.markers} lines={map.lines} fit={fit} onMarkerClick={(id) => url.set({ drawer: id }, { push: true })} locate />
          </div>
        )}
        <DataTable
          tableId="places"
          caption={t('title')}
          columns={columns}
          rows={q.data?.items}
          rowKey={(x) => x.id}
          loading={q.isLoading}
          error={q.error}
          onRetry={() => q.refetch()}
          onRowClick={show}
          activeRowKey={openId || undefined}
          empty={t(status === 'deleted' ? 'empty.deleted' : 'empty.active')}
          pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!q.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(q.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n)) }}
        />
      </div>

      <PlaceDrawer place={open} onClose={() => url.set({ drawer: null })} />
      {canCreate && <PlaceDialog open={creating} onOpenChange={setCreating} canMove onDone={(x) => (pager.reset(), url.set({ status: null, cursor: null, drawer: x.id }, { push: true }))} />}
    </>
  );
}
