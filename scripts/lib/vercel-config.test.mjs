// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cspEnv, DEFAULT_TILE_ORIGIN, vercelRoutes } from './vercel-config.mjs';
import { apiProxy } from './api-proxy.mjs';
import { BASE_HEADERS } from './csp.mjs';

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
      // photos served by the API itself when it keeps files in its database (field-api ADR-039)
      expect(directive(csp, 'img-src')).toContain('https://howlader-apps-api.vercel.app');
      // staff photos in Cloudinary (field-api 1.37.0, ADR-050): images only
      expect(directive(csp, 'img-src')).toContain('https://api.cloudinary.com');
      expect(directive(csp, 'img-src')).toContain('https://res.cloudinary.com');
      expect(directive(csp, 'connect-src')).not.toContain('cloudinary');
      expect(directive(csp, 'script-src')).toMatch(/^script-src 'self' 'sha256-[^']+'$/);
    }
  });

  it("lets the maps ask for the admin's own location, and nothing else", () => {
    const pp = BASE_HEADERS['Permissions-Policy'];
    expect(pp).toContain('geolocation=(self)');
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
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

// ADR-W19: the refresh cookie is SameSite=Strict, so on two *.vercel.app addresses it was never stored and every reload
// signed the user out. On Vercel the admin host forwards /api/v1/* to the API and the browser calls its own origin.
describe('same-origin API proxy (ADR-W19)', () => {
  const API = 'https://howlader-apps-api.vercel.app/api/v1';

  it('is on during a Vercel build with an absolute API URL, calls /api/v1 and forwards to the real API', () => {
    expect(apiProxy({ VERCEL: '1', NEXT_PUBLIC_API_BASE_URL: API })).toEqual({ publicBase: '/api/v1', target: 'https://howlader-apps-api.vercel.app/api/v1' });
    expect(apiProxy({ VERCEL: '1', NEXT_PUBLIC_API_BASE_URL: `${API}/` })?.target).toBe(API);
  });
  it('keeps /api/v1 as the browser path, because field-api sets the cookie for /api/v1/auth', () => {
    expect(apiProxy({ VERCEL: '1', NEXT_PUBLIC_API_BASE_URL: 'https://api.example.com/v1' })).toEqual({ publicBase: '/api/v1', target: 'https://api.example.com/v1' });
  });
  it('is off locally, in mock builds, for a relative URL, and with API_PROXY=0', () => {
    expect(apiProxy({ NEXT_PUBLIC_API_BASE_URL: API })).toBeNull();
    expect(apiProxy({ VERCEL: '1', NEXT_PUBLIC_API_BASE_URL: API, NEXT_PUBLIC_API_MOCK: '1' })).toBeNull();
    expect(apiProxy({ VERCEL: '1', NEXT_PUBLIC_API_BASE_URL: '/api/v1' })).toBeNull();
    expect(apiProxy({ VERCEL: '1', NEXT_PUBLIC_API_BASE_URL: API, API_PROXY: '0' })).toBeNull();
    expect(apiProxy({ VERCEL: '1' })).toBeNull();
  });
  it('API_PROXY=1 turns it on on another host', () => {
    expect(apiProxy({ API_PROXY: '1', NEXT_PUBLIC_API_BASE_URL: API })?.target).toBe(API);
  });

  const env = cspEnv({ VERCEL: '1', NEXT_PUBLIC_API_BASE_URL: API });
  it('forwards /api/v1/* before the trailing-slash redirect, so a POST is not redirected', () => {
    const { routes } = vercelRoutes(out, env);
    expect(routes[0]).toEqual({ src: '^/api/v1/(.*)$', dest: `${API}/$1` });
    const re = new RegExp(routes[0].src);
    expect(re.exec('/api/v1/auth/refresh')?.[1]).toBe('auth/refresh');
    expect(re.exec('/api/v1/customers/6731abc/location')?.[1]).toBe('customers/6731abc/location');
    expect(re.test('/api/v2/x')).toBe(false);
    expect(re.test('/customers/')).toBe(false);
  });
  it('does not add the API origin to the CSP: the browser only calls its own origin', () => {
    const { routes } = vercelRoutes(out, env);
    expect(directive(cspOf(routes, '^/login/(?:index\\.html)?$'), 'connect-src')).not.toContain('vercel.app');
    expect(env.API_ORIGIN).toBeUndefined();
  });
  it('adds no route when the proxy is off', () => {
    const { routes } = vercelRoutes(out, cspEnv({ NEXT_PUBLIC_API_BASE_URL: API }));
    expect(routes.some((r) => r.dest?.includes('/api/v1'))).toBe(false);
  });
});
