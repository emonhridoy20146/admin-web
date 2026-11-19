import { afterEach, describe, expect, it, vi } from 'vitest';
import { viaApiProxy } from '../config';

// field-api ADR-039 hands out file URLs on its own host when it keeps files in its database; with the same-origin
// API proxy (ADR-W19) the browser must not call that host (CSP 'self'), so those URLs go through /api/v1 instead.
describe('viaApiProxy', () => {
  afterEach(() => vi.unstubAllEnvs());
  const own = 'https://howlader-apps-api.vercel.app/api/v1/storage/o?t=abc.def';

  it('sends API-stored files through the proxy when the app calls a relative /api/v1', () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCK', '');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1');
    expect(viaApiProxy(own)).toBe('/api/v1/storage/o?t=abc.def');
    expect(viaApiProxy('https://acc.r2.cloudflarestorage.com/fos-media/a.jpg?X-Amz-Signature=1')).toBe('https://acc.r2.cloudflarestorage.com/fos-media/a.jpg?X-Amz-Signature=1');
    expect(viaApiProxy(undefined)).toBeUndefined();
  });

  it('leaves URLs alone when the app calls the API host directly', () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCK', '');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://howlader-apps-api.vercel.app/api/v1');
    expect(viaApiProxy(own)).toBe(own);
  });
});
