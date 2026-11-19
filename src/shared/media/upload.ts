/**
 * Photo upload through field-api presigned URLs (contract `/media/upload-url` → PUT → `/media/{id}/confirm`).
 * The browser re-encodes the picture to JPEG (≤ 1600 px, ≤ 1 MB): the API limit is 1 MiB, and re-encoding drops
 * camera metadata such as GPS tags. Nothing is stored locally; the file only lives in memory until it is sent.
 */
import { api, unwrap } from '../api/client';
import { viaApiProxy } from '../api/config';
import type { paths } from '../api/schema';

export type MediaKind = paths['/media/upload-url']['post']['requestBody']['content']['application/json']['kind'];

export const MAX_BYTES = 1_048_576;
export const MAX_SIDE = 1600;
export const UPLOAD_TYPES = ['image/jpeg', 'image/webp'] as const;

export type PrepareError = 'notImage' | 'tooBig' | 'unreadable';

/** Size that fits inside `max` × `max` keeping the aspect ratio; never upscales. */
export function fitWithin(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', quality));
}

/** Turns a picked file into an upload-ready JPEG, or says why it cannot be used. */
export async function prepareImage(file: File): Promise<{ blob: Blob } | { error: PrepareError }> {
  if (!file.type.startsWith('image/')) return { error: 'notImage' };
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    // the browser cannot decode it (e.g. HEIC on some systems): send it as is only when the API accepts it unchanged
    return (UPLOAD_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_BYTES ? { blob: file } : { error: 'unreadable' };
  }
  const { w, h } = fitWithin(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  for (const q of [0.85, 0.7, 0.55]) {
    const b = await encode(canvas, q);
    if (b && b.size <= MAX_BYTES) return { blob: b };
  }
  return { error: 'tooBig' };
}

/** Uploads one prepared image and returns its media id once the server has confirmed it. */
export async function uploadMedia(kind: MediaKind, blob: Blob): Promise<string> {
  const sha256 = await sha256Hex(await blob.arrayBuffer());
  const contentType = (blob.type || 'image/jpeg') as (typeof UPLOAD_TYPES)[number];
  const slot = await unwrap(api.POST('/media/upload-url', { body: { kind, contentType, sizeBytes: blob.size, sha256, capturedAt: new Date().toISOString() } }));
  if (!slot.mediaId) throw new Error('upload slot without media id');
  if (!slot.alreadyExists) {
    if (!slot.uploadUrl) throw new Error('upload slot without url');
    const put = await fetch(viaApiProxy(slot.uploadUrl), { method: 'PUT', body: blob, headers: { 'Content-Type': contentType, ...(slot.headers ?? {}) } });
    if (!put.ok) throw new Error(`upload failed: ${put.status}`);
  }
  await unwrap(api.POST('/media/{id}/confirm', { params: { path: { id: slot.mediaId } } }));
  return slot.mediaId;
}
