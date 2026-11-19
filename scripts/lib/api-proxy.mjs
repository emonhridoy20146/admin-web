// Same-origin API proxy for Vercel builds (ADR-W19).
//
// The refresh token is an HttpOnly `SameSite=Strict` cookie (`fos_rt`, path /api/v1/auth) set by field-api. When the
// admin panel and the API sit on different sites (two *.vercel.app addresses: `vercel.app` is a public suffix, so they
// are different sites) the browser refuses to store or send that cookie, and every page reload signs the user out.
// The fix that keeps the cookie strict and works in every browser (no third-party cookies) is to let the admin host
// forward `/api/v1/*` to field-api: the browser then only talks to its own origin and the cookie is first-party.
//
// On Vercel (the VERCEL env is set during a build) and with an absolute NEXT_PUBLIC_API_BASE_URL the proxy is on by
// itself: the app calls `/api/v1` and `scripts/lib/vercel-config.mjs` adds a route that forwards it to the real API.
// API_PROXY=0 turns it off (use it when the admin and the API share a parent domain), API_PROXY=1 turns it on elsewhere.

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ publicBase: string, target: string } | null} publicBase = what the browser calls (same origin),
 *   target = the field-api base URL the host forwards to (no trailing slash).
 */
export function apiProxy(env) {
  if (env.NEXT_PUBLIC_API_MOCK === '1') return null;
  if (env.API_PROXY === '0' || env.API_PROXY === 'off') return null;
  if (env.API_PROXY !== '1' && !env.VERCEL) return null;
  const base = env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return null;
  let url;
  try {
    url = new URL(base);
  } catch {
    return null; // relative base URL: already the same origin
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // field-api sets the cookie for path /api/v1/auth, so the browser-side path must be /api/v1
  return { publicBase: '/api/v1', target: `${url.origin}${url.pathname.replace(/\/+$/, '')}` };
}
