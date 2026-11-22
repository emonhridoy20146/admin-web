'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, MapPinCheck, Route, ShieldAlert, UserRound, Wallet, WifiOff } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useGate } from '@/shared/feature/useGate';
import { formatDuration, formatNumber, formatTime, pickText } from '@/shared/lib/format';
import { addDays, todayDhaka } from '@/shared/lib/time';
import { useUrlState } from '@/shared/lib/url-state';
import { branchPoint, boundsOf, decodePolyline, DEFAULT_VIEW, type Bounds } from '@/shared/map/geo';
import { useMapLayers } from '@/shared/feature/map-layers';
import { MapView, type MapMarker, type MapPath, type MapViewState } from '@/shared/map/map-view';
import { PageHeader } from '@/shared/ui/page';
import { Card } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Button } from '@/shared/ui/button';
import { Field, Input, Select } from '@/shared/ui/form';
import { useHistory, useStaff, type Stop } from '../api/location';
import { MoneyText } from '@/shared/ui/money';
import { buildScrubber, COLLECTION_TOKEN, collectedOnRoute, gaps, sortStops, stopIndexAtPct, STOP_TOKEN, stopKind, type ScrubModel, workEvents } from '../model/location';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function RoutesPage() {
  const { t } = useTranslation('location');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branchId = useUi((s) => s.branchId);
  const branches = useBranches();
  const gate = useGate();
  const canCustomer = gate.can('customer.view') && gate.flag('module.customers');
  const url = useUrlState();
  const today = todayDhaka();
  const userId = url.get('user');
  const raw = url.get('date');
  const date = DATE_RE.test(raw) && raw <= today ? raw : today;
  const staff = useStaff();
  const q = useHistory(userId, date);
  const [fit, setFit] = useState<Bounds | null>(null);
  const [stopAt, setStopAt] = useState<number | null>(null);

  const home = branchPoint(branches.data, branchId);
  const center = useMemo(() => home ?? DEFAULT_VIEW.center, [home?.lat, home?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  // FR-PLC-001: places (and any other feature's layer) on the route map too
  const [view, setView] = useState<MapViewState | null>(null);
  const layers = useMapLayers({ view });
  const track = useMemo(() => decodePolyline(q.data?.polyline), [q.data?.polyline]);
  const stops = useMemo(() => sortStops(q.data?.stops), [q.data?.stops]);
  const lost = useMemo(() => gaps(q.data?.segments), [q.data?.segments]);
  const events = useMemo(() => workEvents(q.data?.events), [q.data?.events]);
  const collected = collectedOnRoute(events);
  const sum = q.data?.summary;
  const person = staff.data?.find((u) => u.id === userId);
  const name = pickText(person?.name, locale);

  useEffect(() => {
    setStopAt(null);
    if (track.length) setFit(boundsOf(track, 0.003));
  }, [track]);

  const scrub = useMemo(() => buildScrubber(q.data?.segments, stops), [q.data?.segments, stops]);

  const paths: MapPath[] = useMemo(() => (track.length > 1 ? [{ points: track, token: '--primary' }] : []), [track]);
  const markers: MapMarker[] = useMemo(
    () => [
      // collections first so a stop at the same place stays on top and clickable
      ...events.filter((e) => e.kind === 'collection' && e.lat !== null && e.lng !== null).map((e, i) => ({ id: `c${i}`, lat: e.lat!, lng: e.lng!, token: COLLECTION_TOKEN, title: `${t('routes.collection')} · ${formatTime(e.at)}`, hollow: true, strong: true })),
      ...stops.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number').map((s, i) => ({ id: String(i), lat: s.lat!, lng: s.lng!, token: STOP_TOKEN[stopKind(s)], title: `${formatNumber(i + 1)}. ${s.customerName ?? t('routes.otherPlace')}`, strong: stopAt === i })),
    ],
    [stops, stopAt, events, t],
  );
  // place markers under the route's own (which stay on top and clickable)
  const withLayers = useMemo(() => [...layers.markers, ...markers], [layers.markers, markers]);
  const showStop = (i: number) => {
    const s = stops[i];
    setStopAt(i);
    if (s && typeof s.lat === 'number' && typeof s.lng === 'number') setFit({ minLat: s.lat - 0.003, maxLat: s.lat + 0.003, minLng: s.lng - 0.004, maxLng: s.lng + 0.004 });
  };
  const empty = !!q.data && !track.length && !stops.length;

  return (
    <>
      <PageHeader title={t('routes.title')}>
        <span>{t('routes.subtitle')}</span>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,280px)_auto] sm:items-end">
        <Field label={t('routes.staff')}>
          {(id) => (
            <Select id={id} value={userId} onChange={(e) => url.set({ user: e.target.value || null })}>
              <option value="">{t('routes.pickStaff')}</option>
              {(staff.data ?? []).map((u) => <option key={u.id} value={u.id}>{pickText(u.name, locale)}</option>)}
            </Select>
          )}
        </Field>
        <div className="flex items-end gap-2">
          <Button size="icon" aria-label={t('routes.prevDay')} onClick={() => url.set({ date: addDays(date, -1) })}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Field label={t('routes.date')}>
            {(id) => <Input id={id} type="date" max={today} value={date} onChange={(e) => e.target.value && url.set({ date: e.target.value })} className="w-44" />}
          </Field>
          <Button size="icon" aria-label={t('routes.nextDay')} disabled={date >= today} onClick={() => url.set({ date: addDays(date, 1) })}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}

      {!userId ? (
        <Card><EmptyState icon={UserRound} title={t('routes.pick')} body={t('routes.pickBody')} /></Card>
      ) : q.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-96 rounded-md" />
        </div>
      ) : empty ? (
        <Card><EmptyState icon={Route} title={t('routes.empty')} body={t('routes.emptyBody')} /></Card>
      ) : q.data ? (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line shadow-e1 sm:grid-cols-3 lg:grid-cols-6 [&>*]:bg-surface">
            <Stat label={t('routes.distance')} value={t('routes.km', { n: formatNumber(sum?.distanceKm ?? 0, { decimals: 1 }) })} />
            <Stat label={t('routes.moving')} value={formatDuration(sum?.movingMin ?? 0)} />
            <Stat label={t('routes.stopped')} value={formatDuration(sum?.stoppedMin ?? 0)} />
            <Stat label={t('routes.stops')} value={formatNumber(sum?.stopsCount ?? stops.length)} sub={t('routes.customerStops', { n: formatNumber(sum?.customerStops ?? 0) })} />
            <Stat label={t('routes.gaps')} value={formatDuration(sum?.gapsMin ?? 0)} warn={(sum?.gapsMin ?? 0) >= 30} />
            <Stat label={t('routes.mockPoints')} value={formatNumber(sum?.mockPoints ?? 0)} danger={(sum?.mockPoints ?? 0) > 0} />
          </dl>

          {scrub && <RouteScrubber model={scrub} stops={stops} stopAt={stopAt} onSeek={(i) => { if (i !== null) showStop(i); else setStopAt(null); }} />}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="h-[46vh] min-h-72 lg:h-[calc(100vh-22rem)] lg:min-h-96">
              <MapView label={t('routes.map', { name })} center={center} zoom={home ? 13 : DEFAULT_VIEW.zoom} paths={paths} markers={withLayers} fit={fit} onView={setView} onMarkerClick={(id) => !layers.open(id) && !id.startsWith('c') && showStop(Number(id))} />
            </div>

            <div className="flex min-h-0 flex-col gap-4 lg:h-[calc(100vh-22rem)] lg:min-h-96 lg:overflow-y-auto">
              <section aria-labelledby="route-stops" className="rounded-md border border-line bg-surface shadow-e1">
                <h2 id="route-stops" className="border-b border-line px-4 py-3 text-sm font-semibold text-fg">{t('routes.stopsTitle')}</h2>
                {!stops.length ? (
                  <p className="px-4 py-6 text-center text-sm text-fg-tertiary">{t('routes.noStops')}</p>
                ) : (
                  <ol className="divide-y divide-line">
                    {stops.map((s, i) => {
                      const kind = stopKind(s);
                      return (
                        <li key={i} className={cn('flex items-start gap-3 px-4 py-2.5', stopAt === i && 'bg-primary-subtle/40')}>
                          <button type="button" onClick={() => showStop(i)} aria-label={t('routes.showStop', { n: formatNumber(i + 1) })} aria-pressed={stopAt === i} className="tabular grid size-9 shrink-0 place-items-center rounded-full border border-line text-sm font-semibold text-fg hover:bg-surface-hover [@media(pointer:coarse)]:size-11">
                            {formatNumber(i + 1)}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                              <MapPin className={cn('size-3.5 shrink-0', kind === 'customer' ? 'text-success' : 'text-warning')} aria-hidden />
                              {s.customerId && canCustomer ? (
                                <Link href={`/customers/${s.customerId}/`} className="truncate hover:underline" lang={locale}>{s.customerName}</Link>
                              ) : (
                                <span className="truncate" lang={locale}>{s.customerName ?? t('routes.otherPlace')}</span>
                              )}
                            </p>
                            <p className="tabular mt-0.5 text-xs text-fg-secondary">
                              {s.start ? formatTime(s.start) : ''}{s.end ? ` – ${formatTime(s.end)}` : ''} · {formatDuration(s.dwellMin ?? 0)}
                              {typeof s.distanceToPinM === 'number' ? ` · ${t('routes.fromPin', { n: formatNumber(s.distanceToPinM) })}` : ''}
                            </p>
                            {s.visitId && canCustomer && s.customerId && (
                              <Link href={`/visits/?userId=${userId}&customer=${s.customerId}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline" aria-label={t('routes.visitLink')}>
                                <ExternalLink className="size-3" aria-hidden />
                                {t('routes.visitLink')}
                              </Link>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <p className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-fg-secondary">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: `var(${STOP_TOKEN.customer})` }} aria-hidden />{t('routes.legendCustomer')}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: `var(${STOP_TOKEN.other})` }} aria-hidden />{t('routes.legendOther')}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2" style={{ borderColor: `var(${COLLECTION_TOKEN})` }} aria-hidden />{t('routes.legendCollection')}</span>
                </p>
              </section>

              {lost.length > 0 && (
                <section aria-labelledby="route-gaps" className="rounded-md border border-line bg-surface shadow-e1">
                  <h2 id="route-gaps" className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-fg">
                    <WifiOff className="size-4 text-warning" aria-hidden />
                    {t('routes.gapsTitle')}
                  </h2>
                  <ul className="divide-y divide-line">
                    {lost.map((g) => (
                      <li key={g.from} className="tabular flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <span className="text-fg">{formatTime(g.from)} – {formatTime(g.to)}</span>
                        <span className="text-fg-secondary">{formatDuration(g.minutes)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {events.length > 0 && (
                <section aria-labelledby="route-events" className="rounded-md border border-line bg-surface shadow-e1">
                  <h2 id="route-events" className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 text-sm font-semibold text-fg">
                    {t('routes.eventsTitle')}
                    {collected > 0 ? <span className="text-xs font-normal text-fg-secondary">{t('routes.collectedField')}: <MoneyText poisha={collected} className="font-medium text-fg" /></span> : null}
                  </h2>
                  <ul className="divide-y divide-line">
                    {events.map((e, i) => (
                      <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                        <span className="tabular w-16 shrink-0 text-fg-secondary">{formatTime(e.at)}</span>
                        {e.kind === 'collection' ? <Wallet className="mt-0.5 size-4 shrink-0 text-info" aria-hidden /> : <MapPinCheck className="mt-0.5 size-4 shrink-0 text-fg-tertiary" aria-hidden />}
                        <span className="min-w-0 flex-1">
                          <span className="sr-only">{t(e.kind === 'collection' ? 'routes.collection' : 'routes.visit')}: </span>
                          {e.customerId && canCustomer ? (
                            <Link href={`/customers/${e.customerId}/`} className="text-fg hover:underline" lang={locale}>{pickText(e.summary, locale)}</Link>
                          ) : (
                            <span className="text-fg" lang={locale}>{pickText(e.summary, locale)}</span>
                          )}
                          {e.receiptNo ? <span className="block font-mono text-xs text-fg-tertiary">{e.receiptNo}</span> : null}
                        </span>
                        {e.amountPoisha !== null ? <MoneyText poisha={e.amountPoisha} className="shrink-0 font-medium" /> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </>
      ) : null}
      {layers.element}
    </>
  );
}

function RouteScrubber({ model, stops, stopAt, onSeek }: { model: ScrubModel; stops: Stop[]; stopAt: number | null; onSeek: (i: number | null) => void }) {
  const { t } = useTranslation('location');
  const barRef = useRef<HTMLDivElement>(null);

  const seekAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    onSeek(stopIndexAtPct(pct, model, stops));
  };

  return (
    <div className="mb-4 rounded-md border border-line bg-surface p-3 shadow-e1">
      <p className="mb-2 text-xs font-medium text-fg-secondary">{t('routes.scrubber')}</p>
      <div
        ref={barRef}
        role="slider"
        aria-label={t('routes.scrubberHelp')}
        aria-valuenow={stopAt ?? 0}
        className="relative h-5 cursor-pointer select-none rounded-sm bg-surface-subtle"
        onClick={(e) => seekAt(e.clientX)}
        onMouseMove={(e) => { if (e.buttons === 1) seekAt(e.clientX); }}
        onTouchMove={(e) => { if (e.touches[0]) seekAt(e.touches[0].clientX); }}
      >
        {model.segments.map((seg, i) => (
          <div
            key={i}
            className={cn('absolute top-1 h-3 rounded-sm', seg.kind === 'gap' ? 'bg-warning/40' : 'bg-primary/50')}
            style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }}
            title={t(`routes.${seg.kind}`)}
          />
        ))}
        {model.stops.map((s) => (
          <button
            key={s.index}
            type="button"
            aria-pressed={stopAt === s.index}
            onClick={(e) => { e.stopPropagation(); onSeek(s.index); }}
            className={cn('absolute top-0 size-5 -translate-x-1/2 rounded-full border-2 border-surface transition-transform hover:scale-125', stopAt === s.index ? 'scale-125 border-primary' : 'border-line', s.kind === 'customer' ? 'bg-success' : 'bg-warning')}
            style={{ left: `${s.leftPct}%` }}
            aria-label={t('routes.showStop', { n: formatNumber(s.index + 1) })}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-fg-tertiary">
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-sm bg-primary/50" />{t('routes.moving')}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-sm bg-warning/40" />{t('routes.gap')}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, warn, danger }: { label: string; value: string; sub?: string; warn?: boolean; danger?: boolean }) {
  return (
    <div className="px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-fg-tertiary">
        {danger && <ShieldAlert className="size-3.5 text-danger" aria-hidden />}
        {label}
      </dt>
      <dd className={cn('tabular mt-0.5 text-md font-semibold', danger ? 'text-danger' : warn ? 'text-warning' : 'text-fg')}>
        {value}
        {sub ? <span className="block text-xs font-normal text-fg-secondary">{sub}</span> : null}
      </dd>
    </div>
  );
}
