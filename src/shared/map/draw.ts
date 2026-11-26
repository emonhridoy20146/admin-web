import type * as Leaflet from 'leaflet';
import type { MapMarker } from './map-view';
import { pinIconHtml, pinSize, tileIconHtml, tileSize } from './pin-icon';

/**
 * Draws one marker (dot, pin or place tile) on a Leaflet layer group. Shared by `MapView` and `MapPicker` so a
 * marker looks the same on every map. `onClick` is left out (or the marker is `passive`) for markers that only show.
 */
export function drawMarker(lf: typeof Leaflet, group: Leaflet.LayerGroup, m: MapMarker, token: (name: string) => string, onClick?: (id: string) => void) {
  const interactive = !m.passive && !!onClick;
  const click = () => onClick?.(m.id);
  if (m.tile) {
    const s = tileSize(m.strong);
    const icon = lf.divIcon({ className: '', iconSize: [s, s], iconAnchor: [s / 2, s / 2], html: tileIconHtml(m.tile, m.strong) });
    const mk = lf.marker([m.lat, m.lng], { icon, keyboard: false, interactive, riseOnHover: interactive, title: m.label || !interactive ? '' : m.title, zIndexOffset: (m.z ?? 0) * 1000 + (m.strong ? 10_000 : 0) });
    if (m.label) mk.bindTooltip(m.label, { permanent: true, direction: 'right', offset: [s / 2, 0], className: 'fos-map-label', interactive: false });
    else if (interactive) mk.bindTooltip(m.title, { direction: 'top', offset: [0, -s / 2] });
    if (interactive) mk.on('click', click);
    mk.addTo(group);
    return;
  }
  if (m.pin) {
    const [w, h] = pinSize(m.strong);
    // an inert pin stays hoverable (its tooltip says why) but takes no click
    const icon = lf.divIcon({ className: m.inert ? 'fos-marker-inert' : '', iconSize: [w, h], iconAnchor: [w / 2, h], tooltipAnchor: [0, -h + 4], html: pinIconHtml(m.pin, m.strong) });
    const mk = lf.marker([m.lat, m.lng], { icon, keyboard: false, interactive, riseOnHover: interactive && !m.inert, title: m.label ? m.title : '', zIndexOffset: (m.z ?? 0) * 1000 + (m.strong ? 10_000 : 0) })
      .bindTooltip(m.label ?? m.title, m.label ? { permanent: true, direction: 'right', offset: [w / 2 - 2, -h / 2], className: 'fos-map-label' } : { direction: 'top' });
    if (interactive && !m.inert) mk.on('click', click);
    mk.addTo(group);
    if (m.inert) mk.getElement()?.setAttribute('aria-disabled', 'true');
    return;
  }
  const color = token(m.token);
  const mk = lf
    .circleMarker([m.lat, m.lng], { interactive, radius: m.strong ? 9 : 6, color: m.hollow ? color : token('--surface'), weight: m.hollow ? 2.5 : 1.5, fillColor: color, fillOpacity: m.hollow ? 0.12 : 0.95 })
    .bindTooltip(m.label ?? m.title, m.label ? { permanent: true, direction: 'right', offset: [8, 0], className: 'fos-map-label' } : { direction: 'top', offset: [0, -6] });
  if (interactive) mk.on('click', click);
  mk.addTo(group);
}
