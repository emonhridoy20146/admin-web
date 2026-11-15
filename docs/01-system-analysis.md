# 01 — System Analysis (admin-web's role)

> Whole-system context, contradictions, risks and scale: `field-api/docs/01-system-analysis.md`. This file covers only what matters for the admin panel.

## 1. Role
admin-web is the **control room** for super admins, branch managers and (optional) viewers. It is a client-side-rendered Next.js app (static export, no SSR, no SEO) that talks **only** to `field-api /api/v1`. It never calls Laravel and never holds ERP credentials.

## 2. Users and their top jobs

| User | Device | Top jobs (in order of frequency) |
|---|---|---|
| Super admin (1–2) | desktop | Check overview; review inbox; manage users/permissions/flags/settings; reports & exports; audit |
| Branch manager (~5–10) | desktop + **phone browser** | Morning: who is on duty, cash on hand, today's dues; during day: resolve conflicts, verify deposits, approve handovers/devices/pin corrections, random location checks; evening: day summary, attendance |
| Viewer (optional) | desktop | Reports, collections, audit read-only |

Design consequence: managers use admin-web on phones; the six critical manager tasks in `03-design-guide.md §6` must be excellent at 360 px width.

## 3. What admin-web shows vs. owns
- **Shows** ERP data (customers, plans, balances) from field-api's cache with "as of" time. Never edits money.
- **Owns** nothing persistently except UI preferences (column layouts, density, language, theme, last branch) in localStorage.
- **Acts** through field-api: assignments, handovers, tags, deposits verification, conflict resolution, permissions, settings, flags, exports.

## 4. Constraints
- CSR only (`output: 'export'`), hosted as static files on a CDN/object storage + HTTPS (e.g. Cloudflare Pages / S3+CloudFront / Nginx).
- Same parent domain as the API (`admin.<domain>` + `api.<domain>`) so the refresh cookie can be `SameSite=Strict` (OD-22).
- Must work on low bandwidth (branch offices on mobile hotspots): initial JS ≤ 250 KB gzip for the shell, route-level code splitting, maps and charts lazy-loaded.

## 5. Risks specific to admin-web
| Risk | Mitigation |
|---|---|
| Token theft via XSS (CSR app holds access token) | Access token in memory only; refresh in HttpOnly cookie; strict CSP (no inline scripts, allow-list API/tile/storage hosts); no `dangerouslySetInnerHTML`; dependency audit |
| Managers misreading "pending" money as posted | Distinct `status.pending` visual + label "Pending in ERP"; totals split "Posted / Pending" |
| Large lists on phones | Card lists, cursor pagination, priority columns |
| Contract drift with field-api | Generated types from pinned openapi.yaml version; CI fails on type errors; MSW mocks generated from examples |
| Permission UI mistakes (locking people out) | Permissions matrix shows effective value + source; confirm dialog with diff; required reason; audit; last-SA guard on server |
