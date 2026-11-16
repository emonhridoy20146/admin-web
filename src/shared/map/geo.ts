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
