# 08 — Decisions (admin-web)

System-wide ADRs (ADR-001…023) and open decisions (OD-01…24) are in `field-api/docs/08-decisions.md`. Web-specific ADRs below.

### ADR-W01 Next.js static export, CSR only · fixed
- **Reason:** fixed decision; no SEO; 1–15 users; simplest hosting (static files on CDN), no Node server to secure.
- **Alternatives rejected:** SSR/Server Components (needs server, cookies/session complexity, no benefit); Vite + React Router SPA (would also fit, but Next.js was fixed).
- **Consequences:** no API routes, no middleware, no server actions; dynamic segments handled client-side (ADR-W02).

### ADR-W02 Dynamic routes via host rewrite + client-side id · accepted
- **Reason:** `output: 'export'` cannot pre-render unknown ids; clean URLs (`/customers/6740…`) are better for sharing.
- **Alternatives rejected:** query-param pages (`/customers/view?id=`) — works everywhere but uglier; hash routing — breaks deep links in some tools.
- **Consequences:** README documents rewrite rules for Cloudflare Pages (`_redirects`), Nginx and S3/CloudFront; fallback to query-param variant if a host cannot rewrite.

**Amendment (2026-11-15):** App Router `[id]` with `output: 'export'` fails for unknown ids and `_`-prefixed folders are private, so the one page lives at `/customers/view/` and reads the id from the pathname (fallback `?id=`). Hosts rewrite `/customers/<id>/` and `/customers/<id>/index.txt` to it; `next.config.ts` adds the same rewrite in dev only. Reference implementation: `scripts/serve-static.mjs`.

### ADR-W09 CSP with script hashes for the static export · accepted
Next.js static export writes inline bootstrap scripts. Instead of `'unsafe-inline'`, hosting sends `script-src 'self' 'sha256-…'` with the hashes of each HTML file's inline scripts (computed at deploy; `scripts/serve-static.mjs` shows how).

### ADR-W10 Mock mode keeps a session marker in sessionStorage · accepted
Only with `NEXT_PUBLIC_API_MOCK=1`: the MSW mock stores the signed-in demo user id (never a token or PII) under `fos.mock.session` to stand in for the HttpOnly refresh cookie across reloads. Production builds never write it.

### ADR-W03 shadcn/ui + Radix + Tailwind 4 · accepted
- **Reason:** accessible primitives, code owned in repo (no version lock-in), token-driven theming, premium look with little effort, AI agents know it well.
- **Alternatives rejected:** MUI (heavier, Material look on admin conflicts with desired calm style, theming more complex); Ant Design (dense but dated look, large bundle, less control); Mantine (good, but less ecosystem momentum for tables/charts patterns).

### ADR-W04 TanStack Query + openapi-fetch (generated types) · accepted
- **Reason:** cache, retries, background refetch, devtools; typed client from contract (ADR-004).
- **Alternatives rejected:** Redux Toolkit Query (more boilerplate); SWR (fewer mutation features); Orval (generates hooks, but couples hooks to generator output — kept as option).

### ADR-W05 Access token in memory, refresh in HttpOnly cookie · accepted
- **Reason:** CSR app is exposed to XSS; memory-only access tokens limit theft window; HttpOnly cookie unreadable by JS.
- **Consequences:** API and admin on same parent domain (OD-22); CSRF protected by `SameSite=Strict` + refresh endpoint requiring `X-Requested-With` and Origin check.

### ADR-W06 i18next instead of next-intl · accepted
- **Reason:** next-intl's best features rely on server rendering/middleware; static export + client i18n is simpler with i18next.

### ADR-W07 Leaflet via react-leaflet; Recharts for charts · accepted
- **Reason:** Leaflet is fixed for maps; react-leaflet is the standard binding. Recharts: declarative, small enough with lazy loading, good tooltips; ECharts rejected for bundle size, Chart.js for weaker React ergonomics.

### ADR-W08 Polling, not WebSockets · accepted
- **Reason:** "admin checks the map at random times, not live"; polling at 60 s only while visible is cheap and simple.

## Open decisions (web)
| ID | Question | Default |
|---|---|---|
| OD-W01 | Hosting for admin-web | Cloudflare Pages (free tier, global CDN, `_redirects`) |
| OD-W02 | Calendar week start | Saturday |
| OD-W03 | Bangla heading font | Noto Sans Bengali everywhere; Hind Siliguri optional for titles |
| OD-W04 | Dark sidebar vs light sidebar | Light sidebar (neutral.0) with brand active state |
| OD-W05 | Session idle timeout | 30 min |

## ADR-W11 — Map: plain Leaflet, vector markers, routes outside `/customers/`
- **Decision:** `shared/map/MapView` wraps Leaflet directly (dynamic import on the client), draws pins as vector circles coloured from design tokens and clusters as token-coloured bubbles; no marker images. The customer map is `/map` and pin approvals `/pin-approvals`.
- **Reason:** Leaflet touches `window` at import, which breaks static pre-rendering if imported at module top. Vector markers need no image hosts, so the CSP only gains the tile origin. `/customers/<anything>/` is rewritten by hosts to the detail page (ADR-W02), so `/customers/map` would collide.
- **Accessibility:** the map is `role="application"` and is never the only path: each map page lists the same items as text beside it.
- **Alternatives rejected:** react-leaflet components (more code for the same result, SSR guards everywhere); MapLibre GL (heavier, needs vector tiles and `worker-src blob:`).
