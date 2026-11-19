export function apiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_MOCK === '1') return '/api/v1';
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';
}
export const isMockApi = () => process.env.NEXT_PUBLIC_API_MOCK === '1';

/**
 * A file URL that points at field-api's own storage (`/api/v1/storage/…`, used when the API keeps files in its
 * database, field-api ADR-039) is sent through the same-origin API proxy when the app uses one (ADR-W19), so the
 * CSP can stay `'self'` and the browser never calls the API host. S3 / R2 URLs and everything else are unchanged.
 */
export function viaApiProxy(url: string): string;
export function viaApiProxy(url: string | undefined): string | undefined;
export function viaApiProxy(url: string | undefined): string | undefined {
  if (!url || !apiBaseUrl().startsWith('/')) return url;
  try {
    const u = new URL(url);
    return u.pathname.startsWith('/api/v1/storage/') ? `${u.pathname}${u.search}` : url;
  } catch {
    return url; // already relative
  }
}
