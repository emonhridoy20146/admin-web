'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { cn } from '@/shared/lib/cn';
import type { Bounds, LatLng } from './geo';
import { pinIconHtml, pinSize, type PinLook } from './pin-icon';
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
 */
export function MapView({ center, zoom = 13, initialBounds, markers, clusters, lines, paths, fit, onView, onMarkerClick, onClusterClick, className, label }: {
  center: LatLng;
  zoom?: number;
  /** opens on these bounds instead of `center`/`zoom` (read once, when the map is created) */
  initialBounds?: Bounds | null;
  markers?: MapMarker[];
  clusters?: MapCluster[];
  lines?: [LatLng, LatLng][];
  /** solid tracks (route history) drawn under the markers */
  paths?: MapPath[];
  /** when it changes, the map fits these bounds */
  fit?: Bounds | null;
  onView?: (v: MapViewState) => void;
  onMarkerClick?: (id: string) => void;
  onClusterClick?: (c: MapCluster) => void;
  className?: string;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
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
    for (const m of markers ?? []) {
      if (m.pin) {
        const [w, h] = pinSize(m.strong);
        const icon = lf.divIcon({ className: '', iconSize: [w, h], iconAnchor: [w / 2, h], tooltipAnchor: [0, -h + 4], html: pinIconHtml(m.pin, m.strong) });
        lf.marker([m.lat, m.lng], { icon, keyboard: false, riseOnHover: true, zIndexOffset: (m.z ?? 0) * 1000 + (m.strong ? 10_000 : 0) })
          .bindTooltip(m.title, { direction: 'top' })
          .on('click', () => cb.current.onMarkerClick?.(m.id))
          .addTo(layer.current);
        continue;
      }
      const color = token(m.token);
      lf.circleMarker([m.lat, m.lng], { radius: m.strong ? 9 : 6, color: m.hollow ? color : token('--surface'), weight: m.hollow ? 2.5 : 1.5, fillColor: color, fillOpacity: m.hollow ? 0.12 : 0.95 })
        .bindTooltip(m.title, { direction: 'top', offset: [0, -6] })
        .on('click', () => cb.current.onMarkerClick?.(m.id))
        .addTo(layer.current);
    }
  };

  useEffect(() => {
    let dead = false;
    void import('leaflet').then((mod) => {
      if (dead || !el.current || map.current) return;
      const lf = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      L.current = lf;
      const m = initialBounds
        ? lf.map(el.current, { zoomControl: true, attributionControl: true }).fitBounds([[initialBounds.minLat, initialBounds.minLng], [initialBounds.maxLat, initialBounds.maxLng]], { animate: false })
        : lf.map(el.current, { center: [center.lat, center.lng], zoom, zoomControl: true, attributionControl: true });
      m.attributionControl.setPrefix(false);
      map.current = m;
      layer.current = lf.layerGroup().addTo(m);
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

  const fitKey = fit ? `${fit.minLat},${fit.minLng},${fit.maxLat},${fit.maxLng}` : '';
  useEffect(() => {
    if (!fit) return;
    const go = () => map.current?.fitBounds([[fit.minLat, fit.minLng], [fit.maxLat, fit.maxLng]], { maxZoom: 17, animate: false });
    if (map.current) go();
    else {
      const t = setInterval(() => map.current && (clearInterval(t), go()), 60);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={el} role="application" aria-label={label} className={cn('fos-map isolate z-0 h-full min-h-64 w-full overflow-hidden rounded-md border border-line bg-surface-subtle', className)} />;
}
