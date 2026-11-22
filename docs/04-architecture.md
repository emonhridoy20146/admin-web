# 04 — Architecture (admin-web)

## 1. Stack
| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) with `output: 'export'` — static, client-side rendering only; every page `'use client'` |
| Language | TypeScript strict |
| Styling | Tailwind CSS 4 with CSS-variable tokens (03-design-guide §2); shadcn/ui components (copied into `src/shared/ui`) on Radix primitives |
| Data fetching | TanStack Query v5 + `openapi-fetch` typed by `openapi-typescript` from field-api's `openapi.yaml` |
| Tables | TanStack Table v8 |
| Forms | react-hook-form + zod |
| Maps | Leaflet 1.9 + react-leaflet 4, supercluster, leaflet-draw (areas) |
| Charts | Recharts |
| i18n | i18next + react-i18next (bn default, en) |
| Dates | Luxon with `Asia/Dhaka` |
| State (UI only) | Zustand for small global UI state (branch, sidebar, theme) |
| Tests | Vitest + Testing Library, MSW (mock API from OpenAPI examples), Playwright (+ axe) |
| Lint | ESLint (next, typescript-eslint, **eslint-plugin-boundaries**), Prettier |
| Package manager | pnpm |

## 2. Modules (features)
Each feature lives in `src/features/<name>/` with a manifest and a public `index.ts`. Features never import each other's internals; shared code is in `src/shared/`.

```ts
// src/shared/feature/types.ts
export interface FeatureManifest {
  name: string;                         // folder name
  flag?: `module.${string}`;            // field-api flag key; feature hidden if off (default OFF)
  routes: { path: string; title: I18nKey; permission?: string; navGroup?: NavGroup; icon?: LucideIcon; order?: number }[];
  permissions: string[];                // keys the feature checks (must exist in master catalog — CI check)
  events?: { emits?: string[]; listens?: string[] };   // UI event bus (e.g. 'customer.tagged' → invalidate queries)
  commands?: CommandDef[];              // ⌘K palette entries
  widgets?: { dashboard?: WidgetDef[]; customerDetailTabs?: TabDef[] };  // extension points
}
```
Extension points let a new feature add a dashboard widget, a customer-detail tab or a ⌘K command **without editing** the dashboard or customer feature.

| Feature | Flag | Permissions checked | Routes |
|---|---|---|---|
| `auth` | — | — | `/login`, `/change-password` |
| `shell` | — | — | layout, nav, header, branch switcher |
| `dashboard` | `module.dashboard` | `report.view` | `/` |
| `inbox` | `module.inbox` | `inbox.view` | `/inbox` |
| `customers` | `module.customers` | `customer.view`, `customer.export`, `customer.location.approve` | `/customers`, `/customers/[id]`, `/map`, `/pin-approvals` |
| `map` | `module.customers` | `customer.view`, `assignment.manage` | `/map` |
| `tags` | `module.tags` | `tag.view`, `tag.set`, `tag.approve` | tab + inbox actions |
| `collections` | `module.collections` | `collection.view`, `collection.void`, `collection.resolve` | `/collections`, `/collections/conflicts`, `/reconciliation` |
| `cash` | `module.cash` | `cash.view`, `cash.limit.manage` (deposits are read-only from contract 1.35.0) | `/cash` |
| `promises` | `module.promises` | `promise.view` | `/promises` |
| `visits` | `module.visits` | `visit.view` | `/visits` |
| `notes` | `module.notes` | `note.view`, `note.create` | customer tab |
| `staff` | — | `user.view` | `/staff`, `/staff/[id]` |
| `attendance` | `module.attendance` | `attendance.view`, `attendance.manage` | `/attendance` |
| `location` | `module.location` | `location.view`, `location.history.view` | `/live`, `/routes` |
| `assignments` | `module.assignments` | `assignment.view`, `assignment.manage` | `/assignments` |
| `handovers` | `module.handovers` | `handover.create` | `/handovers` |
| `reports` | `module.reports` | `report.view`, `report.export` | `/reports` (trends, reconciliation, downloads), `/leaderboard`, `/data-quality` |
| `targets` | `module.targets` | `target.view`, `target.manage` | `/targets` |
| `notifications` | `module.notifications` | `notification.broadcast` | bell, `/broadcasts` |
| `admin-users` | — | `user.view`, `user.manage` | `/admin/users` |
| `admin-rbac` | — | `rbac.view`, `rbac.manage` | `/admin/permissions` |
| `admin-settings` | — | `settings.manage` | `/admin/settings` |
| `admin-flags` | — | `flag.manage` | `/admin/flags` |
| `admin-devices` | `module.devices` | `device.manage` | `/admin/devices` |
| `audit` | — | `audit.view` | `/admin/audit` |
| `system` | — | `settings.manage` | `/admin/system` |
| `search` | `module.search` | — (server scopes) | ⌘K |
| `microfinance` | `module.microfinance` | `microfinance.*` (reserved) | none — README only |

Future features land in `src/features/<new-feature>/` and register in `src/app/features.ts` (the only list).

## 3. Folder tree
```
admin-web/
├── CLAUDE.md · README.md
├── package.json · pnpm-lock.yaml · tsconfig.json · next.config.ts (output: 'export')
├── .env.example · .eslintrc.cjs · .prettierrc · tailwind.config.ts · postcss.config.mjs
├── playwright.config.ts · vitest.config.ts
├── docs/ 01…09 · CHANGELOG.md · design-tokens.json (export of 03 §2 for tooling)
├── public/ fonts/ (Inter, Noto Sans Bengali, Hind Siliguri, JetBrains Mono — self-hosted woff2) · icons/
├── scripts/ gen-api.ts · check-permissions.ts (keys ⊆ master catalog) · check-i18n.ts (bn/en key parity)
├── e2e/ journeys/*.spec.ts · fixtures/
└── src/
    ├── app/                         # Next.js routes (thin: import page from feature)
    │   ├── layout.tsx · providers.tsx · features.ts (the ONLY feature list)
    │   ├── login/page.tsx
    │   ├── (shell)/layout.tsx       # authenticated shell
    │   ├── (shell)/page.tsx         # dashboard
    │   ├── (shell)/customers/page.tsx · customers/[id]/page.tsx   # [id] uses generateStaticParams=[] + client fetch (see §5)
    │   └── (shell)/…                # one folder per route in §2
    ├── features/
    │   └── <feature>/
    │       ├── manifest.ts
    │       ├── index.ts             # public: manifest, page components, hooks other features may use
    │       ├── pages/               # route-level components
    │       ├── components/
    │       ├── api/                 # query keys, hooks (useCustomers, useResolveConflict)
    │       ├── model/               # view-model mappers, zod form schemas
    │       ├── i18n/bn.json · en.json
    │       └── __tests__/
    ├── shared/
    │   ├── api/ schema.d.ts (generated) · client.ts (openapi-fetch + auth middleware) · problem.ts
    │   ├── auth/ session store (memory), refresh single-flight, guards (<Can permission>)
    │   ├── feature/ types.ts · registry.ts · FeatureGate
    │   ├── ui/ shadcn components, DataTable, Drawer, KpiCard, StatusBadge, MoneyText, ReasonDialog, EmptyState, MapView, ChartCard
    │   ├── map/ TileProvider, pins, cluster, draw
    │   ├── lib/ format.ts (money, dates, digits) · time.ts (Dhaka) · url-state.ts
    │   ├── i18n/ setup, common.json
    │   └── theme/ tokens.css (CSS vars, light/dark)
    └── test/ msw handlers (generated from openapi examples) · render helpers
```

Boundary rules (`eslint-plugin-boundaries`): `app → features(index) → shared`; `features/A` may import `features/B/index.ts` only (prefer extension points); nothing imports `app`; `shared` imports no feature.

## 4. Data flow
- **API client:** `openapi-fetch` with middleware: attaches bearer, `Accept-Language`, `X-Client`; on `401 TOKEN_EXPIRED` → single-flight `/auth/refresh` (cookie) → retry once; on `REFRESH_REUSED` → logout.
- **Query keys:** `[feature, resource, params]`, e.g. `['customers','list',{branch,filters,cursor}]`. `staleTime` 30 s for lists, 5 min for reference data (branches, permissions catalog), 0 for inbox count.
- **Invalidation:** UI event bus (`shared/feature/events`) — e.g. after resolving a conflict, `collections` emits `collection.resolved`; `inbox`, `dashboard`, `cash` listen and invalidate their queries. Features never call each other's query hooks directly.
- **URL state:** filters, sort, cursor, drawer in query string (`url-state.ts`), so links are shareable and back button works.
- **Permissions:** `GET /auth/me` on boot → `can(key)`; `<Can permission="tag.set">` hides/disables UI; server is the authority.
- **Flags:** from `/auth/me`; `FeatureGate` hides routes/nav; direct URL to disabled feature shows "module off" page.

## 5. Static export and dynamic routes
`output: 'export'` cannot pre-render unknown ids. Pattern: dynamic routes are implemented as **query-param pages** (`/customers/view?id=6740…`) or a catch-all with client routing, plus host rewrite rule `/* → /index.html` fallback. Decision ADR-W02: use `/customers/[id]` paths via a hosting rewrite (`/customers/*` → `/customers/_/index.html`) and read the id client-side; documented in README for each host.

## 6. Key flows (web side)
- **Resolve conflict:** Conflicts page → card shows field collection, ERP error, customer's current plans (fresh fetch) → choose action → ReasonDialog → `POST /collections/{id}/resolve` with Idempotency-Key (generated once per dialog open, reused on retry) → toast + event `collection.resolved`.
- **Verify deposit:** Cash page queue → slip lightbox → Verify / Reject (reason) → position recalculated.
- **Create handover:** From staff detail or Handovers → choose from/to, areas/customers (map or list) → summary preview (counts, outstanding, open promises, cash on hand warning) → create → status pending; receiver accepts in app.
- **Permission change:** Matrix toggle → staged changes panel (diff: key, old → new, scope, users affected) → Save with reason → audit entry; page shows effective values refreshed.
- **Random location check:** Live map → click staff → today's route opens in Route history with stops and visits.

## 7. Hosting & environments
Static build to CDN (Cloudflare Pages or S3 + CloudFront or Nginx on the API host). Environment config via `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_SENTRY_DSN` (optional) baked at build per environment. Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) set at the host.
