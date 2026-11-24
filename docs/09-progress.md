# 09 — Progress (admin-web)

Phases match `field-api/docs/09-progress.md`. admin-web can start each phase against the Prism mock of `openapi.yaml` before field-api endpoints exist.

## Phase 0 — Shell & admin foundations
| Item | FR | Status |
|---|---|---|
| Repo, CI (lint, boundaries, typecheck, unit, Playwright, axe, Lighthouse), tokens.css, fonts | NFR-W-* | ◐ all local checks run; CI workflow and Lighthouse not yet added |
| Vercel hosting: rewrites, 404, security headers and hashed CSP per page (`scripts/vercel-output.mjs`) | NFR-W-002, ADR-W02/W09 | ◐ routes unit-tested (`scripts/lib/vercel-config.test.mjs`); test deploy at a `*.vercel.app` address: login works, customer pages 404 until the `check: true` fix is deployed; `E2E_BASE_URL` run pending |
| Auth: login, change password, refresh, idle timeout | FR-AUTH-001..004, FR-W-002 | ☑ (W-E2 journey not yet automated) |
| Shell: header, sidebar, branch switcher, feature registry, `<Can>` | FR-W-001, FR-W-003 | ☑ |
| Users & roles, Permissions matrix, Settings, Flags, Audit | FR-USER-*, FR-RBAC-*, FR-SET-*, FR-FLAG-*, FR-AUD-003, FR-W-009 | ☑ |
| Shared UI kit: DataTable, Drawer, ReasonDialog, StatusBadge, MoneyText, KpiCard, EmptyState | FR-W-004/005/008 | ☑ |
**Acceptance:** W-E1, W-E2, W-E8, W-E9, W-E14 green; axe clean; shell JS ≤ 250 KB gzip.

## Phase 1 — Field operations MVP
| Item | Status |
|---|---|
| Overview dashboard, Inbox, ⌘K search | ☑ |
| Customers list/detail/map, tags, data freshness, pin approvals | ☑ (map lives at `/map` and approvals at `/pin-approvals`, because `/customers/<x>/` is rewritten to the detail page) |
| Collections, Conflicts resolution, Cash & deposits | ☑ (refund proof photo upload done) |
| Promises, Visits (photo lightbox), Notes tab | ☑ |
| Co-work: sessions, joint visits, single/joint stats and credit (FR-CW-004/005) | ☑ |
| Staff list/detail, Attendance (day grid, month matrix, corrections) | ☑ (leave approvals, holidays and shifts done 2026-11-17 on contract 1.12.0; staff page is gated by `module.reports` + `report.view` because it reads `/reports/staff-performance`) |
| Assignments & areas (map draw, bulk), Handovers | ◐ handovers done (area scope; individual-customer scope and staff-initiated requests later); areas and area assignments done at `/areas`; bulk customer assign from the list (2026-11-16); assign or un-assign one customer from its detail (2026-11-17, contract 1.11.0); drawing an area on the map later |
| Devices, System health (ERP, outbox, sync health) | ☐ |
| Mobile responsive pass (card lists, 360 px critical tasks) | ☐ |
**Acceptance:** W-E3…W-E7, W-E13 green; manager completes a full pilot day from a phone; every KPI links to its list.

## Phase 2 — Location
Live map (polling, freshness), Route history (polyline, stops, scrubber, events). **Acceptance:** W-E10, W-E11; route day renders < 2 s.

Status (2026-11-16): ◐ Live map at `/live` (30 s polling, freshness filter, mock GPS, low battery, break, tracking engine, link to today's route) and Route history at `/routes` (staff + day, track, numbered stops, gaps, day summary, events) are built against mocks and the live field-api endpoints. Left: time scrubber, field check against real phone data, `Stop.visitId` link when field-api fills it.

## Phase 3 — Reports
Staff performance, branch trends, aging, promise fulfilment, attendance reports, exports center, reconciliation, data quality, saved views. **Acceptance:** W-E12; numbers match API; Bangla PDF correct.

Status (2026-11-16): ◐ `/reports` has Branch trends, ERP reconciliation and Downloads (CSV/XLSX); staff performance lives at `/staff`. Bangla PDF done 2026-11-17 by printing report pages from the browser (owner approved). Left: aging and promise-fulfilment detail reports, attendance report, saved views, export history list (the API has no list endpoint; the page lists files built in the current session). Daily targets (`/targets`), data quality (`/data-quality`) and leaderboard (`/leaderboard`) done 2026-11-17 on contract 1.10.0, with target progress on Staff and Overview, report settings, server PDF exports and the data quality download.

## Phase 4 — Premium (as approved)
Broadcasts, leave approvals, day-sheet planner, print views, SMS logs.

Status (2026-11-17): ◐ brought forward on owner request: leave approvals (`/attendance/leave`), holidays and shifts (`/attendance/calendar`, shift in the user form) and notices with read tracking (`/notices`) are done on contract 1.12.0 with journeys and axe. Left: day-sheet planner, SMS logs.

## Status notes (2026-11-24, batch 1124)
- ☑ A — Drawer padding fixed at the root (shared `Drawer` body pads `space.20`), guarded by a component test and an e2e over 11 drawers at 390/1440 px (FR-W-067).
- ☑ B — Audit log uses the shared date filter; server `from`/`to` (already in the pinned contract), no client-side filtering (FR-W-068).
- ☑ C — Sidebar 8 items with section tab strips; every page kept its URL (FR-W-069, ADR-W28).
- ☑ D — Requests inbox on contract 1.48.0 (FR-W-070, ADR-W29). Live: turn `module.requests` on in Feature flags.
- ☑ E — Area manager role in users, branch switcher and permissions (FR-W-071).
- Contract pinned on the branch: **1.48.0** (field-api main 360ce85). Before it, `main` read 1.46.0; no 1.47.0 contract was in this repo.

## Status notes (2026-11-23, batch 1123, contracts 1.45.0 and 1.46.0)
- ☑ Customers pager 100/500/1000 with numbered pages (FR-W-060; one request per page with contract 1.46.0 `offset`), map full screen (FR-W-061), pin approvals paged (FR-W-062), shared date filter on eight pages (FR-W-063), management dashboard (FR-W-064), promise follow-ups (FR-W-065), possible customers (FR-W-066). Settings: nothing new in 1.45.0.
- Header fits 390 px (was 407 px wide).
- Live: the dashboard needs `module.reports` ON (there is no `module.dashboard` on the server) and possible customers `module.prospects` ON in Feature flags.

## Status notes (2026-11-15)
- Verified: lint (incl. boundaries), typecheck, 69 unit tests, 21 Playwright journeys incl. axe on 19 pages, `check:permissions`, `check:i18n`, static export served with rewrites + hashed CSP.
- Bundle: first-load JS is 203–258 KB (Next's report); the 250 KB budget is exceeded on `/admin/users` and `/admin/audit`. Next step: lazy-load page components from the registry.
- Contract 1.3.0 adopted (2026-11-15): typed list envelopes, branch/user override GET, per-branch effective flags, `Deposit.userName`.
- Contract 1.2.0 adopted (2026-11-15): `location.trackingProvider`/`providerConfig`, `installmentPoisha`, `overduePoisha`, `areaName`, `no_location` flag, contact attempts.
- Handovers page uses `handover.create` as its route permission: the catalog has no view-only handover key, so viewers do not see the page.
- Contract 1.4.0/1.5.0 adopted (2026-11-15): typed visit/promise lists with customer and staff refs, from/to/outcome filters.
- Devices (`/admin/devices`) and System health (`/admin/system`) done 2026-11-16.
- Contract note: `Device` has `userId` only (names are joined from `/users`); `DeviceSyncState.userName` is present.
- Attendance photos (drawer per staff/day, no-photo badge) and the two selfie settings done 2026-11-16 on contract 1.8.0. Settings are edited globally only; per-branch overrides of settings have no UI yet.
- Co-work admin side done 2026-11-16 on contract 1.9.1 (field-api `main`): `/cowork` sessions, single/joint visit filter and partners on visits, single/joint/credit on staff, two settings. The invite/accept flow itself is staff-app work.
- Bulk assign from the customers list and the CI workflow done 2026-11-16. Contract 1.7.1 adopted (plain-array location proposals, audit export).
- Refund proof photo upload done 2026-11-16 (`proofMediaId`, presigned upload).
- Map pins and single-customer assignment done 2026-11-17 on contract 1.11.0 (owner request): set or move a customer's pin on a map with a fixed centre pin or pasted coordinates (applies at once), assign one customer to a staff member of its branch or end a direct assignment, fix links from data quality, method and phone distance on pin approvals.
- Real ERP shape done 2026-11-18 on contract 1.13.0 (owner request; field-api ADR-033): invoice details, credit sales, rolled lines hidden, returned invoices not collectable, ERP risk badge, ERP receipts and collectors on payments, ERP employee picker in the user form, conflict hints, branch map points in Settings (FR-W-025..027, ADR-W17).
- Branch pins and "my location" on the live and customer maps done 2026-11-18 (FR-W-034); location was blocked by our own `Permissions-Policy` header, now `geolocation=(self)`; `img-src` allows the API origin for photos served by field-api 1.18.0.
- 2026-11-18 (contract 1.17.0, owner request): reload keeps the login on Vercel through the same-origin API proxy (ADR-W19), total customers shown (FR-W-030), "Sync from ERP" button (FR-W-031), delete a pin with a type-to-confirm dialog (FR-W-032, ADR-W20).
- Map pins and invoice viewer done 2026-11-18 on contract 1.14.0 (owner request; field-api ADR-035): map opens on Patuakhali district and keeps the user's view, map-pin shaped pins coloured by payment state with a colour legend that filters, installment/credit invoice filters on the map and customer list, invoice viewer tab with every installment, paid-on dates and receipts, credit pay-by date, ERP money lines (FR-W-028/029, ADR-W18).
- Staff in several branches done 2026-11-18 on contract 1.19.0 (owner request; field-api ADR-038): user form takes several branches for field staff with a home-branch picker, settings section Customers (staff see whole branch / assigned only, staff pin approval), visit flag relabelled (FR-W-033).
- Admin tasks for staff done 2026-11-18 on contract 1.20.0 (owner request; field-api ADR-037): `/tasks` with give / verify / send back / cancel, nav badge, journeys and axe (FR-W-035, ADR-W21).
- Map places done 2026-11-22 on contract 1.38.0 (owner request; field-api ADR-051): `/places` list + map, add / edit / move / remove, `/places/move-requests` queue with approve / reject, places layer with labels on the customer map, journeys at 1440 and 390 px and axe (FR-W-056, ADR-W24). Needs `module.places` turned on in Admin → Flags.
- Places on every map done 2026-11-22 (owner decisions; contract 1.42.0): square icon markers with street-map zoom levels (none < 13, icon 13–15, icon + name ≥ 16) on the customer, live, route, pin-approval and every picker map; no branch on new places, list shows every place; maps open on Galachipa at zoom 12 (FR-W-056, ADR-W25).
- Place dialog 2026-11-23 (owner request): wide dialog with a tall map beside the form, and "paste coordinates" like the customer pin dialog (FR-W-056).
- Admin field operations done 2026-11-20: Create Promise on `/promises` (`promise.create`), Collect Cash on `/collections` (`collection.record`), Record Visit on `/visits` (`visit.record`), all with no device location required from admin panel, shared `CustomerPicker` component. Auto ERP sync for users with `erp.sync` (every 10 minutes at first; every minute since 2026-11-22, owner request).
- Route history time scrubber and the sidebar in four groups done 2026-11-20; CI on `main` repaired 2026-11-21 (type error in the scrubber model, unit test added).
- Extra phone numbers done 2026-11-21 on contract 1.23.0 (owner request; field-api ADR-042): ERP / added marks, add several at once, remove an added one (FR-W-036).
- Work marks on every customer row, "this month" on the customer, invoice counts done 2026-11-21 on contract 1.24.0 (FR-W-037/038).
- Settings page fixed to the server's real keys, per-branch scope, duty hours with break windows, overtime and late-day settings done 2026-11-21 (FR-W-040/041; the new attendance settings need contract 1.25.0).
- Overtime, over-break and late-days-as-absences on the attendance pages done 2026-11-21 on contract 1.25.0 (FR-W-042).
- Collection board (verified money, every branch, month and all time) and its scope setting done 2026-11-21 on contract 1.26.0 (FR-W-043).
- Cash on hand: the collections behind a collector's cash (drawer) done 2026-11-21 on contract 1.27.0 (FR-W-044).
- Print / PDF button on thirteen more pages done 2026-11-21 (FR-W-045).
- Staff activity page and bell done 2026-11-21 on contract 1.28.0 (FR-W-046).
- Customer list: paid this month / not paid this month filter done 2026-11-21 on contract 1.29.0 (FR-W-047).
- Visit outcome `runaway` (পলাতক / Runaway) in the visits list, filter, drawer, record-visit dialog, co-work visits and activity feed; unknown outcomes show their raw code; done 2026-11-22 on contract 1.41.0 from field-api PR #37 (master FR-VIS-006).
- Photo storage page (Cloudinary or server storage, previous months per month, typed `DELETE <YYYY-MM>` purge with progress, alert from the 5th on the page, dashboard and nav) and "Delete photos of this day" in the attendance drawer with the "Deleted by admin" log, done 2026-11-22 on contract 1.37.0 (FR-W-054, FR-W-055, ADR-W23).
- Deposits are read-only and show what they contained (collections with method, ERP state and receipt; cash / non-cash / count; posted vs on its way), verify / reject / delete removed, warning badge for users without an ERP employee link, done 2026-11-22 on contract 1.35.0 (FR-W-053, ADR-W22).
- Voided and edited collections in the drawer and list, three new activity lines (contract 1.33.0, FR-W-050) done 2026-11-22.
- Delete a deposit (reason, "Deleted" tab, audit labels for withdrawn/edited collections) done 2026-11-22 on contract 1.32.0 (FR-W-049).
- Deposit detail (collections one deposit covered) and the promise behind every cash line done 2026-11-21 on contract 1.30.0 (FR-W-048).
- Contract 1.44.0 done 2026-11-23 (owner decision: every ERP customer and invoice shows): cash sales with nothing due and unknown kinds treated like cash, who visited / paid / promised on the customer (Office for unknown, field money labelled not in ERP yet), Sync from ERP until done with skipped rows and failed branches, `erp.customerScope` in settings (FR-W-057, FR-W-058, ADR-W26).
- Next: mobile pass, lazy-load map bundles; Phase 2 scrubber and showing visit/collection events on the route map (`events.data`, `Stop.visitId`, field-api 1.7.1); remaining Phase 3 reports.

## Contract gaps reported to field-api
All answered in contract 1.3.0 (2026-11-15):
1. Response schemas added for `GET /collections/conflicts`, `/cash/deposits`, `/notifications` (review-queue since 1.1.0). Casts removed.
2. `GET /rbac/overrides/branch/{branchId}` and `/rbac/overrides/user/{userId}` added. The branch tab now reads the real list (workaround removed).
3. `GET /feature-flags/effective?branchId=` added. The shell uses it for a super admin viewing one branch.
4. `Deposit.userName` added and used (cash positions remain the fallback).
5. Person names stay plain strings in v1 (changing would break clients). Accepted.
6. "50 keys" was a miscount in the spec text; the catalog table (46 keys) is the source of truth. Closed.
