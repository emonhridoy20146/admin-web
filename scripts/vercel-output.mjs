#!/usr/bin/env node
// Turns the static export in ./out into Vercel's Build Output API v3 (.vercel/output), so Vercel serves it the way
// scripts/serve-static.mjs does (README "Hosting"):
//  - extensionless paths → 308 to the trailing-slash URL; trailing-slash URLs → <dir>/index.html
//  - /customers/<id>/ (and its RSC payload /customers/<id>/index.txt) → /customers/view/… (ADR-W02)
//  - unknown paths → 404.html with status 404
//  - the same security headers, incl. a CSP per HTML file whose script-src lists the sha256 hashes of that file's
//    inline bootstrap scripts (ADR-W09). The hashes change with every build, which is why this cannot live in a
//    static vercel.json.
// Run after `next build` (vercel.json buildCommand). Env: API_ORIGIN (default: origin of NEXT_PUBLIC_API_BASE_URL),
// TILE_ORIGIN, STORAGE_ORIGIN extend the CSP.
import fs from 'node:fs';
import path from 'node:path';
import { BASE_HEADERS, htmlHeaders } from './lib/csp.mjs';

const OUT = path.resolve('out');
const DEST = path.resolve('.vercel/output');

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
  console.error('vercel-output: ./out/index.html not found; run `next build` first');
  process.exit(1);
}

const env = { ...process.env };
if (!env.API_ORIGIN && env.NEXT_PUBLIC_API_BASE_URL) {
  try {
    env.API_ORIGIN = new URL(env.NEXT_PUBLIC_API_BASE_URL).origin;
  } catch {
    // relative base URL (same origin): 'self' already covers it
  }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '_next' ? [] : htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

const headerRoutes = [];
let notFoundHeaders;
for (const file of htmlFiles(OUT)) {
  const rel = path.relative(OUT, file).split(path.sep).join('/');
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
  // ADR-W02: one static page serves every customer id
  { src: '^/customers/(?!view/)[^/]+/$', dest: '/customers/view/index.html' },
  { src: '^/customers/(?!view/)[^/]+/index\\.txt$', dest: '/customers/view/index.txt' },
  { src: '^/(.*/)?$', dest: '/$1index.html', check: true },
  { handle: 'error' },
  { src: '^/.*$', dest: '/404.html', status: 404, ...(notFoundHeaders ? { headers: notFoundHeaders } : {}) },
];

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
fs.cpSync(OUT, path.join(DEST, 'static'), { recursive: true });
fs.writeFileSync(path.join(DEST, 'config.json'), `${JSON.stringify({ version: 3, routes }, null, 2)}\n`);

console.log(
  `vercel-output: ${headerRoutes.length} page header routes, connect-src extra: ${[env.API_ORIGIN, env.TILE_ORIGIN, env.STORAGE_ORIGIN].filter(Boolean).join(' ') || 'none'}`,
);
