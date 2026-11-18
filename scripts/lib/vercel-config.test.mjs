// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cspEnv, DEFAULT_TILE_ORIGIN, vercelRoutes } from './vercel-config.mjs';

const page = (script) => `<!DOCTYPE html><html><head><script src="/_next/static/a.js"></script></head><body><script>${script}</script></body></html>`;
let out;

beforeAll(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-config-'));
  const write = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.writeFileSync(path.join(out, rel), body);
  };
  write('index.html', page('self.__next_f.push([0])'));
  write('login/index.html', page('self.__next_f.push([1])'));
  write('customers/view/index.html', page('self.__next_f.push([2])'));
  write('customers/view/index.txt', 'rsc');
  write('404.html', page('self.__next_f.push([3])'));
  write('_next/static/a.js', '');
});
afterAll(() => fs.rmSync(out, { recursive: true, force: true }));

const cspOf = (routes, src) => routes.find((r) => r.src === src && r.headers?.['Content-Security-Policy'])?.headers['Content-Security-Policy'];
const directive = (csp, name) => csp.split('; ').find((d) => d.startsWith(`${name} `));

describe('cspEnv', () => {
  it('takes the API origin from NEXT_PUBLIC_API_BASE_URL and defaults the tile hosts to OpenStreetMap', () => {
    const env = cspEnv({ NEXT_PUBLIC_API_BASE_URL: 'https://howlader-apps-api.vercel.app/api/v1' });
    expect(env.API_ORIGIN).toBe('https://howlader-apps-api.vercel.app');
    expect(env.TILE_ORIGIN).toBe(DEFAULT_TILE_ORIGIN);
  });
  it('keeps explicit origins', () => {
    const env = cspEnv({ NEXT_PUBLIC_API_BASE_URL: 'https://a.example.com/api/v1', API_ORIGIN: 'https://b.example.com', TILE_ORIGIN: 'https://tiles.example.com' });
    expect(env.API_ORIGIN).toBe('https://b.example.com');
    expect(env.TILE_ORIGIN).toBe('https://tiles.example.com');
  });
  it('leaves the API to self for a relative base URL', () => {
    expect(cspEnv({ NEXT_PUBLIC_API_BASE_URL: '/api/v1' }).API_ORIGIN).toBeUndefined();
  });
});

describe('vercelRoutes', () => {
  const env = cspEnv({ NEXT_PUBLIC_API_BASE_URL: 'https://howlader-apps-api.vercel.app/api/v1' });

  it('allows the API and the map tiles on every page', () => {
    const { routes } = vercelRoutes(out, env);
    for (const src of ['^/(?:index\\.html)?$', '^/login/(?:index\\.html)?$', '^/customers/(?!view/)[^/]+/$']) {
      const csp = cspOf(routes, src);
      expect(directive(csp, 'connect-src')).toContain('https://howlader-apps-api.vercel.app');
      expect(directive(csp, 'connect-src')).toContain('https://tile.openstreetmap.org');
      expect(directive(csp, 'img-src')).toContain('https://tile.openstreetmap.org');
      expect(directive(csp, 'img-src')).toContain('https://*.tile.openstreetmap.org');
      expect(directive(csp, 'script-src')).toMatch(/^script-src 'self' 'sha256-[^']+'$/);
    }
  });

  it('rewrites customer pages to the one static page and checks the file exists (ADR-W02)', () => {
    const { routes } = vercelRoutes(out, env);
    const fsAt = routes.findIndex((r) => r.handle === 'filesystem');
    const page = routes.findIndex((r) => r.dest === '/customers/view/index.html');
    const rsc = routes.findIndex((r) => r.dest === '/customers/view/index.txt');
    expect(page).toBeGreaterThan(fsAt);
    expect(rsc).toBeGreaterThan(fsAt);
    expect(routes[page]).toMatchObject({ check: true });
    expect(routes[rsc]).toMatchObject({ check: true });
    for (const r of [routes[page], routes[rsc]]) expect(fs.existsSync(path.join(out, r.dest))).toBe(true);

    const pageRe = new RegExp(routes[page].src);
    expect(pageRe.test('/customers/6731abc/')).toBe(true);
    expect(pageRe.test('/customers/view/')).toBe(false);
    expect(pageRe.test('/customers/')).toBe(false);
    const rscRe = new RegExp(routes[rsc].src);
    expect(rscRe.test('/customers/6731abc/index.txt')).toBe(true);
    expect(rscRe.test('/customers/view/index.txt')).toBe(false);
  });

  it('serves the customer page with the CSP of /customers/view/', () => {
    const { routes } = vercelRoutes(out, env);
    expect(cspOf(routes, '^/customers/(?!view/)[^/]+/$')).toBe(cspOf(routes, '^/customers/view/(?:index\\.html)?$'));
  });
});
