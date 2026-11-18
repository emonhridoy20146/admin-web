// Builds the Vercel Build Output API v3 routes for the static export (used by scripts/vercel-output.mjs).
// Kept free of side effects so scripts/lib/vercel-config.test.mjs can check it against a fake ./out.
import fs from 'node:fs';
import path from 'node:path';
import { BASE_HEADERS, htmlHeaders } from './csp.mjs';

/** field-api's default tile provider (settings `map.tileProvider`, osm) serves from these hosts. */
export const DEFAULT_TILE_ORIGIN = 'https://tile.openstreetmap.org https://*.tile.openstreetmap.org';

/**
 * CSP origins for a Vercel build. API_ORIGIN defaults to the origin of NEXT_PUBLIC_API_BASE_URL (the URL the app
 * calls), so login can never be blocked by a forgotten env; TILE_ORIGIN defaults to OpenStreetMap so the maps load.
 * Set either env in the Vercel project to override (TILE_ORIGIN when the tile provider in Settings changes).
 */
export function cspEnv(env) {
  const out = { ...env };
  if (!out.API_ORIGIN && out.NEXT_PUBLIC_API_BASE_URL) {
    try {
      out.API_ORIGIN = new URL(out.NEXT_PUBLIC_API_BASE_URL).origin;
    } catch {
      // relative base URL (same origin): 'self' already covers it
    }
  }
  if (!out.TILE_ORIGIN) out.TILE_ORIGIN = DEFAULT_TILE_ORIGIN;
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '_next' ? [] : htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

/** Routes for .vercel/output/config.json. `env` must already be passed through cspEnv. */
export function vercelRoutes(outDir, env) {
  const headerRoutes = [];
  let notFoundHeaders;
  for (const file of htmlFiles(outDir)) {
    const rel = path.relative(outDir, file).split(path.sep).join('/');
    const headers = { ...BASE_HEADERS, ...htmlHeaders(fs.readFileSync(file, 'utf8'), env) };
    if (rel === '404.html') notFoundHeaders = headers;
    if (rel.endsWith('index.html')) {
      const dir = rel.slice(0, -'index.html'.length); // '' or 'login/'
      headerRoutes.push({ src: `^/${esc(dir)}(?:index\\.html)?$`, headers, continue: true });
      if (dir === 'customers/view/') headerRoutes.push({ src: '^/customers/(?!view/)[^/]+/$', headers, continue: true });
    } else {
      headerRoutes.push({ src: `^/${esc(rel)}$`, headers, continue: true });
    }
  }

  const routes = [
    // trailingSlash: true — paths without an extension get the slash (as `next dev` and serve-static do)
    { src: '^/((?:[^/]+/)*[^/.]+)$', status: 308, headers: { Location: '/$1/' } },
    { src: '^/.*$', headers: BASE_HEADERS, continue: true },
    { src: '^/_next/static/.*$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    ...headerRoutes,
    { handle: 'filesystem' },
    // ADR-W02: one static page serves every customer id. `check: true` makes Vercel look the destination up in the
    // static files (what vercel.json `rewrites` compile to); without it the rewrite fell through to the 404 page.
    { src: '^/customers/(?!view/)[^/]+/$', dest: '/customers/view/index.html', check: true },
    { src: '^/customers/(?!view/)[^/]+/index\\.txt$', dest: '/customers/view/index.txt', check: true },
    { src: '^/(.*/)?$', dest: '/$1index.html', check: true },
    { handle: 'error' },
    { src: '^/.*$', dest: '/404.html', status: 404, ...(notFoundHeaders ? { headers: notFoundHeaders } : {}) },
  ];
  return { routes, pageCount: headerRoutes.length };
}
