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
pnpm test · pnpm e2e -- --trace off
```

### Hosting rewrites (dynamic routes, ADR-W02)
Cloudflare Pages `_redirects`: `/customers/*  /customers/_/index.html  200` (same for `/staff/*`, `/collections/*`, `/handovers/*`). Nginx: `try_files $uri $uri/ /customers/_/index.html;` per prefix.

## Environment variables (names only)
| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | field-api base, e.g. https://api.example.com/api/v1 |
| `NEXT_PUBLIC_APP_ENV` | development / staging / production |
| `NEXT_PUBLIC_APP_VERSION` | set by CI |
| `NEXT_PUBLIC_SENTRY_DSN` | optional error tracking (public DSN) |
| `FIELD_API_OPENAPI` | build-time path/URL of openapi.yaml for type generation |

No secrets belong in this app; everything `NEXT_PUBLIC_*` is visible in the browser. Tile provider config comes from field-api `/meta/app-config`.

## Documentation
`docs/01-system-analysis.md` · `02-requirements.md` · `03-design-guide.md` (design system, shared tokens v1.0) · `04-architecture.md` · `06-data-model.md` · `07-test-plan.md` · `08-decisions.md` · `09-progress.md` · `CHANGELOG.md`. The API contract (05) lives in field-api.
