import type { NextConfig } from 'next';

// ADR-W01: static export, client-side rendering only. No API routes, middleware or server actions.
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
};

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
