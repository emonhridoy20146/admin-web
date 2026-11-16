# 09 — Progress (admin-web)

Phases match `field-api/docs/09-progress.md`. admin-web can start each phase against the Prism mock of `openapi.yaml` before field-api endpoints exist.

## Phase 0 — Shell & admin foundations
| Item | FR | Status |
|---|---|---|
| Repo, CI (lint, boundaries, typecheck, unit, Playwright, axe, Lighthouse), tokens.css, fonts | NFR-W-* | ◐ all local checks run; CI workflow and Lighthouse not yet added |
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
| Collections, Conflicts resolution, Cash & deposits | ☑ (refund proof upload pending) |
| Promises, Visits (photo lightbox), Notes tab | ☑ |
| Staff list/detail, Attendance (day grid, month matrix, corrections) | ☑ (leave approvals are Phase 4; staff page is gated by `module.reports` + `report.view` because it reads `/reports/staff-performance`) |
| Assignments & areas (map draw, bulk), Handovers | ◐ handovers done (area scope; individual-customer scope and staff-initiated requests later); areas and area assignments done at `/areas`; bulk customer assign and drawing an area on the map later |
| Devices, System health (ERP, outbox, sync health) | ☐ |
| Mobile responsive pass (card lists, 360 px critical tasks) | ☐ |
**Acceptance:** W-E3…W-E7, W-E13 green; manager completes a full pilot day from a phone; every KPI links to its list.

## Phase 2 — Location
Live map (polling, freshness), Route history (polyline, stops, scrubber, events). **Acceptance:** W-E10, W-E11; route day renders < 2 s.

Status (2026-11-16): ◐ Live map at `/live` (30 s polling, freshness filter, mock GPS, low battery, break, tracking engine, link to today's route) and Route history at `/routes` (staff + day, track, numbered stops, gaps, day summary, events) are built against mocks and the live field-api endpoints. Left: time scrubber, field check against real phone data, `Stop.visitId` link when field-api fills it.

## Phase 3 — Reports
Staff performance, branch trends, aging, promise fulfilment, attendance reports, exports center, reconciliation, data quality, saved views. **Acceptance:** W-E12; numbers match API; Bangla PDF correct.

Status (2026-11-16): ◐ `/reports` has Branch trends, ERP reconciliation and Downloads (CSV/XLSX); staff performance lives at `/staff`. Left: aging and promise-fulfilment detail reports, attendance report, data quality, saved views, export history list (the API has no list endpoint; the page lists files built in the current session), Bangla PDF (owner decision pending).

## Phase 4 — Premium (as approved)
Broadcasts, leave approvals, day-sheet planner, print views, SMS logs.

## Status notes (2026-11-15)
- Verified: lint (incl. boundaries), typecheck, 69 unit tests, 21 Playwright journeys incl. axe on 19 pages, `check:permissions`, `check:i18n`, static export served with rewrites + hashed CSP.
- Bundle: first-load JS is 203–258 KB (Next's report); the 250 KB budget is exceeded on `/admin/users` and `/admin/audit`. Next step: lazy-load page components from the registry.
- Contract 1.3.0 adopted (2026-11-15): typed list envelopes, branch/user override GET, per-branch effective flags, `Deposit.userName`.
- Contract 1.2.0 adopted (2026-11-15): `location.trackingProvider`/`providerConfig`, `installmentPoisha`, `overduePoisha`, `areaName`, `no_location` flag, contact attempts.
- Handovers page uses `handover.create` as its route permission: the catalog has no view-only handover key, so viewers do not see the page.
- Contract 1.4.0/1.5.0 adopted (2026-11-15): typed visit/promise lists with customer and staff refs, from/to/outcome filters.
- Devices (`/admin/devices`) and System health (`/admin/system`) done 2026-11-16.
- Contract note: `Device` has `userId` only (names are joined from `/users`); `DeviceSyncState.userName` is present.
- Bulk assign from the customers list and the CI workflow done 2026-11-16. Contract 1.7.1 adopted (plain-array location proposals, audit export).
- Next: refund proof upload, mobile pass, lazy-load map bundles; Phase 2 scrubber and showing visit/collection events on the route map (`events.data`, `Stop.visitId`, field-api 1.7.1); remaining Phase 3 reports.

## Contract gaps reported to field-api
All answered in contract 1.3.0 (2026-11-15):
1. Response schemas added for `GET /collections/conflicts`, `/cash/deposits`, `/notifications` (review-queue since 1.1.0). Casts removed.
2. `GET /rbac/overrides/branch/{branchId}` and `/rbac/overrides/user/{userId}` added. The branch tab now reads the real list (workaround removed).
3. `GET /feature-flags/effective?branchId=` added. The shell uses it for a super admin viewing one branch.
4. `Deposit.userName` added and used (cash positions remain the fallback).
5. Person names stay plain strings in v1 (changing would break clients). Accepted.
6. "50 keys" was a miscount in the spec text; the catalog table (46 keys) is the source of truth. Closed.
