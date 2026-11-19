import type { NextConfig } from 'next';
import { apiProxy } from './scripts/lib/api-proxy.mjs';

// ADR-W01: static export, client-side rendering only. No API routes, middleware or server actions.
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
};

// ADR-W19: on Vercel the browser calls its own origin (`/api/v1`) and the host forwards to field-api, so the
// SameSite=Strict refresh cookie is first-party and a reload keeps the session. See scripts/lib/api-proxy.mjs.
const proxy = apiProxy(process.env);
if (proxy) config.env = { NEXT_PUBLIC_API_BASE_URL: proxy.publicBase };

// Dev server only: mimic the production host rewrite (ADR-W02) so /customers/<id>/ works in `next dev`.
// Static export ignores rewrites; production hosts use the rules in README.
if (process.env.NODE_ENV === 'development') {
  config.rewrites = async () => ({
    beforeFiles: [{ source: '/customers/:id((?!view$)[^/]+)', destination: '/customers/view' }],
    afterFiles: [],
    fallback: [],
  });
}

export default config;
