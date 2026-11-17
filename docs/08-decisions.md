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

## ADR-W12 — Co-work in the admin panel: credit on the staff page, raw counts elsewhere
- **Decision:** The staff page shows, per person, every visit they took part in (single + joint), split "single · joint", and a separate "Visit credit" column (the server's `visitCredit`), which is also what the visits sort uses. Branch totals keep the recorded visit count so a joint visit is counted once. The visits of one co-work group are opened with `?session=` and ignore the period filter, because a group belongs to one day that may be outside the chosen period. `cowork.visitCredit` is edited as a percentage that may be 0 % (other ratio settings start at 1 %).
- **Reason:** field-api ADR-029 credits every participant and lets the business weight joint visits; managers need the per-person picture without inflating branch totals. Money figures are untouched: collections stay with the collector.
- **Alternatives rejected:** dividing a joint visit between participants in the UI (the server owns the rule); showing only the credit (hides how much was joint work).

## ADR-W13 — Bangla PDF by printing the report page
- **Decision:** Report pages print to PDF through the browser ("PDF / Print" → "Save as PDF"). A print stylesheet gives A4, the light theme, a masthead with branch, time and user, every table column, repeated headers and charts as tables. Owner approved 2026-11-17 (field-api OD-26).
- **Reason:** the browser's text engine shapes Bangla conjuncts and embeds the self-hosted Noto Sans Bengali with no extra service. What is printed is what the manager sees, with the same filters.
- **Consequences:** only the rows on screen are printed: paged lists print the current page. Large files stay CSV/XLSX downloads, and server-side PDF exports can be offered next to printing once field-api supports them (done with contract 1.10.0: "PDF" is a file type in Downloads).

## ADR-W14 — Targets, leaderboard and data quality: the server's numbers, shown as they are
- **Decision:** Daily targets get their own feature (`targets`, flag `module.targets`) at `/targets`; the leaderboard and data quality are pages of the `reports` feature (`report.view`). Target progress uses the server's `amountAchievement` / `visitAchievement` (collected and visit credit against the target **to date**), falling back to computing them only for an older server. The leaderboard shows ranks exactly as the server gives them (shared ranks marked "tie", unranked people listed after a note naming the minimum present days). Data quality shows the issue's own translated wording; the server's English `detail` is added only when it carries data (a number, a code, a distance). In Bangla the word for target is "লক্ষ্য" everywhere.
- **Reason:** field-api owns the rules (working days, leave, ties, eligibility), so the panel never disagrees with the app or the exports. A month-to-date target keeps the progress bar honest mid-month.
- **Alternatives rejected:** ranking or summing targets in the browser; translating server details by pattern (brittle); a separate feature for the leaderboard (it is a report and shares its permission).

## ADR-W15 — Map pins: a fixed centre pin, coordinates always as text
- **Decision:** A manager sets a customer's pin in a dialog where the pin stays in the middle and the map moves under it (as ride apps pick a pick-up spot), built on plain Leaflet (`shared/map/map-picker.tsx`). The coordinates are always shown as text, pasted coordinates are accepted, and Save is refused outside Bangladesh. The pin applies at once (`POST /customers/{id}/location`, audited, field-api ADR-031); there is no separate approval for a manager. One customer is assigned from its detail through `POST /assignments` (type customer), and a direct assignment can be ended so the area's staff member takes the customer back.
- **Reason:** dragging a small marker is fiddly on a phone and with a trackpad; moving the map under a fixed pin is precise at any zoom and works with the keyboard (arrow keys). Text coordinates and paste make the dialog usable without the map (screen readers, coordinates copied from a phone's map app).
- **Alternatives rejected:** a draggable marker (hard to hit, no keyboard path); place search (needs a geocoding service and a new external host under the CSP; listed as a later idea); a pin request that a second manager approves (the owner wants missing pins filled quickly).

## ADR-W16 — Leave, calendar and notices: decisions are final, sending is confirmed
- **Decision:** Leave approvals and the work calendar are pages of the `attendance` feature (`/attendance/leave`, `/attendance/calendar`); notices are a new `notices` feature. Approving leave is confirmed in a dialog that names the dates and days, rejecting goes through `ReasonDialog` (≥ 5 characters, the server's rule); neither is optimistic. Sending a notice is a two-step dialog (write, then a confirmation naming who gets it), because it reaches phones at once and cannot be taken back. The shift is chosen in the user form (admin-users) from `useShifts`, exported by attendance. In Bangla, rejecting leave is "নামঞ্জুর" so it is never the same word as "বাতিল" (cancel) on the same dialog.
- **Reason:** a decided request answers `ALREADY_DECIDED` and the staff member is told at once, so a mis-click cannot be undone; the shift is a property of the user and already goes through the audited user update with a reason.
- **Alternatives rejected:** a separate leave feature (it shares attendance's permission and data); a shift picker on the shift page (assigning people there would duplicate the user update and its audit reason); computing who has read a notice in the browser (the server knows the recipients fixed at sending).
