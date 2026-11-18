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
// TILE_ORIGIN (default: OpenStreetMap), STORAGE_ORIGIN extend the CSP. The routes live in scripts/lib/vercel-config.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { cspEnv, vercelRoutes } from './lib/vercel-config.mjs';

const OUT = path.resolve('out');
const DEST = path.resolve('.vercel/output');

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
  console.error('vercel-output: ./out/index.html not found; run `next build` first');
  process.exit(1);
}

const env = cspEnv(process.env);
const { routes, pageCount } = vercelRoutes(OUT, env);

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
fs.cpSync(OUT, path.join(DEST, 'static'), { recursive: true });
fs.writeFileSync(path.join(DEST, 'config.json'), `${JSON.stringify({ version: 3, routes }, null, 2)}\n`);

console.log(
  `vercel-output: ${pageCount} page header routes; connect-src extra: ${[env.API_ORIGIN, env.TILE_ORIGIN, env.STORAGE_ORIGIN].filter(Boolean).join(' ') || 'none'}`,
);
if (!env.API_ORIGIN) console.warn('vercel-output: NEXT_PUBLIC_API_BASE_URL is not set; the CSP only allows same-origin API calls');
