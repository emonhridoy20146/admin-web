#!/usr/bin/env node
// Serves the static export in ./out the way production hosting must (README "Hosting"):
//  - trailing-slash URLs → <dir>/index.html
//  - /customers/<id>/ (and its RSC payload /customers/<id>/index.txt) → /customers/view/… (ADR-W02)
//  - unknown paths → 404.html
//  - security headers incl. a CSP whose script-src lists sha256 hashes of the inline bootstrap scripts Next.js emits,
//    so no 'unsafe-inline' is needed (NFR-W-002). Hashes are computed per HTML file.
// Usage: node scripts/serve-static.mjs [port]   (env API_ORIGIN, TILE_ORIGIN, STORAGE_ORIGIN extend the CSP)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve('out');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };
const extra = (k) => (process.env[k] ? ` ${process.env[k]}` : '');

const hashCache = new Map();
function inlineHashes(file, html) {
  if (hashCache.has(file)) return hashCache.get(file);
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter(Boolean)
    .map((s) => `'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`);
  const v = [...new Set(hashes)].join(' ');
  hashCache.set(file, v);
  return v;
}

function csp(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${extra('TILE_ORIGIN')}${extra('STORAGE_ORIGIN')}`,
    `connect-src 'self'${extra('API_ORIGIN')}${extra('TILE_ORIGIN')}${extra('STORAGE_ORIGIN')}`,
    "font-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function resolve(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  // ADR-W02: one static page serves every customer id.
  p = p.replace(/^\/customers\/(?!view\/)[^/]+\/(index\.txt)?$/, (_m, txt) => `/customers/view/${txt ?? ''}`);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  if (!path.extname(file) && fs.existsSync(path.join(file, 'index.html'))) return { redirect: `${urlPath.split('?')[0]}/` };
  return null;
}

http
  .createServer((req, res) => {
    const r = resolve(req.url ?? '/');
    if (r && typeof r === 'object') {
      res.writeHead(308, { Location: r.redirect });
      return res.end();
    }
    const file = r ?? path.join(ROOT, '404.html');
    const status = r ? 200 : 404;
    const ext = path.extname(file);
    const body = fs.readFileSync(file);
    const headers = {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cache-Control': file.includes(`${path.sep}_next${path.sep}static${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    if (ext === '.html') {
      headers['Content-Security-Policy'] = csp(inlineHashes(file, body.toString('utf8')));
      headers['X-Frame-Options'] = 'DENY';
    }
    res.writeHead(status, headers);
    res.end(body);
  })
  .listen(PORT, () => console.log(`serving ./out on http://localhost:${PORT}`));
