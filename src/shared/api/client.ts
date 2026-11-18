/**
 * Typed field-api client (ADR-W04). Types are generated from the pinned openapi.yaml — never hand-written.
 * Middleware: bearer token, Accept-Language, X-Client; 401 TOKEN_EXPIRED → single-flight refresh → retry once.
 */
import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { apiBaseUrl } from './config';
import { useSession } from '../auth/session';
import { refreshSession } from '../auth/refresh';
import { getFormatPrefs } from '../lib/format';
import { ApiError, toApiError } from './problem';

function withAuth(req: Request): Request {
  const headers = new Headers(req.headers);
  const token = useSession.getState().accessToken;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept-Language', getFormatPrefs().locale);
  headers.set('X-Client', 'web');
  return new Request(req, { headers, credentials: 'include' });
}

async function authFetch(input: Request): Promise<Response> {
  const retry = input.clone();
  const res = await globalThis.fetch(withAuth(input));
  if (res.status !== 401) return res;
  const body = (await res.clone().json().catch(() => ({}))) as { code?: string };
  if (body.code !== 'TOKEN_EXPIRED' && body.code !== 'UNAUTHENTICATED') return res;
  const ok = await refreshSession();
  if (!ok) return res;
  return globalThis.fetch(withAuth(retry));
}

// Array query parameters are `form` + `explode: false` in the contract (`filter=overdue,due_today`); openapi-fetch
// repeats the key by default, which field-api refuses (and the mock read only the first value).
export const api = createClient<paths>({ baseUrl: apiBaseUrl(), fetch: authFetch, querySerializer: { array: { style: 'form', explode: false } } });

/** Unwraps an openapi-fetch result: returns data or throws ApiError (for TanStack Query). */
export async function unwrap<T>(p: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let r: { data?: T; error?: unknown; response: Response };
  try {
    r = await p;
  } catch {
    throw new ApiError({ status: 0, code: 'NETWORK' });
  }
  if (r.error !== undefined || !r.response.ok) throw await toApiError(r.response, r.error);
  return r.data as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
