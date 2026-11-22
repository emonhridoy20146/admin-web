export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** `minLng,minLat,maxLng,maxLat` rounded to 5 decimals (≈ 1 m): stable query keys while panning a little. */
export function bboxParam(b: Bounds): string {
  const r = (n: number) => (Math.round(n * 1e5) / 1e5).toString();
  return [b.minLng, b.minLat, b.maxLng, b.maxLat].map(r).join(',');
}

/** Reads a loosely typed `{ lat, lng }` (contract leaves some pins as free objects). */
export function readLatLng(v: unknown): LatLng | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return typeof o.lat === 'number' && typeof o.lng === 'number' && Number.isFinite(o.lat) && Number.isFinite(o.lng) ? { lat: o.lat, lng: o.lng } : null;
}

/** Bounds that contain all points, padded; null for an empty list. */
export function boundsOf(points: LatLng[], padDeg = 0.002): Bounds | null {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return { minLat: Math.min(...lats) - padDeg, maxLat: Math.max(...lats) + padDeg, minLng: Math.min(...lngs) - padDeg, maxLng: Math.max(...lngs) + padDeg };
}

/** Decodes a Google encoded polyline (precision 5), the format of `GET /location/history`. */
export function decodePolyline(encoded: string | undefined | null): LatLng[] {
  const out: LatLng[] = [];
  if (!encoded) return out;
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    lat += next();
    lng += next();
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

/** Same generous Bangladesh box as field-api `core/geo` (a pin outside it is refused with OUTSIDE_BANGLADESH). */
export const BD_BOUNDS: Bounds = { minLat: 20.3, maxLat: 26.8, minLng: 87.9, maxLng: 92.8 };

export function inBangladesh(p: LatLng): boolean {
  return p.lat >= BD_BOUNDS.minLat && p.lat <= BD_BOUNDS.maxLat && p.lng >= BD_BOUNDS.minLng && p.lng <= BD_BOUNDS.maxLng;
}

/**
 * Reads coordinates someone pasted: `22.70123, 90.37011`, `22.70123 90.37011`, `22.70123° N, 90.37011° E`
 * (Google Maps / WhatsApp location) or a maps link containing `@lat,lng` or `q=lat,lng`. Bangla digits are accepted.
 * When the first number is clearly a longitude (and the second a latitude) for Bangladesh, the pair is swapped.
 */
export function parseCoords(text: string): LatLng | null {
  const ascii = text.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6)).trim();
  if (!ascii) return null;
  const link = /[@=](-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(ascii);
  const nums = link ? [link[1]!, link[2]!] : ascii.match(/-?\d{1,3}(?:\.\d+)?/g);
  if (!nums || nums.length !== 2) return null;
  let lat = Number(nums[0]);
  let lng = Number(nums[1]);
  if (/\d\s*°?\s*S\b/i.test(ascii)) lat = -Math.abs(lat);
  if (/\d\s*°?\s*W\b/i.test(ascii)) lng = -Math.abs(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // "90.37, 22.70" (lng first) is a common slip; swap when only the swapped pair makes sense.
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (!inBangladesh({ lat, lng }) && inBangladesh({ lat: lng, lng: lat })) [lat, lng] = [lng, lat];
  return { lat, lng };
}

/** `22.70123, 90.37011` — five decimals ≈ 1 m. */
export function formatCoords(p: LatLng): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

export interface MapViewpoint {
  center: LatLng;
  zoom: number;
}

/**
 * Where every map opens when nothing better is known (no saved view, no branch point, nothing to fit): Galachipa
 * upazila, Patuakhali, at zoom 12 (owner decision 2026-11-22). Earlier: Patuakhali district (ADR-W18).
 */
export const DEFAULT_VIEW: MapViewpoint = { center: { lat: 22.164, lng: 90.426 }, zoom: 12 };
/** The starting point of a pin picker with nothing better to start from (the default view's centre). */
export const DEFAULT_POINT: LatLng = DEFAULT_VIEW.center;

/** `22.35960,90.32990,12` → view; null for anything outside Bangladesh or an unusable zoom (the param is user-editable). */
export function parseViewpoint(v: string | null | undefined): MapViewpoint | null {
  const m = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?),(\d{1,2})$/.exec((v ?? '').trim());
  if (!m) return null;
  const center = { lat: Number(m[1]), lng: Number(m[2]) };
  const zoom = Number(m[3]);
  return inBangladesh(center) && zoom >= 6 && zoom <= 19 ? { center, zoom } : null;
}

export function viewpointParam(v: MapViewpoint): string {
  return `${v.center.lat.toFixed(5)},${v.center.lng.toFixed(5)},${Math.round(v.zoom)}`;
}

export function centerOf(b: Bounds): LatLng {
  return { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 };
}

/** A box of about `km` around a point (for "go to this branch"). */
export function boxAround(p: LatLng, km = 3): Bounds {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((p.lat * Math.PI) / 180));
  return { minLat: p.lat - dLat, maxLat: p.lat + dLat, minLng: p.lng - dLng, maxLng: p.lng + dLng };
}

/**
 * The map point of the branch being looked at: the chosen branch when it has one, or the only branch of someone who
 * works in one branch. Null otherwise (all branches, or a branch without a point) — then maps open on DEFAULT_VIEW.
 */
export function branchPoint(list: { id?: string; lat?: number | null; lng?: number | null }[] | undefined, branchId: string | undefined): LatLng | null {
  const pick = branchId ? list?.find((b) => b.id === branchId) : list?.length === 1 ? list[0] : undefined;
  return pick && typeof pick.lat === 'number' && typeof pick.lng === 'number' ? { lat: pick.lat, lng: pick.lng } : null;
}
