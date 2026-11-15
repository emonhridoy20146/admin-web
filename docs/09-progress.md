# 09 — Progress (admin-web)

Phases match `field-api/docs/09-progress.md`. admin-web can start each phase against the Prism mock of `openapi.yaml` before field-api endpoints exist.

## Phase 0 — Shell & admin foundations
| Item | FR | Status |
|---|---|---|
| Repo, CI (lint, boundaries, typecheck, unit, Playwright, axe, Lighthouse), tokens.css, fonts | NFR-W-* | ◐ all local checks run; CI workflow and Lighthouse not yet added |
| Auth: login, change password, refresh, idle timeout | FR-AUTH-001..004, FR-W-002 | ☑ (W-E2 journey not yet automated) |
| Shell: header, sidebar, branch switcher, feature registry, `<Can>` | FR-W-001, FR-W-003 | ☑ |
| Users & roles, Permissions matrix, Settings, Flags, Audit | FR-USER-*, FR-RBAC-*, FR-SET-*, FR-FLAG-*, FR-AUD-003, FR-W-009 | ☑ (branch-override read is a workaround, see gaps) |
| Shared UI kit: DataTable, Drawer, ReasonDialog, StatusBadge, MoneyText, KpiCard, EmptyState | FR-W-004/005/008 | ☑ |
**Acceptance:** W-E1, W-E2, W-E8, W-E9, W-E14 green; axe clean; shell JS ≤ 250 KB gzip.

## Phase 1 — Field operations MVP
| Item | Status |
|---|---|
| Overview dashboard, Inbox, ⌘K search | ☑ |
| Customers list/detail/map, tags, data freshness, pin approvals | ◐ list, detail, tags, freshness done; map and pin approvals next |
| Collections, Conflicts resolution, Cash & deposits | ☑ (refund proof upload pending) |
| Promises, Visits (photo lightbox), Notes tab | ☐ |
| Staff list/detail, Attendance (day grid, month matrix, corrections) | ☐ |
| Assignments & areas (map draw, bulk), Handovers | ☐ |
| Devices, System health (ERP, outbox, sync health) | ☐ |
| Mobile responsive pass (card lists, 360 px critical tasks) | ☐ |
**Acceptance:** W-E3…W-E7, W-E13 green; manager completes a full pilot day from a phone; every KPI links to its list.

## Phase 2 — Location
Live map (polling, freshness), Route history (polyline, stops, scrubber, events). **Acceptance:** W-E10, W-E11; route day renders < 2 s.

## Phase 3 — Reports
Staff performance, branch trends, aging, promise fulfilment, attendance reports, exports center, reconciliation, data quality, saved views. **Acceptance:** W-E12; numbers match API; Bangla PDF correct.

## Phase 4 — Premium (as approved)
Broadcasts, leave approvals, day-sheet planner, print views, SMS logs.

## Status notes (2026-11-15)
- Verified: lint (incl. boundaries), typecheck, 44 unit tests, 16 Playwright journeys incl. axe on 12 pages, `check:permissions`, `check:i18n`, static export served with rewrites + hashed CSP.
- Bundle: first-load JS is 203–258 KB (Next's report); the 250 KB budget is exceeded on `/admin/users` and `/admin/audit`. Next step: lazy-load page components from the registry.
- Next: adopt contract 1.2.0 (`location.trackingProvider`/`providerConfig`, `installmentPoisha`, `overduePoisha`, `areaName`, nullable `geo` + `geoUnavailableReason`, contact attempts), then customers map, promises, visits, staff, attendance, assignments, handovers, devices, system health.

## Contract gaps reported to field-api
1. No response schema: `GET /collections/conflicts`, `GET /cash/deposits`, `GET /tags/review-queue`, `GET /notifications` (read as `{items, nextCursor}`).
2. No `GET /rbac/overrides/branch/{branchId}`: the matrix reads current branch overrides through one user of that role (`/rbac/users/{id}/effective`, source = branch). Empty when no such user.
3. `/auth/me` flags are resolved for the user, not per branch: a super admin switching branch cannot see a branch-level flag OFF.
4. `Deposit` has no depositor name (joined from cash positions).
5. Person names (`assignee.name`, `collector.name`, `userName`, audit `actor.name`) are plain strings, not I18nText.
6. Master catalog has 46 permission keys; docs say 50.
