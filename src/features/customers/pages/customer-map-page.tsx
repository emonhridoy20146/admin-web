'use client';
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { List, ZoomIn } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber } from '@/shared/lib/format';
import { listOf, useUrlState } from '@/shared/lib/url-state';
import { bboxParam, type Bounds } from '@/shared/map/geo';
import { MapView, type MapCluster, type MapMarker, type MapViewState } from '@/shared/map/map-view';
import { PageHeader } from '@/shared/ui/page';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { FilterChip } from '@/shared/ui/primitives';
import { MoneyText } from '@/shared/ui/money';
import { StatusBadge } from '@/shared/ui/badge';
import { useCustomerMap } from '../api/customers';
import { MAP_FILTERS, PIN_ZOOM, statusToken } from '../model/map';
import { CustomerDrawer } from '../components/customer-drawer';

const LIST_MAX = 60;

export function CustomerMapPage() {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branchId = useUi((s) => s.branchId);
  const branches = useBranches();
  const url = useUrlState();
  const filters = listOf(url.getList('filter'), MAP_FILTERS);
  const [view, setView] = useState<MapViewState | null>(null);
  const [fit, setFit] = useState<Bounds | null>(null);
  const q = useCustomerMap(view ? bboxParam(view.bounds) : null, view?.zoom ?? PIN_ZOOM, filters.join(','));
  const drawer = url.get('drawer');
  const drawerId = drawer.startsWith('customer:') ? drawer.slice(9) : null;

  const branch = branches.data?.find((b) => b.id === branchId) ?? branches.data?.[0];
  const center = useMemo(() => ({ lat: branch?.lat ?? 22.7022, lng: branch?.lng ?? 90.3696 }), [branch?.lat, branch?.lng]);

  const pins = useMemo(() => q.data?.pins ?? [], [q.data?.pins]);
  const markers: MapMarker[] = useMemo(
    () => pins.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id!, lat: p.lat!, lng: p.lng!, token: statusToken(p.tagged ? 'tagged_bad' : p.status), title: p.name ?? '', strong: p.id === drawerId })),
    [pins, drawerId],
  );
  const clusters: MapCluster[] = useMemo(
    () => (q.data?.clusters ?? []).filter((c) => c.lat != null && c.lng != null).map((c) => ({ lat: c.lat!, lng: c.lng!, count: c.count ?? 0, token: statusToken(c.worstStatus), label: formatNumber(c.count ?? 0) })),
    [q.data?.clusters],
  );
  const total = clusters.reduce((s, c) => s + c.count, 0);
  const onView = useCallback((v: MapViewState) => setView(v), []);
  const open = useCallback((id: string) => url.set({ drawer: `customer:${id}` }, { push: true }), [url]);
  const zoomTo = useCallback((c: { lat: number; lng: number }) => setFit({ minLat: c.lat - 0.012, maxLat: c.lat + 0.012, minLng: c.lng - 0.016, maxLng: c.lng + 0.016 }), []);
  const sorted = useMemo(() => [...pins].sort((a, b) => (b.outstandingPoisha ?? 0) - (a.outstandingPoisha ?? 0)), [pins]);

  return (
    <>
      <PageHeader
        title={t('map.title')}
        actions={
          <Link href="/customers/" className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-sm font-medium text-fg shadow-e1 hover:bg-surface-hover">
            <List className="size-4" aria-hidden />
            {t('map.toList')}
          </Link>
        }
      >
        <span>{t('map.subtitle')}</span>
      </PageHeader>

      <div className="scrollbar-thin -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {MAP_FILTERS.map((f) => (
          <FilterChip key={f} selected={filters.includes(f)} onClick={() => url.set({ filter: filters.includes(f) ? filters.filter((x) => x !== f) : [...filters, f] })}>
            {t(`filters.${f}`)}
          </FilterChip>
        ))}
      </div>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[52vh] min-h-80 lg:h-[calc(100vh-15rem)]">
          <MapView label={t('map.title')} center={center} zoom={13} markers={markers} clusters={clusters} fit={fit} onView={onView} onMarkerClick={open} onClusterClick={zoomTo} />
        </div>

        <section aria-label={t('map.inView')} className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-e1 lg:h-[calc(100vh-15rem)]">
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-fg">{t('map.inView')}</h2>
            <span className="tabular text-xs text-fg-tertiary" aria-live="polite">
              {q.isLoading || !view ? '' : clusters.length ? t('map.nCustomers', { n: formatNumber(total) }) : t('map.nCustomers', { n: formatNumber(pins.length) })}
            </span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {q.isLoading || !view ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : clusters.length ? (
              <div className="p-4">
                <p className="mb-3 flex items-start gap-2 text-sm text-fg-secondary">
                  <ZoomIn className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t('map.zoomHint')}
                </p>
                <ul className="space-y-1.5">
                  {[...clusters].sort((a, b) => b.count - a.count).slice(0, 12).map((c, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => zoomTo(c)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-line px-3 py-2 text-start text-sm hover:bg-surface-hover">
                        <span className="font-medium text-fg">{t('map.cluster', { n: formatNumber(i + 1) })}</span>
                        <span className="tabular text-fg-secondary">{t('map.nCustomers', { n: c.label })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : !sorted.length ? (
              <p className="px-4 py-10 text-center text-sm text-fg-tertiary">{t('map.empty')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {sorted.slice(0, LIST_MAX).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => open(p.id!)} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-start hover:bg-surface-hover">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg" lang={locale}>{p.name}</span>
                        <span className="mt-0.5 block"><StatusBadge status={p.tagged ? 'tagged_bad' : (p.status ?? 'current')} /></span>
                      </span>
                      <MoneyText poisha={p.outstandingPoisha ?? 0} className="shrink-0 text-sm font-medium" />
                    </button>
                  </li>
                ))}
                {sorted.length > LIST_MAX && <li className="px-4 py-3 text-center text-xs text-fg-tertiary">{t('map.more', { n: formatNumber(sorted.length - LIST_MAX) })}</li>}
              </ul>
            )}
          </div>
          <footer className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-fg-secondary">
            {(['overdue', 'due_today', 'promised_today', 'current', 'paid_up', 'tagged_bad'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: `var(${statusToken(s)})` }} aria-hidden />
                {tc(`status.${s}`)}
              </span>
            ))}
          </footer>
        </section>
      </div>

      <CustomerDrawer
        id={drawerId}
        onClose={() => url.set({ drawer: null })}
        footer={
          drawerId ? (
            <Link href={`/customers/${drawerId}/`} className="ms-auto inline-flex h-9 items-center rounded-sm px-3 text-sm font-medium text-primary hover:bg-surface-hover">{t('openFull')}</Link>
          ) : undefined
        }
      />
    </>
  );
}
