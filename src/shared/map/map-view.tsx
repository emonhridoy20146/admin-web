'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import { cn } from '@/shared/lib/cn';
import type { Bounds, LatLng } from './geo';
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
}

export interface MapCluster extends LatLng {
  count: number;
  token: string;
  label: string;
}

export interface MapViewState {
  bounds: Bounds;
  zoom: number;
}

/**
 * Leaflet wrapper (loaded on the client only: Leaflet touches `window` at import). Markers are vector circles
 * coloured from design tokens, so no marker images and no extra CSP hosts beyond the tile origin.
 * The map is a visual aid; every page that uses it also lists the same items as text (keyboard / screen reader).
 */
export function MapView({ center, zoom = 13, markers, clusters, lines, fit, onView, onMarkerClick, onClusterClick, className, label }: {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  clusters?: MapCluster[];
  lines?: [LatLng, LatLng][];
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
  const redraw = useRef<() => void>(() => undefined);

  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'currentColor';

  redraw.current = () => {
    const lf = L.current;
    if (!lf || !layer.current) return;
    layer.current.clearLayers();
    for (const [a, b] of lines ?? []) lf.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: token('--fg-secondary'), weight: 2, dashArray: '4 6' }).addTo(layer.current);
    for (const c of clusters ?? []) {
      const size = c.count > 200 ? 46 : c.count > 50 ? 40 : 34;
      const icon = lf.divIcon({ className: '', iconSize: [size, size], html: `<span class="fos-cluster" style="--c:${token(c.token)};width:${size}px;height:${size}px">${c.label}</span>` });
      lf.marker([c.lat, c.lng], { icon, keyboard: false, title: c.label }).on('click', () => cb.current.onClusterClick?.(c)).addTo(layer.current);
    }
    for (const m of markers ?? []) {
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
      const m = lf.map(el.current, { center: [center.lat, center.lng], zoom, zoomControl: true, attributionControl: true });
      m.attributionControl.setPrefix(false);
      map.current = m;
      layer.current = lf.layerGroup().addTo(m);
      const emit = () => {
        const b = m.getBounds();
        cb.current.onView?.({ bounds: { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() }, zoom: m.getZoom() });
      };
      m.on('moveend', emit);
      ready.current = true;
      redraw.current();
      emit();
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
    // the map is created once; later centre changes go through `fit`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lf = L.current;
    if (!lf || !map.current || !provider?.urlTemplate) return;
    tiles.current?.remove();
    tiles.current = lf.tileLayer(provider.urlTemplate.replace('{key}', provider.apiKeyRef ?? ''), { attribution: provider.attribution ?? '', maxZoom: provider.maxZoom ?? 19, subdomains: provider.subdomains?.length ? provider.subdomains : 'abc' }).addTo(map.current);
  });

  useEffect(() => {
    if (ready.current) redraw.current();
  }, [markers, clusters, lines]);

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
