// Shared by scripts/serve-static.mjs (local/E2E host) and scripts/vercel-output.mjs (Vercel), so both send the same
// security headers (ADR-W09, NFR-W-002). Extra origins come from env: API_ORIGIN, TILE_ORIGIN, STORAGE_ORIGIN.
import crypto from 'node:crypto';

/** sha256 source expressions of every inline <script> in one HTML file (Next.js static export bootstrap scripts). */
export function inlineHashes(html) {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter(Boolean)
    .map((s) => `'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`);
  return [...new Set(hashes)].join(' ');
}

export function csp(hashes, env = process.env) {
  const extra = (k) => (env[k] ? ` ${env[k]}` : '');
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    // API origin: photo links point at the API itself when it keeps files in its database (field-api ADR-039).
    `img-src 'self' data: blob:${extra('API_ORIGIN')}${extra('TILE_ORIGIN')}${extra('STORAGE_ORIGIN')}`,
    `connect-src 'self'${extra('API_ORIGIN')}${extra('TILE_ORIGIN')}${extra('STORAGE_ORIGIN')}`,
    "font-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Headers every response gets. */
export const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // geolocation=(self): the "my location" button on the maps (FR-W-034); the browser still asks the user first.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

/** Headers an HTML response gets on top of BASE_HEADERS. */
export function htmlHeaders(html, env = process.env) {
  return { 'Content-Security-Policy': csp(inlineHashes(html), env), 'X-Frame-Options': 'DENY' };
}
