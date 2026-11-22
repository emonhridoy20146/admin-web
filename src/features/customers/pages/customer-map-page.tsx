'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { List, ZoomIn } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useMapLayers } from '@/shared/feature/map-layers';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber } from '@/shared/lib/format';
import { listOf, oneOf, useUrlState } from '@/shared/lib/url-state';
import { bboxParam, boxAround, branchPoint, centerOf, DEFAULT_VIEW, parseViewpoint, viewpointParam, type Bounds, type MapViewpoint } from '@/shared/map/geo';
import { MapView, type MapCluster, type MapMarker, type MapViewState } from '@/shared/map/map-view';
import { branchMarkers, isBranchMarker } from '@/shared/map/branch-markers';
import { PinIcon } from '@/shared/map/pin-icon';
import { PageHeader } from '@/shared/ui/page';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { FilterChip, Segmented } from '@/shared/ui/primitives';
import { MoneyText } from '@/shared/ui/money';
import { useCustomerMap } from '../api/customers';
import { MAP_FILTERS, PIN_ZOOM } from '../model/map';
import { isPayState, PAY_STATES, PS_CLASS, payLook, payRank, payStateOf, psToken, type PayState } from '../model/pay-state';
import { CustomerDrawer } from '../components/customer-drawer';
import { payLabel, PayLegend, PayStateBadge } from '../components/pay-state';

const LIST_MAX = 60;
const KINDS = ['all', 'installment', 'credit'] as const;
type Start = MapViewpoint;

/** Keeps the map's place in the address bar without a router round trip (it changes on every pan). */
function writeViewpoint(at: string) {
  const sp = new URLSearchParams(window.location.search);
  if (sp.get('at') === at) return;
  sp.set('at', at);
  // Next.js syncs its router with a native replaceState when the state passed is not its own (null)
  window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`);
}

export function CustomerMapPage() {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branchId = useUi((s) => s.branchId);
  const hydrated = useUi((s) => s.hydrated);
  const branches = useBranches();
  const url = useUrlState();
  const filters = listOf(url.getList('filter'), MAP_FILTERS);
  const pay = listOf(url.getList('pay'), PAY_STATES);
  const kind = oneOf(url.get('kind'), KINDS, 'all');
  const [view, setView] = useState<MapViewState | null>(null);
  const [fit, setFit] = useState<Bounds | MapViewpoint | null>(null);
  const q = useCustomerMap(view ? bboxParam(view.bounds) : null, view?.zoom ?? PIN_ZOOM, { filter: filters, payState: pay, invoiceKind: kind === 'all' ? undefined : kind });
  const drawer = url.get('drawer');
  const drawerId = drawer.startsWith('customer:') ? drawer.slice(9) : null;
  const fmt = useCallback((n: number) => formatNumber(n), []);
  // Layers of other features (map places, FR-PLC-001): each loads its own markers and opens its own drawer, kept in the link.
  const hiddenLayers = url.getList('hide');
  const onLayerOpen = useCallback((id: string | null) => url.set({ drawer: id }, id ? { push: true } : undefined), [url]);
  const host = useMapLayers({ view, hidden: hiddenLayers, open: drawer, onOpen: onLayerOpen });
  const layers = host.layers;
  const openLayer = host.open;

  // Where the map opens: the view kept in the link (reload, Back, a shared link), else the chosen branch's point,
  // else the default view (Galachipa, zoom 12). Decided once, after the branches are known, so it never jumps back later.
  const [start, setStart] = useState<Start | null>(null);
  const lastBranch = useRef(branchId);
  useEffect(() => {
    if (start || !hydrated || branches.isPending) return;
    const home = branchPoint(branches.data, branchId);
    lastBranch.current = branchId;
    setStart(parseViewpoint(url.get('at')) ?? (home ? { center: home, zoom: PIN_ZOOM } : DEFAULT_VIEW));
  }, [start, hydrated, branches.isPending, branches.data, branchId, url]);
  // The user moves the map wherever they like; it only moves by itself when they pick another branch.
  useEffect(() => {
    if (!start || lastBranch.current === branchId) return;
    lastBranch.current = branchId;
    const home = branchPoint(branches.data, branchId);
    setFit(home ? boxAround(home, 3) : DEFAULT_VIEW);
  }, [start, branchId, branches.data]);

  const pins = useMemo(() => q.data?.pins ?? [], [q.data?.pins]);
  const markers: MapMarker[] = useMemo(
    () =>
      pins
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => {
          const s = payStateOf(p);
          return { id: p.id!, lat: p.lat!, lng: p.lng!, token: psToken(s, 'pin'), title: `${p.name ?? ''} · ${payLabel(t, s, p.missedCount)}`, strong: p.id === drawerId, pin: payLook(s, p.missedCount, fmt), z: PAY_STATES.length - payRank(s) };
        }),
    [pins, drawerId, t, fmt],
  );
  const places = useMemo(() => branchMarkers(branches.data, { selectedId: branchId, locale, title: (name) => tc('map.branch', { name }) }), [branches.data, branchId, locale, tc]);
  const shown = useMemo(() => [...places, ...host.markers, ...markers], [places, host.markers, markers]);
  const rawClusters = useMemo(() => (q.data?.clusters ?? []).filter((c) => c.lat != null && c.lng != null), [q.data?.clusters]);
  const clusters: (MapCluster & { worst: PayState; mix: Partial<Record<PayState, number>> | null })[] = useMemo(
    () =>
      rawClusters.map((c) => {
        const worst = isPayState(c.worstPayState) ? c.worstPayState : payStateOf({ status: c.worstStatus });
        const mix = c.payStates ? (Object.fromEntries(PAY_STATES.map((s) => [s, c.payStates?.[s] ?? 0])) as Record<PayState, number>) : null;
        const title = mix ? PAY_STATES.filter((s) => mix[s]).map((s) => `${t(`pay.state.${s}`)}: ${formatNumber(mix[s])}`).join(' · ') : undefined;
        return { lat: c.lat!, lng: c.lng!, count: c.count ?? 0, token: psToken(worst, 'pin'), label: formatNumber(c.count ?? 0), ring: mix ? PAY_STATES.map((s) => ({ token: psToken(s, 'pin'), n: mix[s] })) : undefined, title, worst, mix };
      }),
    [rawClusters, t],
  );
  const total = clusters.reduce((s, c) => s + c.count, 0);
  // how many of each colour are on the map now (clusters from an older server carry no mix: no counts then)
  const counts = useMemo(() => {
    const n = Object.fromEntries(PAY_STATES.map((s) => [s, 0])) as Record<PayState, number>;
    if (clusters.length) {
      if (clusters.some((c) => !c.mix)) return null;
      for (const c of clusters) for (const s of PAY_STATES) n[s] += c.mix?.[s] ?? 0;
    } else for (const p of pins) n[payStateOf(p)] += 1;
    return n;
  }, [clusters, pins]);

  const onView = useCallback((v: MapViewState) => {
    setView(v);
    writeViewpoint(viewpointParam({ center: centerOf(v.bounds), zoom: v.zoom }));
  }, []);
  const open = useCallback(
    (id: string) => {
      if (isBranchMarker(id)) return;
      // a layer marker carries its layer id (`place:6752…`); a customer pin is a bare id
      if (!openLayer(id)) url.set({ drawer: `customer:${id}` }, { push: true });
    },
    [url, openLayer],
  );
  const zoomTo = useCallback((c: { lat: number; lng: number }) => setFit({ minLat: c.lat - 0.012, maxLat: c.lat + 0.012, minLng: c.lng - 0.016, maxLng: c.lng + 0.016 }), []);
  const sorted = useMemo(() => [...pins].sort((a, b) => payRank(payStateOf(a)) - payRank(payStateOf(b)) || (b.outstandingPoisha ?? 0) - (a.outstandingPoisha ?? 0)), [pins]);
  const togglePay = (s: PayState) => url.set({ pay: pay.includes(s) ? pay.filter((x) => x !== s) : [...pay, s] });

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

      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Segmented
          label={t('invoiceKind.label')}
          value={kind}
          onChange={(v) => url.set({ kind: v === 'all' ? null : v })}
          options={KINDS.map((k) => ({ value: k, label: t(`invoiceKind.${k}`) }))}
        />
        <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {MAP_FILTERS.map((f) => (
            <FilterChip key={f} selected={filters.includes(f)} onClick={() => url.set({ filter: filters.includes(f) ? filters.filter((x) => x !== f) : [...filters, f] })}>
              {t(`filters.${f}`)}
            </FilterChip>
          ))}
          {layers.map((l) => (
            <FilterChip key={`layer-${l.id}`} selected={!hiddenLayers.includes(l.id)} onClick={() => url.set({ hide: hiddenLayers.includes(l.id) ? hiddenLayers.filter((x) => x !== l.id) : [...hiddenLayers, l.id] })}>
              {tc(l.title)}
            </FilterChip>
          ))}
        </div>
      </div>

      <PayLegend selected={pay} counts={counts} onToggle={togglePay} onClear={() => url.set({ pay: null })} />
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[52vh] min-h-80 lg:h-[calc(100vh-17rem)]">
          {start ? (
            <MapView
              label={t('map.title')}
              center={start.center}
              zoom={start.zoom}
              markers={shown}
              clusters={clusters}
              fit={fit}
              onView={onView}
              onMarkerClick={open}
              onClusterClick={zoomTo}
              locate
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>

        <section aria-label={t('map.inView')} className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-e1 lg:h-[calc(100vh-17rem)]">
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
                  {[...clusters].sort((a, b) => payRank(a.worst) - payRank(b.worst) || b.count - a.count).slice(0, 12).map((c, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => zoomTo(c)} className="flex min-h-11 w-full flex-col gap-1.5 rounded-sm border border-line px-3 py-2 text-start text-sm hover:bg-surface-hover">
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                            <PinIcon look={payLook(c.worst, null, fmt)} size={16} />
                            {t('map.cluster', { n: formatNumber(i + 1) })}
                          </span>
                          <span className="tabular text-fg-secondary">{t('map.nCustomers', { n: c.label })}</span>
                        </span>
                        {c.mix && <MixBar mix={c.mix} label={c.title ?? ''} />}
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
                    <button type="button" onClick={() => open(p.id!)} className={cn('flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-start hover:bg-surface-hover', p.id === drawerId && 'bg-surface-hover')}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg" lang={locale}>{p.name}</span>
                        <span className="mt-0.5 block"><PayStateBadge state={payStateOf(p)} missed={p.missedCount} /></span>
                      </span>
                      <MoneyText poisha={p.outstandingPoisha ?? 0} className="shrink-0 text-sm font-medium" />
                    </button>
                  </li>
                ))}
                {sorted.length > LIST_MAX && <li className="px-4 py-3 text-center text-xs text-fg-tertiary">{t('map.more', { n: formatNumber(sorted.length - LIST_MAX) })}</li>}
              </ul>
            )}
          </div>
          <footer className="border-t border-line px-4 py-2.5 text-xs text-fg-secondary">{t('pay.glyphHint')}</footer>
        </section>
      </div>

      {host.element}

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

/** Share of each colour in a cluster, as a thin stacked bar (the counts are in its label). */
function MixBar({ mix, label }: { mix: Partial<Record<PayState, number>>; label: string }) {
  const total = PAY_STATES.reduce((s, x) => s + (mix[x] ?? 0), 0);
  if (!total) return null;
  return (
    <span className="flex h-1.5 w-full gap-px overflow-hidden rounded-full" role="img" aria-label={label}>
      {PAY_STATES.filter((s) => mix[s]).map((s) => (
        <span key={s} className={PS_CLASS[s].bar} style={{ width: `${((mix[s] ?? 0) / total) * 100}%` }} />
      ))}
    </span>
  );
}
