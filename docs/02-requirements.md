# 02 — Requirements (admin-web subset)

IDs, statuses and permission keys are defined in the master catalog `field-api/docs/02-requirements.md` (permission catalog §3.1). This file lists what admin-web implements, plus web-only UI requirements (`FR-W-…`). Status follows the master; web-only items: `active` if they are needed to deliver a master FR, `proposed` **[ADDED]** otherwise.

## 1. Master FRs implemented in admin-web

| Area | FR-IDs | Page(s) |
|---|---|---|
| Auth | FR-AUTH-001, 002, 003, 004, 008 | Login, change password, sessions |
| RBAC | FR-RBAC-001…005, 007 | Users & roles, Permissions |
| Users/branches/settings/flags | FR-USER-001/002, FR-BR-001, FR-SET-001…003, FR-FLAG-001/002 | Admin section |
| ERP status | FR-ERP-003, 004, 005 | Header dot, System health, customer refresh |
| Customers | FR-CUS-001…010 | Customers, detail, Map, Data quality |
| Tags | FR-TAG-002, 003, 005, 006, 007, 008 | Customer detail, Inbox |
| Collections | FR-COL-005, 006, 007, 009, 010, 013, 014, 015 | Collections, Conflicts, Reconciliation |
| Cash | FR-CASH-001, 002, 003, 004, 005 | Cash & deposits |
| Assignments | FR-ASG-001…005 | Assignments & areas, Map |
| Handovers | FR-HO-001, 003, 004, 006, 007 | Handovers |
| Visits/notes/promises | FR-VIS-004, FR-CUS-006, FR-NOTE-001, FR-PRM-001, 004 | Customer detail, Visits, Promises |
| Co-work | FR-CW-004, 005 | Co-work, Visits (single/joint filter, partners), Staff (single/joint/credit), Settings |
| Attendance | FR-ATT-004, 006, 008 | Attendance |
| Location | FR-LOC-006, 007, 012 | Live map, Route history |
| Notifications | FR-NOT-002, 003, 005 | Bell, Broadcasts |
| Inbox/dashboard/search | FR-INB-001, FR-DSH-001, FR-SRCH-001 | Inbox, Overview, ⌘K |
| Reports | FR-REP-001…006 | Reports, Exports |
| Audit | FR-AUD-003 | Audit log |
| Devices | FR-AUTH-007, 008 | Devices |
| Sync health | FR-SYNC-005 | System health |
| Microfinance | FR-MF-001 | Feature `microfinance` folder reserved; no route |

## 2. Web-only requirements

| ID | Requirement | Status | Phase | Test |
|---|---|---|---|---|
| FR-W-001 | App shell: header (branch switcher, search, bell, ERP status, user menu), collapsible sidebar, permission- and flag-aware navigation. | active | P0 | E |
| FR-W-002 | Session handling: access token in memory, silent refresh via cookie on load and before expiry, single-flight refresh, logout on `REFRESH_REUSED`, idle timeout 30 min (warning at 28). | active | P0 | U E |
| FR-W-003 | Global branch filter persisted in URL + localStorage; every list/report respects it. | active | P0 | E |
| FR-W-004 | Tables: server pagination, sort, filters in URL query (shareable links), column visibility/density saved per user. | active | P1 | U E |
| FR-W-005 | Row → drawer pattern with deep-linkable URL; Esc closes; focus returns to row. | active | P1 | E |
| FR-W-006 | Every KPI and chart value links to the filtered list. | active | P1 | E |
| FR-W-007 | "As of" freshness on ERP-derived values; manual refresh on customer detail. | active | P1 | E |
| FR-W-008 | Mutations with reasons use a shared `ReasonDialog` (reason code + text, min length, shows diff when relevant). | active | P1 | U E |
| FR-W-009 | Permissions matrix: modules grouped, role defaults, branch overrides tab, user override drawer, effective value + source, bulk toggle, save with reason, preview of affected users count. | active | P0 | E |
| FR-W-010 | Optimistic UI only for non-money actions (mark read, snooze); money actions wait for server. | active | P1 | U |
| FR-W-011 | Error handling: problem+json mapped to friendly bilingual messages; "Copy details" with requestId. | active | P0 | U |
| FR-W-012 | Polling: Live map every 60 s while visible; inbox count every 60 s; pause when tab hidden (Page Visibility API). | active | P2 | U |
| FR-W-013 | Mobile responsive per design guide §6; card lists below 640 px. | active | P1 | E (mobile viewport) |
| FR-W-014 **[ADDED]** | Command palette (⌘K): jump to customer/staff/receipt, run actions ("New handover", "Verify deposits"). | proposed | P1 | E |
| FR-W-015 **[ADDED]** | Keyboard shortcuts (`g i`, `g c`, `/`, `?` help). | proposed | P1 | E |
| FR-W-016 **[ADDED]** | Saved views for tables (named filters), shareable within branch. | proposed | P3 | E |
| FR-W-017 **[ADDED]** | Photo lightbox with metadata overlay (time, GPS, distance to pin, mock flag), zoom, next/prev. | proposed | P1 | E |
| FR-W-018 **[ADDED]** | Print-friendly views (customer statement of field activity, day sheet for a staff). | proposed | P3 | E |
| FR-W-019 | Dark mode + language toggle + Bangla digits toggle in user menu. | active | P0 | E |
| FR-W-020 **[ADDED]** | Day-sheet planner: manager sees staff's due-today/promised list on a map before the day and can reassign. | proposed | P3 | E |

## 3. Non-functional (web specifics)
| ID | Requirement |
|---|---|
| NFR-W-001 | Shell JS ≤ 250 KB gzip; LCP < 2.5 s on 4G mid-range phone; route chunks lazy; Leaflet and Recharts dynamic import. |
| NFR-W-002 | Strict CSP: `default-src 'self'; connect-src api.<domain> tiles.<provider> <storage host>; img-src 'self' data: blob: tiles storage; script-src 'self'; style-src 'self' 'unsafe-inline' (Tailwind runtime-free build OK)`; `frame-ancestors 'none'`. |
| NFR-W-003 | No secrets in the bundle; only `NEXT_PUBLIC_*` non-secret config. |
| NFR-W-004 | WCAG 2.2 AA; axe checks in Playwright on every page. |
| NFR-W-005 | Supports latest 2 versions of Chrome, Edge, Firefox, Safari; Android Chrome ≥ 100. |
