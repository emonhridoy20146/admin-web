'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { LatLng } from './geo';
import { drawMarker } from './draw';
import type { MapMarker, MapViewState } from './map-view';
import { useTileProvider } from './use-tiles';

/** Below ~1e-7° (≈ 1 cm) two points are the same: stops value → map → value loops. */
const same = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

/**
 * Pick a point the way ride apps pick a pick-up spot (FR-CUS-011): the pin stays in the middle of the map and the
 * map moves under it (drag, scroll, arrow keys; a click or tap brings that spot to the pin). `onChange` gets the
 * point under the pin while the map moves. When `value` changes from outside (pasted coordinates) the map jumps there.
 * The map is a visual aid only: the dialog that uses it also shows the coordinates as text and accepts typed ones.
 */
export function MapPicker({ value, onChange, zoom = 17, reference, referenceLabel, markers, onView, label, className }: {
  value: LatLng;
  onChange: (p: LatLng) => void;
  zoom?: number;
  /** the pin as it is now, drawn hollow for comparison */
  reference?: LatLng | null;
  referenceLabel?: string;
  /** context drawn under the pin, never clickable (e.g. map places, FR-PLC-001): a click still brings that spot to the pin */
  markers?: MapMarker[];
  /** the visible box and zoom after each move (layers load what is in view) */
  onView?: (v: MapViewState) => void;
  label: string;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const tiles = useRef<Leaflet.TileLayer | null>(null);
  const refMarker = useRef<Leaflet.CircleMarker | null>(null);
  const last = useRef<LatLng>(value);
  const cb = useRef(onChange);
  cb.current = onChange;
  const viewCb = useRef(onView);
  viewCb.current = onView;
  const context = useRef<Leaflet.LayerGroup | null>(null);
  const [moving, setMoving] = useState(false);
  const provider = useTileProvider().data;

  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'currentColor';

  useEffect(() => {
    let dead = false;
    void import('leaflet').then((mod) => {
      if (dead || !el.current || map.current) return;
      const lf = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      L.current = lf;
      const m = lf.map(el.current, { center: [value.lat, value.lng], zoom, zoomControl: true, attributionControl: true, keyboardPanDelta: 40, fadeAnimation: false }); // see MapView: no ghost labels
      m.attributionControl.setPrefix(false);
      map.current = m;
      const emit = () => {
        const c = m.getCenter();
        const p = { lat: c.lat, lng: c.lng };
        if (same(p, last.current)) return;
        last.current = p;
        cb.current(p);
      };
      m.on('movestart', () => setMoving(true));
      m.on('move', emit);
      const emitView = () => {
        const b = m.getBounds();
        viewCb.current?.({ bounds: { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() }, zoom: m.getZoom() });
      };
      m.on('moveend', () => (setMoving(false), emit(), emitView()));
      m.on('click', (e: Leaflet.LeafletMouseEvent) => m.panTo(e.latlng));
      context.current = lf.layerGroup().addTo(m);
      setTiles();
      drawReference();
      drawContext();
      emitView();
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
      context.current = null;
    };
    // created once; later value changes go through the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTiles() {
    const lf = L.current;
    if (!lf || !map.current || !provider?.urlTemplate) return;
    tiles.current?.remove();
    tiles.current = lf.tileLayer(provider.urlTemplate.replace('{key}', provider.apiKeyRef ?? ''), { attribution: provider.attribution ?? '', maxZoom: provider.maxZoom ?? 19, subdomains: provider.subdomains?.length ? provider.subdomains : 'abc' }).addTo(map.current);
  }
  function drawReference() {
    const lf = L.current;
    if (!lf || !map.current) return;
    refMarker.current?.remove();
    refMarker.current = null;
    if (!reference) return;
    const color = token('--fg-secondary');
    refMarker.current = lf.circleMarker([reference.lat, reference.lng], { radius: 8, color, weight: 2.5, fillColor: color, fillOpacity: 0.12, interactive: !!referenceLabel });
    if (referenceLabel) refMarker.current.bindTooltip(referenceLabel, { direction: 'top', offset: [0, -6] });
    refMarker.current.addTo(map.current);
  }

  function drawContext() {
    const lf = L.current;
    if (!lf || !context.current) return;
    context.current.clearLayers();
    for (const mk of markers ?? []) drawMarker(lf, context.current, { ...mk, passive: true }, token);
  }

  useEffect(setTiles, [provider]);
  useEffect(drawContext, [markers]);
  useEffect(drawReference, [reference?.lat, reference?.lng, referenceLabel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!map.current || same(value, last.current)) return;
    last.current = value;
    map.current.setView([value.lat, value.lng], Math.max(map.current.getZoom(), 16), { animate: false });
  }, [value]);

  return (
    <div className={cn('relative isolate z-0 h-full min-h-64 w-full overflow-hidden rounded-md border border-line bg-surface-subtle', className)}>
      <div ref={el} role="application" aria-label={label} className="fos-map h-full w-full" />
      {/* The pin itself: fixed in the middle, its tip on the map centre. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-[500]" aria-hidden>
        <span className={cn('absolute -translate-x-1/2 rounded-full bg-fg/30 transition-all', moving ? 'size-2.5 -translate-y-1/2 opacity-60' : 'size-1.5 -translate-y-1/2 opacity-90')} />
        <MapPin
          className={cn('absolute size-10 -translate-x-1/2 fill-primary text-primary-fg drop-shadow-md transition-transform duration-150 motion-reduce:transition-none', moving ? '-translate-y-[calc(100%+8px)]' : '-translate-y-full')}
          strokeWidth={1.75}
        />
      </div>
    </div>
  );
}
