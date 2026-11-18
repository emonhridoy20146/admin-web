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
import { BASE_HEADERS, htmlHeaders } from './lib/csp.mjs';

const ROOT = path.resolve('out');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };

const htmlCache = new Map();

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
      ...BASE_HEADERS,
      'Cache-Control': file.includes(`${path.sep}_next${path.sep}static${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    if (ext === '.html') {
      if (!htmlCache.has(file)) htmlCache.set(file, htmlHeaders(body.toString('utf8')));
      Object.assign(headers, htmlCache.get(file));
    }
    res.writeHead(status, headers);
    res.end(body);
  })
  .listen(PORT, () => console.log(`serving ./out on http://localhost:${PORT}`));
