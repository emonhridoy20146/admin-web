'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { useTranslation } from 'react-i18next';
import { LocateFixed } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatNumber } from '@/shared/lib/format';
import type { Bounds, LatLng, MapViewpoint } from './geo';
import { drawMarker } from './draw';
import type { PinLook, TileLook } from './pin-icon';
import { useTileProvider } from './use-tiles';

export interface MapMarker extends LatLng {
  id: string;
  /** CSS variable name (design token) for the fill, e.g. `--st-overdue-fg` */
  token: string;
  title: string;
  /** larger ring (selected / emphasised) */
  strong?: boolean;
  /** hollow marker (e.g. "current" pin next to a proposed one) */
  hollow?: boolean;
  /** drawn as a map pin (round head, point on the spot) instead of a dot; `token` is then unused */
  pin?: PinLook;
  /** higher draws on top (worst state over calm ones) */
  z?: number;
  /** text always shown next to the marker (map places, FR-PLC-001) instead of only on hover */
  label?: string;
  /** drawn as a small rounded square with a symbol (map places) instead of a dot or pin; `token` is then unused */
  tile?: TileLook;
  /** not clickable (clicks go to the map underneath, e.g. in a point picker) */
  passive?: boolean;
}

export interface MapCluster extends LatLng {
  count: number;
  token: string;
  label: string;
  /** share of each colour in the cluster, drawn as a ring around the count */
  ring?: { token: string; n: number }[];
  /** hover text */
  title?: string;
}

export interface MapPath {
  points: LatLng[];
  /** CSS variable name (design token) for the stroke */
  token: string;
}

export interface MapViewState {
  bounds: Bounds;
  zoom: number;
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** conic-gradient stops for a cluster ring: `var(--a) 0% 40%, var(--b) 40% 100%` */
export function ringGradient(ring: { token: string; n: number }[]): string | null {
  const total = ring.reduce((s, r) => s + Math.max(0, r.n), 0);
  if (!total) return null;
  let at = 0;
  const stops = ring
    .filter((r) => r.n > 0)
    .map((r) => {
      const from = at;
      at += (r.n / total) * 100;
      return `var(${r.token.replace(/[^a-z0-9-]/gi, '')}) ${from.toFixed(2)}% ${at.toFixed(2)}%`;
    });
  return `conic-gradient(${stops.join(', ')})`;
}

/**
 * Leaflet wrapper (loaded on the client only: Leaflet touches `window` at import). Markers are vector circles or
 * SVG pins coloured from design tokens, so no marker images and no extra CSP hosts beyond the tile origin.
 * The map is a visual aid; every page that uses it also lists the same items as text (keyboard / screen reader).
 * The user moves it freely: the page only moves it on purpose through `fit` (a new branch, a cluster click).
 * With `locate`, a button shows where the person using the admin panel is (browser location, asked on click only;
 * the position stays in the page and is never sent anywhere, FR-W-034).
 */
export function MapView({ center, zoom = 13, initialBounds, markers, clusters, lines, paths, fit, onView, onMarkerClick, onClusterClick, className, label, locate }: {
  center: LatLng;
  zoom?: number;
  /** opens on these bounds instead of `center`/`zoom` (read once, when the map is created) */
  initialBounds?: Bounds | null;
  markers?: MapMarker[];
  clusters?: MapCluster[];
  lines?: [LatLng, LatLng][];
  /** solid tracks (route history) drawn under the markers */
  paths?: MapPath[];
  /** when it changes, the map fits these bounds (or goes to this centre and zoom) */
  fit?: Bounds | MapViewpoint | null;
  onView?: (v: MapViewState) => void;
  onMarkerClick?: (id: string) => void;
  onClusterClick?: (c: MapCluster) => void;
  className?: string;
  label: string;
  /** shows the "my location" button */
  locate?: boolean;
}) {
  const { t } = useTranslation();
  const el = useRef<HTMLDivElement>(null);
  const me = useRef<Leaflet.LayerGroup | null>(null);
  const [loc, setLoc] = useState<'idle' | 'busy' | 'denied' | 'unavailable'>('idle');
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const tiles = useRef<Leaflet.TileLayer | null>(null);
  const cb = useRef({ onView, onMarkerClick, onClusterClick });
  cb.current = { onView, onMarkerClick, onClusterClick };
  const provider = useTileProvider().data;
  const ready = useRef(false);
  const [created, setCreated] = useState(false);
  const redraw = useRef<() => void>(() => undefined);

  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'currentColor';

  redraw.current = () => {
    const lf = L.current;
    if (!lf || !layer.current) return;
    layer.current.clearLayers();
    for (const p of paths ?? []) if (p.points.length > 1) lf.polyline(p.points.map((q) => [q.lat, q.lng] as [number, number]), { color: token(p.token), weight: 4, opacity: 0.85, lineJoin: 'round' }).addTo(layer.current);
    for (const [a, b] of lines ?? []) lf.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: token('--fg-secondary'), weight: 2, dashArray: '4 6' }).addTo(layer.current);
    for (const c of clusters ?? []) {
      const size = c.count > 200 ? 46 : c.count > 50 ? 40 : 34;
      const ring = c.ring ? ringGradient(c.ring) : null;
      const label = esc(c.label);
      const html = ring
        ? `<span class="fos-cluster has-ring" style="--c:var(${c.token.replace(/[^a-z0-9-]/gi, '')});--ring:${ring};width:${size + 6}px;height:${size + 6}px"><span>${label}</span></span>`
        : `<span class="fos-cluster" style="--c:${token(c.token)};width:${size}px;height:${size}px">${label}</span>`;
      const icon = lf.divIcon({ className: '', iconSize: ring ? [size + 6, size + 6] : [size, size], html });
      lf.marker([c.lat, c.lng], { icon, keyboard: false, title: c.title ?? c.label, zIndexOffset: 5000 }).on('click', () => cb.current.onClusterClick?.(c)).addTo(layer.current);
    }
    for (const m of markers ?? []) drawMarker(lf, layer.current, m, token, (id) => cb.current.onMarkerClick?.(id));
  };

  useEffect(() => {
    let dead = false;
    void import('leaflet').then((mod) => {
      if (dead || !el.current || map.current) return;
      const lf = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      L.current = lf;
      // fadeAnimation off: markers are redrawn on every view change, and with it on Leaflet keeps each removed label
      // in the page for 200 ms (opacity 0), so every place name showed twice while the map moved.
      const opts = { zoomControl: true, attributionControl: true, fadeAnimation: false };
      const m = initialBounds
        ? lf.map(el.current, opts).fitBounds([[initialBounds.minLat, initialBounds.minLng], [initialBounds.maxLat, initialBounds.maxLng]], { animate: false })
        : lf.map(el.current, { ...opts, center: [center.lat, center.lng], zoom });
      m.attributionControl.setPrefix(false);
      map.current = m;
      layer.current = lf.layerGroup().addTo(m);
      me.current = lf.layerGroup().addTo(m);
      const emit = () => {
        const b = m.getBounds();
        cb.current.onView?.({ bounds: { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() }, zoom: m.getZoom() });
      };
      m.on('moveend', emit);
      ready.current = true;
      setCreated(true);
      redraw.current();
      emit();
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
      me.current = null;
      ready.current = false;
      setCreated(false);
    };
    // the map is created once; later centre changes go through `fit`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tiles are (re)made only when the map appears or the provider changes. This used to run after every render, so
  // each pan or zoom (a new view, a re-render) dropped and reloaded all tiles and the map felt stuck while moving.
  const tileKey = provider?.urlTemplate ? [provider.urlTemplate, provider.apiKeyRef ?? '', provider.attribution ?? '', provider.maxZoom ?? 19, (provider.subdomains ?? []).join('')].join('|') : '';
  useEffect(() => {
    const lf = L.current;
    if (!created || !lf || !map.current || !provider?.urlTemplate) return;
    tiles.current?.remove();
    tiles.current = lf.tileLayer(provider.urlTemplate.replace('{key}', provider.apiKeyRef ?? ''), { attribution: provider.attribution ?? '', maxZoom: provider.maxZoom ?? 19, subdomains: provider.subdomains?.length ? provider.subdomains : 'abc' }).addTo(map.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created, tileKey]);

  useEffect(() => {
    if (ready.current) redraw.current();
  }, [markers, clusters, lines, paths]);

  // FR-W-061: the map follows its box (full screen, a panel opening beside it, a rotated phone). Leaflet only measures
  // on window resize, so without this the tiles stop at the old edge and clicks land in the wrong place.
  useEffect(() => {
    const box = el.current;
    if (!created || !box || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.current?.invalidateSize({ pan: false, debounceMoveend: true }));
    });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [created]);

  const fitKey = !fit ? '' : 'center' in fit ? `${fit.center.lat},${fit.center.lng}@${fit.zoom}` : `${fit.minLat},${fit.minLng},${fit.maxLat},${fit.maxLng}`;
  useEffect(() => {
    if (!fit) return;
    const go = () =>
      'center' in fit
        ? map.current?.setView([fit.center.lat, fit.center.lng], fit.zoom, { animate: false })
        : map.current?.fitBounds([[fit.minLat, fit.minLng], [fit.maxLat, fit.maxLng]], { maxZoom: 17, animate: false });
    if (map.current) go();
    else {
      const t = setInterval(() => map.current && (clearInterval(t), go()), 60);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const locateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return setLoc('unavailable');
    setLoc('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lf = L.current;
        const m = map.current;
        if (!lf || !m || !me.current) return setLoc('idle');
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const color = token('--info-fg');
        me.current.clearLayers();
        lf.circle([lat, lng], { radius: Math.min(accuracy, 3000), color, weight: 1, fillColor: color, fillOpacity: 0.12, interactive: false }).addTo(me.current);
        lf.circleMarker([lat, lng], { radius: 8, color: token('--surface'), weight: 3, fillColor: color, fillOpacity: 1 })
          .bindTooltip(t('map.you', { m: formatNumber(Math.round(accuracy)) }), { direction: 'top', offset: [0, -8] })
          .addTo(me.current);
        m.setView([lat, lng], Math.max(m.getZoom(), 15), { animate: false });
        setLoc('idle');
      },
      (err) => setLoc(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  // Leaflet adds its own classes (`leaflet-container`, …) to the element it is given. React owns this outer box's
  // class, so when `className` changes (the customer map's full screen) React rewrote the attribute and wiped
  // Leaflet's classes: the tile CSS stopped applying and the map turned white with only the pins left (owner report
  // 2026-11-24). Leaflet gets the inner element, whose class React never changes.
  const mapEl = (
    <div role="application" aria-label={label} className={cn('fos-map isolate z-0 h-full min-h-64 w-full overflow-hidden rounded-md border border-line bg-surface-subtle', className)}>
      <div ref={el} className="h-full w-full" />
    </div>
  );
  if (!locate) return mapEl;
  return (
    <div className="relative h-full w-full">
      {mapEl}
      <div className="absolute right-2.5 top-2.5 z-[1000] flex max-w-[70%] flex-col items-end gap-1">
        <button
          type="button"
          onClick={locateMe}
          aria-label={loc === 'busy' ? t('map.locating') : t('map.myLocation')}
          title={t('map.myLocation')}
          aria-busy={loc === 'busy'}
          className="grid size-11 place-items-center rounded-md border border-line bg-surface text-fg shadow-e1 hover:bg-surface-hover"
        >
          <LocateFixed className={cn('size-5', loc === 'busy' && 'animate-pulse')} aria-hidden />
        </button>
        <p role="status" className={cn('rounded-md bg-surface px-2 py-1 text-xs text-fg-secondary shadow-e1', loc !== 'denied' && loc !== 'unavailable' && 'sr-only')}>
          {loc === 'denied' ? t('map.locationDenied') : loc === 'unavailable' ? t('map.locationUnavailable') : loc === 'busy' ? t('map.locating') : ''}
        </p>
      </div>
    </div>
  );
}
