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
Next.js static export writes inline bootstrap scripts. Instead of `'unsafe-inline'`, hosting sends `script-src 'self' 'sha256-…'` with the hashes of each HTML file's inline scripts (computed at deploy; `scripts/serve-static.mjs` shows how). On Vercel, `scripts/vercel-output.mjs` computes them after each build and writes them as per-page headers in the Build Output API config (2026-11-18), with the same code as `serve-static.mjs` (`scripts/lib/csp.mjs`). The routes are built in `scripts/lib/vercel-config.mjs`; the customer rewrites need `check: true` so Vercel looks the destination up in the static files. On Vercel `TILE_ORIGIN` defaults to OpenStreetMap, field-api's default tile provider, so maps load without extra env.

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

## ADR-W22 — Deposits are read, not decided; the list opens on final deposits
- **Decision (owner request 2026-11-22, contract 1.35.0, field-api ADR-049):** the panel drops every deposit action (verify, reject, delete), their hooks, dialogs, nav badge and "deposits to verify" KPI; the API routes still exist but answer 409 `DEPOSIT_FINAL`, so nothing calls them. The deposit list opens on `submitted` deposits; a second tab "All, with older ones" lists every status so the old history still reads (`pending`, `verified`, `rejected`, `deleted` keep their badges). The drawer of a final deposit shows its collections with method and ERP state, and totals by ERP state ("posted in the ERP" vs "on its way", CLAUDE.md §2.6). An inbox reminder `cash.deposit.pending` raised before 1.35.0 is shown as retired without its link, so it can be resolved. Users without an ERP employee link get a warning badge (they are now posted by name, no longer a conflict).
- **Reason:** a deposit sends the money to the ERP and cannot change, so an office step would be a button that always fails; the owner wants the office to see who took how much from whom and what each deposit contained.
- **Alternatives rejected:** one tab per old status (five segments do not fit 390 px and the old statuses no longer grow); hiding old reminders in the inbox (the server still counts them; the office should close them once).

## ADR-W21 — Admin tasks: the admin verifies, so "To verify" is its own tab and the nav badge
- **Decision (owner request 2026-11-18, contract 1.20.0, field-api ADR-037):** a new feature `tasks` (`/tasks`, flag `module.tasks`). The list is split by state, with "To verify" as a tab and a nav badge, because the admin's job in this flow is the check, not the giving. Sending back and cancelling use the shared ReasonDialog (reason of at least 5 characters, as for leave); verifying is a plain confirm with an optional note. A task is stored under one branch: the create dialog asks for the branch first and then lists the staff of that branch, so a staff member who works in several branches is found in each of them. No bulk assign and no customer link on purpose (the owner wants free-form tasks).
- **Reason:** staff only ever ask to resolve; nothing is resolved until an admin has looked, so the waiting requests must be impossible to miss.
- **Alternatives rejected:** a default tab of "To verify" (empty most of the time, the person who just gave a task would not see it); a separate verify page (the drawer already shows the staff note and history).

## ADR-W20 — Deleting a pin asks the user to type a word
- **Decision (owner request 2026-11-18, contract 1.17.0, field-api ADR-036):** deleting a customer's pin is destructive for field work (the assignee's map loses the customer) and cannot be undone except by setting a new pin, so the dialog is a `ConfirmTypeDialog`: it names the customer and the coordinates, and the red button is disabled until the user has typed `DELETE`. The word is Latin on purpose (any keyboard types it) and not case-sensitive. The same component is available for other destructive actions. It sits next to "move pin" so the customer drawer, and with it the map, offer it without a new page.

## ADR-W19 — On Vercel the browser calls its own origin; the host forwards `/api/v1` to field-api
- **Context:** after every page reload the admin panel asked for the login again. The refresh token lives in an HttpOnly `SameSite=Strict` cookie (ADR-W05), which a browser neither stores nor sends when the panel and the API are different *sites*. Two `*.vercel.app` addresses are different sites (`vercel.app` is a public suffix), so the test deployment could never keep a session.
- **Decision (owner request 2026-11-18):** during a Vercel build with an absolute `NEXT_PUBLIC_API_BASE_URL`, `next.config.ts` bakes `/api/v1` into the app and `vercel-output.mjs` puts a first route `^/api/v1/(.*)$` → `<api>/$1` in the Build Output (before the trailing-slash redirect, which would otherwise redirect a POST). The browser only talks to its own origin, so the cookie is first-party and stays `Strict`; no CORS, no third-party cookies, CSP `connect-src` needs no API origin. On by itself when the `VERCEL` env is set; `API_PROXY=0` off, `API_PROXY=1` on elsewhere; never in mock builds or for a relative URL.
- **Rejected:** `SameSite=None` on the API cookie (weakens CSRF protection and Safari, Firefox strict mode and Brave drop third-party cookies); keeping the refresh token in `localStorage` (CLAUDE.md §2.8); making the owner buy a domain first (still the right production answer: admin and API under one parent domain, then `API_PROXY=0`).
- **Consequences:** requests pass through Vercel's proxy, so API calls take one more hop and the login rate limit sees Vercel's forwarded client IP (`X-Forwarded-For`); field-api must trust it (`TRUST_PROXY`). Photos and exports use presigned storage URLs and do not pass the proxy.

## ADR-W18 — Pin colour = payment state; the map opens on Patuakhali; invoices are read in the panel
- **Decision (owner request 2026-11-18, contract 1.14.0, field-api ADR-035):** a customer's pin colour is the server's `payState`: red `bad` (tagged bad, or a plan's full term over with money left — our reading of "full cycle overdue"), orange `missed_many` (2+ missed), yellow `missed_one`, blue `due_today`, green `on_track` (everything due so far paid), grey `paid_off` (nothing left; grey so finished accounts do not crowd the collection map). Pins have the familiar map-pin shape with a glyph that repeats the colour, drawn as inline SVG from tokens (no images, no new CSP host). Before field-api 1.14.0 is live the colour is read from the old status. Maps open on the view in the link, else the chosen branch's point, else Patuakhali district (the ERP has no branch coordinates; the old fallback was Barishal city); the page never moves the map on its own except when the branch changes. The view is written with `history.replaceState`, not the router, because it changes on every pan. Invoices get their own tab and viewer; ERP numbers are shown as sent, never re-added in the browser; field money not yet in the ERP stays apart.
- **Reason:** the owner works the Patuakhali area and wants to see at a glance who missed how much; managers compare invoices with the office ERP line by line.
- **Alternatives rejected:** green for paid-off customers (850 of ~1,450 real customers are paid off and would hide the 44 on-track ones; one token to change if the owner prefers it); colouring pins in the browser from the schedule (the server already knows, and lists and filters must agree); a drawer for the invoice (too narrow for a 7-column schedule).


## ADR-W17 — The real ERP's shape: show what the office sees, link staff before go-live
- **Decision (contract 1.13.0, field-api ADR-033):** a plan is one ERP invoice. Its card shows the invoice number (not the internal id), "Credit sale" for pay-later invoices with one due date, the products with serial numbers, the guarantor of that sale, the payment frequency, any written-off amount, and a late fee inside a line's amount. Lines the ERP rolled forward (amount 0) are hidden with a one-line note, so the schedule matches the office's. Returned and cancelled invoices are listed last, muted, and marked not collectable (they are not in the totals). The ERP's own risk grade is a read-only badge next to the FOS tag, never a FOS tag. Payments show the ERP receipt (`PAY-…`), the ERP method name, the collector, advance and discount; a payment the office removed stays visible as reversed and struck through. The ERP employee of a user is picked from a live list (`GET /system/erp-employees`), staff of the user's branches first, and can be changed or removed on edit; when the ERP is unreachable the id can be typed. Branch map points are set in Settings because the ERP has none. The conflict codes of the real ERP get a next-step hint; "collector not linked" links to the user.
- **Reason:** managers compare the panel with the office ERP, so numbers and identifiers must read the same; a collector the ERP does not know makes every collection of that person a conflict, so linking has to be easy before go-live.
- **Alternatives rejected:** showing rolled lines (they look like paid installments of ৳0); typing ERP employee ids by hand only (error-prone, ids are not visible to managers); computing a FOS risk grade from the ERP snapshot (the ERP's number is shown as it is).

