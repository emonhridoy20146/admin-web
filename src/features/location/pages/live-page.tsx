'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { BatteryLow, CircleCheck, CircleDashed, Clock3, Coffee, Navigation, RefreshCw, Route, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useGate } from '@/shared/feature/useGate';
import { formatNumber, formatRelative, formatTime } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { listOf, useUrlState } from '@/shared/lib/url-state';
import { branchPoint, boundsOf, DEFAULT_AREA, DEFAULT_POINT, type Bounds } from '@/shared/map/geo';
import { MapView, type MapMarker } from '@/shared/map/map-view';
import { PageHeader } from '@/shared/ui/page';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { FilterChip } from '@/shared/ui/primitives';
import { MoneyText } from '@/shared/ui/money';
import { useLatest, type Latest } from '../api/location';
import { batteryPct, counts, FRESH_TOKEN, FRESHNESS, freshnessOf, hasPosition, LOW_BATTERY, sortLatest, type Freshness } from '../model/location';

const TONE: Record<Freshness, 'success' | 'warning' | 'neutral'> = { fresh: 'success', stale: 'warning', lost: 'neutral' };
const ICON: Record<Freshness, LucideIcon> = { fresh: CircleCheck, stale: Clock3, lost: CircleDashed };
const FILTERS = [...FRESHNESS, 'mock'] as const;
const around = (p: { lat: number; lng: number }): Bounds => ({ minLat: p.lat - 0.004, maxLat: p.lat + 0.004, minLng: p.lng - 0.005, maxLng: p.lng + 0.005 });

export function LivePage() {
  const { t } = useTranslation('location');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branchId = useUi((s) => s.branchId);
  const branches = useBranches();
  const gate = useGate();
  const canRoute = gate.can('location.history.view');
  const url = useUrlState();
  const show = listOf(url.getList('show'), FILTERS);
  const selectedId = url.get('staff');
  const q = useLatest();
  const [fit, setFit] = useState<Bounds | null>(null);
  const fitted = useRef(false);

  const all = useMemo(() => q.data ?? [], [q.data]);
  const n = useMemo(() => counts(all), [all]);
  const rows = useMemo(() => sortLatest(all.filter((r) => !show.length || show.includes(freshnessOf(r)) || (r.mock && show.includes('mock')))), [all, show]);
  const selected = rows.find((r) => r.userId === selectedId) ?? null;
  const home = branchPoint(branches.data, branchId);
  const center = useMemo(() => home ?? DEFAULT_POINT, [home?.lat, home?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // first answer: frame everyone (or the person in the link); later refreshes keep the manager's own view
  useEffect(() => {
    if (fitted.current || !q.data) return;
    fitted.current = true;
    const placed = q.data.filter(hasPosition);
    const sel = placed.find((r) => r.userId === selectedId);
    setFit(sel ? around(sel) : boundsOf(placed, 0.004));
  }, [q.data, selectedId]);

  const markers: MapMarker[] = useMemo(
    () => rows.filter(hasPosition).map((r) => ({ id: r.userId!, lat: r.lat, lng: r.lng, token: r.mock ? '--st-mock-fg' : FRESH_TOKEN[freshnessOf(r)], title: r.name ?? '', strong: r.userId === selectedId, hollow: freshnessOf(r) === 'lost' })),
    [rows, selectedId],
  );
  const select = (r: Latest) => {
    url.set({ staff: r.userId === selectedId ? null : (r.userId ?? null) });
    if (r.userId !== selectedId && hasPosition(r)) setFit(around(r));
  };
  const onMarker = (id: string) => {
    const r = rows.find((x) => x.userId === id);
    if (r) select(r);
  };

  return (
    <>
      <PageHeader
        title={t('live.title')}
        actions={
          <div className="flex items-center gap-3">
            <span className="tabular text-sm text-fg-secondary" aria-live="polite">{q.dataUpdatedAt ? t('live.updated', { time: formatTime(new Date(q.dataUpdatedAt)) }) : ''}</span>
            <Button onClick={() => q.refetch()} aria-busy={q.isFetching}>
              <RefreshCw className={cn('size-4', q.isFetching && 'animate-spin')} aria-hidden />
              {tc('actions.refresh')}
            </Button>
          </div>
        }
      >
        <span>{t('live.subtitle')}</span>
      </PageHeader>

      <div className="scrollbar-thin -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => (
          <FilterChip key={f} selected={show.includes(f)} count={n[f]} onClick={() => url.set({ show: show.includes(f) ? show.filter((x) => x !== f) : [...show, f] })}>
            {f === 'mock' ? t('live.mock') : t(`freshness.${f}`)}
          </FilterChip>
        ))}
      </div>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[46vh] min-h-72 lg:h-[calc(100vh-15rem)]">
          <MapView label={t('live.title')} center={center} zoom={13} initialBounds={home ? null : DEFAULT_AREA} markers={markers} fit={fit} onMarkerClick={onMarker} />
        </div>

        <section aria-label={t('live.list')} className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-e1 lg:h-[calc(100vh-15rem)]">
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-fg">{t('live.list')}</h2>
            <span className="tabular text-xs text-fg-tertiary">{q.isLoading ? '' : t('live.nStaff', { n: formatNumber(rows.length) })}</span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {q.isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : !all.length ? (
              <EmptyState icon={Navigation} title={t('live.empty')} body={t('live.emptyBody')} />
            ) : !rows.length ? (
              <p className="px-4 py-10 text-center text-sm text-fg-tertiary">{t('live.noMatch')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((r) => {
                  const f = freshnessOf(r);
                  const bat = batteryPct(r);
                  const open = r.userId === selectedId;
                  return (
                    <li key={r.userId} className={cn(open && 'bg-primary-subtle/40')}>
                      <button type="button" aria-expanded={open} aria-label={t('live.showOnMap', { name: r.name ?? '' })} onClick={() => select(r)} className="flex min-h-14 w-full items-start justify-between gap-3 px-4 py-2.5 text-start hover:bg-surface-hover">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-fg" lang={locale}>{r.name}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone={TONE[f]} icon={ICON[f]}>{t(`freshness.${f}`)}</Badge>
                            {r.mock && <Badge tone="danger" icon={ShieldAlert}>{t('live.mock')}</Badge>}
                            {r.onBreak && <Badge tone="info" icon={Coffee}>{t('live.onBreak')}</Badge>}
                            {bat !== null && bat <= LOW_BATTERY && <Badge tone="warning" icon={BatteryLow}>{t('live.battery', { n: formatNumber(bat) })}</Badge>}
                          </span>
                        </span>
                        <span className="tabular shrink-0 pt-0.5 text-xs text-fg-secondary">{r.recordedAt ? formatRelative(r.recordedAt) : t('live.noPosition')}</span>
                      </button>
                      {open && (
                        <div className="px-4 pb-3">
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div>
                              <dt className="text-xs text-fg-tertiary">{t('live.visitsToday')}</dt>
                              <dd className="tabular font-medium text-fg">{formatNumber(r.todayVisits ?? 0)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-fg-tertiary">{t('live.collectedToday')}</dt>
                              <dd className="font-medium text-fg"><MoneyText poisha={r.todayCollectedPoisha ?? 0} /></dd>
                            </div>
                            <div>
                              <dt className="text-xs text-fg-tertiary">{t('live.activity')}</dt>
                              <dd className="text-fg">{t(`activity.${r.activity ?? 'unknown'}`, { defaultValue: t('activity.unknown') })}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-fg-tertiary">{t('live.accuracy')}</dt>
                              <dd className="tabular text-fg">{typeof r.accuracyM === 'number' ? t('live.accuracyValue', { n: formatNumber(Math.round(r.accuracyM)) }) : '—'}</dd>
                            </div>
                            {bat !== null && (
                              <div>
                                <dt className="text-xs text-fg-tertiary">{t('live.batteryLabel')}</dt>
                                <dd className="tabular text-fg">{formatNumber(bat)}%</dd>
                              </div>
                            )}
                            {r.trackingProvider && (
                              <div>
                                <dt className="text-xs text-fg-tertiary">{t('live.engine')}</dt>
                                <dd className="text-fg">{r.trackingProviderFallback ? t('live.engineFallback') : t(`engine.${r.trackingProvider}`)}</dd>
                              </div>
                            )}
                          </dl>
                          <p className="mt-2 text-xs text-fg-tertiary">{t(`freshnessHelp.${f}`)}</p>
                          {canRoute && (
                            <Link href={`/routes/?user=${r.userId}&date=${todayDhaka()}`} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline">
                              <Route className="size-4" aria-hidden />
                              {t('live.seeRoute')}
                            </Link>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <footer className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-fg-secondary">
            {FRESHNESS.map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: `var(${FRESH_TOKEN[f]})` }} aria-hidden />
                {t(`freshness.${f}`)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: 'var(--st-mock-fg)' }} aria-hidden />
              {t('live.mock')}
            </span>
          </footer>
        </section>
      </div>
      {selected ? <span className="sr-only" aria-live="polite">{selected.name}</span> : null}
    </>
  );
}
