# Changelog — admin-web

## [Unreleased]
Contract pinned: field-api `openapi.yaml` **1.5.0** (1.2.0 → 1.5.0, synced from field-api branch `build/phase-0-1`; types regenerated with `pnpm gen:api`).
### Changed
- Permissions → branch tab reads current exceptions from `GET /rbac/overrides/branch/{branchId}` (1.3.0) instead of probing through one user; the "read through one user" notice is gone.
- A super admin viewing one branch now gets that branch's effective feature flags (`GET /feature-flags/effective`), so a module switched OFF for the branch is hidden while it is selected.
- Deposits show `Deposit.userName`; conflicts and deposits lists use the typed envelopes (casts removed).
### Added
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
