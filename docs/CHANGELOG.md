# Changelog — admin-web

## [Unreleased]
Contract pinned: field-api `openapi.yaml` **1.8.0** (1.2.0 → 1.8.0; 1.8.0 was taken from field-api PR 4 `feat/attendance-photo-every-event` before its merge, re-sync from `main` after it lands; types regenerated with `pnpm gen:api`).
### Changed
- URL state: `set()` starts from the address bar instead of the params captured at render, so two quick changes (a filter, then a row click) no longer drop each other (fixed a flaky promises journey).
- Pin approvals read `GET /location-proposals` as a plain array (field-api 1.7.0) and still accept the older `{ items }` envelope (`shared/api/list.ts`).
- Permissions → branch tab reads current exceptions from `GET /rbac/overrides/branch/{branchId}` (1.3.0) instead of probing through one user; the "read through one user" notice is gone.
- A super admin viewing one branch now gets that branch's effective feature flags (`GET /feature-flags/effective`), so a module switched OFF for the branch is hidden while it is selected.
- Deposits show `Deposit.userName`; conflicts and deposits lists use the typed envelopes (casts removed).
### Added
- Route history: the day's visits and collections (contract 1.7.1 `events[].data`) are listed with time, customer link, receipt and amount, collection points are drawn on the map, and the field money collected along the route is shown (app records, not the ERP ledger).
- Attendance photos (FR-ATT-001, contract 1.8.0): a row in the attendance day view opens a drawer with every event of that staff member (work start, break start, back to work, work end) with the front-camera photo taken at that moment (presigned URL, enlarge on click), time, location accuracy and flags (no photo, no location, mock GPS, phone clock wrong, sent late); corrected and replaced events are marked. Days with a missing photo carry a "No photo" badge in the day list.
- Settings: `attendance.selfieRequired` (master switch) and `attendance.selfieEvents` (which of the four moments need a photo; new multi-select field type; at least one while required). `attendance.selfieAtWorkIn` is gone from the API and from the form.
- Bulk assign (FR-ASG): select customers in the customers list and give them to one staff member (`POST /assignments/bulk`, at most 1000, optional reason); the dialog is exported by the assignments feature and shown only with `assignment.manage` and `module.assignments`.
- CI workflow (`.github/workflows/ci.yml`): lint, typecheck, unit tests, permission and i18n checks, mock build and Playwright journeys on every push and pull request.
- Reports (FR-RPT) at `/reports`, three tabs: **Branch trends** (field collections by day or week for 7/30/90 days with cash/mobile split, receipts and visits, chart with table view; ERP overdue aging from the latest nightly snapshot with movement since the first one, labelled as ERP figures), **ERP reconciliation** (one business date: posted and waiting field collections against what the ERP reports with its fetch time, matched count, gap, mismatch table by kind) and **Downloads** (async CSV/XLSX export of collections, staff performance, attendance, overdue customers, cash positions; range limits from the contract; polls until ready; needs `report.export`). PDF export is not offered because the API answers 422 for it. The audit log export (contract 1.7.1, at most 31 days) is offered to users with `audit.view`.
- Devices (FR-AUTH-007/008) at `/admin/devices`: phones bound to staff accounts, by state (waiting for approval, active, unbound) with nav badge; rooted/emulator flagged; silent-for-days warning; approve (confirm, extra warning on a risky phone) and unbind with a reason. Flag `module.devices`, permission `device.manage`.
- System health (FR-ERP-003/004, FR-SYNC-005) at `/admin/system`: server status and version, ERP link (mode, last success, data age, circuit breaker, posting queue with a link to failed collections) and per-phone sync state sorted problems first (held items, last push/pull, app version, last error). Permission `settings.manage`.
- Live map (FR-LOC-006) at `/live`: last known position of each staff member, coloured by freshness (live, stale, no signal), mock GPS and low battery badges, on-break marker, side list sorted problems first, details (visits today, field collected today, movement, accuracy, battery, tracking engine incl. paid-to-free fallback), refresh every 30 s, link to today's route. Flag `module.location`, permission `location.view`.
- Route history (FR-LOC-007) at `/routes`: pick a staff member and a day; day summary (distance, moving, stopped, stops, time without position, mock points), the track on the map, numbered stops (customer or other place, dwell, distance from the pin), gaps and that day's events. Permission `location.history.view`.
- Shared map: `decodePolyline` and solid `paths` on `MapView`.
- Areas & assignments (FR-ASG) at `/areas`: one card per area (customers, ERP area codes, who is assigned), a warning when an active area has nobody with a link to the unassigned customers, assign a staff member, remove an assignee (confirm names the area, the staff member and the customer count; extra warning for the last one), create and edit an area (`If-Match`), deactivate. Gated by `module.assignments` + `assignment.view`; changes need `assignment.manage`.
- Customer map (FR-CUS-008) at `/map`: Leaflet map with status-coloured pins, clusters when zoomed out, status filters, a text list of the customers in view beside the map (keyboard and screen-reader path), customer drawer. Tiles come from `/meta/app-config`.
- Pin approvals (FR-CUS-010) at `/pin-approvals`: each proposal shows the current and proposed pin on a small map, distance moved, GPS accuracy, proposer and note; approve (confirm) or reject (reason); nav badge.
- Shared `shared/map` (MapView, geo helpers, tile provider hook).
- Staff (FR-RPT-001): per-staff performance for today or this month (collected vs target, collections, visits, promises kept, attendance, field time), branch totals, sort, drawer with method split, assigned areas and jumps to that staff member's collections, visits and attendance.
- Attendance (FR-ATT): day view (who came, on duty now, late, absent; first in, last out, late, break, duty) sorted problems first, month matrix (staff × days with letter + colour cells, totals per staff), manual correction of one event with a reason (`attendance.manage`).
- `formatMonth` in shared format helpers.
- Promises (FR-PRM): list by promised-date window (today, next 7, last 7, last 30 days) and status, paid-so-far, late marker, drawer with progress, cancel an open promise with a reason.
- Visits (FR-VIS): list by period, outcome and staff member, one location verdict per visit (near pin, far, mock GPS, no location with the reason), duration, drawer and photo lightbox through presigned URLs.
- Handovers (FR-HO-001/004/005/006): list by state (awaiting acceptance, in force, ended) with nav badge, detail drawer with the receiver summary, new handover dialog (from, to, areas, effective date, temporary cover with end date, reason, cash warning), cancel a pending handover; ⌘K "New handover"; journey W-E7 and axe.
- Customers: installment column, overdue amount under outstanding (list, drawer, detail), area name from the assignment area (address stays as tooltip/detail).
- Customer detail: "Contact attempts" card (FR-M-014) listing calls/SMS logged by staff with outcome, duration and phone slot; phone numbers are never shown from this feed.
- Collections: `no_location` flag badge, and the drawer says "No location" instead of a blank distance.
- Settings: `location.providerConfig` is shown read-only under "Other" (non-secret engine options; the paid licence key lives in the app build).

## [0.1.0] — 2026-11-15
Contract pinned: field-api `openapi.yaml` **1.0.0-spec** (types in `src/shared/api/schema.d.ts` via `pnpm gen:api`). 1.2.0 is published by field-api; adoption is the next step (see 09-progress).
### Added
- App shell: collapsible sidebar (64 px rail), mobile sheet, branch switcher with URL sync, ⌘K command palette and search, ERP freshness indicator, inbox bell, user menu (Bangla/English, Bangla digits, light/dark/system), idle timeout with warning, offline banner, keyboard shortcuts (`g i/c/o/l/h`), module-off and forbidden pages.
- Auth: login (demo accounts card in mock mode), forced and voluntary password change, memory-only access token, single-flight refresh, proactive refresh.
- Overview dashboard: six KPIs that link to their lists, 7-day collections trend with table toggle, method mix, ERP sync card, staff-today table, widget extension point.
- Inbox: status tabs, severity chips, grouped list, snooze and resolve with reason, nav badge.
- Customers: list with filters/sort/URL state/drawer, full detail page (overview, payments, timeline, notes, extension tabs), refresh from ERP; bad-customer tag tab (tag/untag with reason, history).
- Collections: list with range presets, method/status filters, totals by method, drawer, void with reason; conflicts page with field record, customer's current plans, collector's cash and resolution (post to plan, advance, retry, refund, void) with an Idempotency-Key reused on retry.
- Cash: KPIs, pending deposit queue with verify (amount confirmation) and reject (reason), deposit history, collector positions sorted over-limit first.
- Admin: users and roles (create, edit with If-Match and reason, deactivate/reactivate, reset password with one-time temporary password), permissions matrix (role defaults, branch overrides, one-user overrides with source, bulk per module, staged changes saved with reason), feature flags (global and per-branch), settings (typed sections incl. location tracking engine free/paid `location.trackingProvider`), audit log with before/after diff.
- Shared UI: DataTable (priority columns, card list under 640 px, density, column visibility, pager), Drawer, Dialog (bottom sheet on mobile), ReasonDialog, Segmented, TriState, StagedBar, KpiCard, ChartCard, StatusBadge, MoneyText.
- Mock API (MSW) with deterministic demo data for three branches.
- Tooling: `check:permissions`, `check:i18n`, `serve` (production rewrites + hashed CSP), `new:feature`; 44 unit tests; 16 Playwright journeys (W-E1, W-E3, W-E4, W-E5, W-E6, W-E8, W-E9, W-E13, W-E14, CSP, axe on 12 pages).
### Changed
- Token `--fg-tertiary` (light) darkened from neutral-500 to `#646e80` for 4.5:1 contrast on `surface-subtle`. Mirror in staff-app design guide §2 (shared tokens v1.0.1).
### Fixed
- ReasonDialog no longer clears the typed reason when the parent re-renders.

## [0.0.0] — 2026-11-15
### Added
- Initial specification: role analysis, requirements subset + web-only FR-W-001…020, design guide with shared design tokens v1.0, architecture (features, manifest, extension points, folder tree), client data model, test plan, ADR-W01…W08, roadmap.
- Contract baseline: field-api `openapi.yaml` 1.0.0-spec.
