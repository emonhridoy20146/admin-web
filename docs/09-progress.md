# 09 — Progress (admin-web)

Phases match `field-api/docs/09-progress.md`. admin-web can start each phase against the Prism mock of `openapi.yaml` before field-api endpoints exist.

## Phase 0 — Shell & admin foundations
| Item | FR | Status |
|---|---|---|
| Repo, CI (lint, boundaries, typecheck, unit, Playwright, axe, Lighthouse), tokens.css, fonts | NFR-W-* | ☐ |
| Auth: login, change password, refresh, idle timeout | FR-AUTH-001..004, FR-W-002 | ☐ |
| Shell: header, sidebar, branch switcher, feature registry, `<Can>` | FR-W-001, FR-W-003 | ☐ |
| Users & roles, Permissions matrix, Settings, Flags, Audit | FR-USER-*, FR-RBAC-*, FR-SET-*, FR-FLAG-*, FR-AUD-003, FR-W-009 | ☐ |
| Shared UI kit: DataTable, Drawer, ReasonDialog, StatusBadge, MoneyText, KpiCard, EmptyState | FR-W-004/005/008 | ☐ |
**Acceptance:** W-E1, W-E2, W-E8, W-E9, W-E14 green; axe clean; shell JS ≤ 250 KB gzip.

## Phase 1 — Field operations MVP
| Item | Status |
|---|---|
| Overview dashboard, Inbox, ⌘K search | ☐ |
| Customers list/detail/map, tags, data freshness, pin approvals | ☐ |
| Collections, Conflicts resolution, Cash & deposits | ☐ |
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
