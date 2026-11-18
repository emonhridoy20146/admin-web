# admin-web

Admin panel for the Howlader Electronics **Field Operations System** — overview dashboard, exceptions inbox, customers and map, collections and conflicts, cash and deposits, promises, visits, staff, attendance, live location and route history, assignments and handovers, reports, users, permissions, settings, feature flags and audit.

- Next.js 15 (static export, client-side rendering only), TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query/Table, Leaflet, Recharts, i18next (Bangla default).
- Backend: field-api `/api/v1` (contract: `field-api/docs/openapi.yaml`).

## Run locally
```bash
pnpm install
cp .env.example .env.local
pnpm gen:api                  # types from field-api openapi.yaml (path or pinned URL in FIELD_API_OPENAPI)
pnpm dev                      # http://localhost:3000 (against local field-api or Prism mock on :4010)
pnpm dev:mock                 # MSW in-browser mock, no backend needed
pnpm build                    # static export to ./out
pnpm build:mock && pnpm serve # static export with the mock API, served with prod rewrites + CSP on :4000
pnpm test                     # unit (vitest)
pnpm e2e -- --trace off       # Playwright journeys + axe against the mock static export (run build:mock first)
pnpm lint && pnpm typecheck && pnpm check:permissions && pnpm check:i18n
pnpm new:feature <name>       # scaffold a feature module
```

### Demo (mock mode)
`pnpm dev:mock`, then sign in with `admin`, `manager`, `viewer` or `newmanager` (forced password change). Password for all: `Demo@2026`. Demo data is generated in the browser and resets on reload; nothing leaves the machine.

### Hosting rewrites (dynamic routes, ADR-W02)
One static page serves every customer id: `/customers/view/` (ADR-W02, amended). Hosts must rewrite both the HTML and the RSC payload:

- Cloudflare Pages `_redirects`:
  ```
  /customers/view/*        /customers/view/:splat      200
  /customers/:id/          /customers/view/            200
  /customers/:id/index.txt /customers/view/index.txt   200
  ```
- Nginx: `location ~ ^/customers/(?!view/)[^/]+/(index\.txt)?$ { try_files /customers/view/$1 /customers/view/index.html; }`
- Vercel: `vercel.json` sets the build to `pnpm build && node scripts/vercel-output.mjs`. That script writes Vercel's Build Output (`.vercel/output`) with the same rewrites, the trailing-slash redirect, the 404 page and the security headers, including a CSP per HTML file with that build's script hashes (they change every build, so they cannot sit in a static `vercel.json`). Set the `NEXT_PUBLIC_*` variables in the Vercel project and redeploy after any change: they are baked in at build time. `connect-src` gets the origin of `NEXT_PUBLIC_API_BASE_URL` automatically; set `TILE_ORIGIN` and `STORAGE_ORIGIN` (for example `https://tile.openstreetmap.org`) in the Vercel project when the map or uploads are used, or the browser blocks them. Use a custom domain under the same parent domain as field-api (for example `admin.example.com` and `api.example.com`): the refresh cookie is `SameSite=Strict`, so a `*.vercel.app` address signs out on every reload. To check a deployment, run `E2E_BASE_URL=https://admin.example.com pnpm e2e` (the deployment must be a mock build, `NEXT_PUBLIC_API_MOCK=1`, for the journeys' demo users).

`scripts/serve-static.mjs` implements the same rules and is the reference.

### Content-Security-Policy
Next.js static export emits small inline bootstrap scripts. Do not use `'unsafe-inline'`: list their sha256 hashes in `script-src` (per HTML file). `scripts/serve-static.mjs` computes them and shows the full header (`curl -I`). Add the API, tile and storage origins to `connect-src`/`img-src`.

## Environment variables (names only)
| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | field-api base, e.g. https://api.example.com/api/v1 |
| `NEXT_PUBLIC_APP_ENV` | development / staging / production |
| `NEXT_PUBLIC_APP_VERSION` | set by CI |
| `NEXT_PUBLIC_SENTRY_DSN` | optional error tracking (public DSN) |
| `FIELD_API_OPENAPI` | build-time path/URL of openapi.yaml for type generation |
| `API_ORIGIN`, `TILE_ORIGIN`, `STORAGE_ORIGIN` | hosting only (not baked into the app): extra CSP origins for `serve-static.mjs` and `vercel-output.mjs`; `API_ORIGIN` defaults to the origin of `NEXT_PUBLIC_API_BASE_URL` on Vercel |

No secrets belong in this app; everything `NEXT_PUBLIC_*` is visible in the browser. Tile provider config comes from field-api `/meta/app-config`.

## Documentation
`docs/01-system-analysis.md` · `02-requirements.md` · `03-design-guide.md` (design system, shared tokens v1.0) · `04-architecture.md` · `06-data-model.md` · `07-test-plan.md` · `08-decisions.md` · `09-progress.md` · `CHANGELOG.md`. The API contract (05) lives in field-api.
