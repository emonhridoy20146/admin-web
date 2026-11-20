# 02 — Requirements (admin-web subset)

IDs, statuses and permission keys are defined in the master catalog `field-api/docs/02-requirements.md` (permission catalog §3.1). This file lists what admin-web implements, plus web-only UI requirements (`FR-W-…`). Status follows the master; web-only items: `active` if they are needed to deliver a master FR, `proposed` **[ADDED]** otherwise.

## 1. Master FRs implemented in admin-web

| Area | FR-IDs | Page(s) |
|---|---|---|
| Auth | FR-AUTH-001, 002, 003, 004, 008 | Login, change password, sessions |
| RBAC | FR-RBAC-001…005, 007 | Users & roles, Permissions |
| Users/branches/settings/flags | FR-USER-001/002, FR-BR-001, FR-SET-001…003, FR-FLAG-001/002 | Admin section |
| ERP status | FR-ERP-003, 004, 005 | Header dot, System health, customer refresh |
| Customers | FR-CUS-001…011 | Customers, detail, Map, Data quality (FR-CUS-009, under Reports), set pin on the map (FR-CUS-011) |
| Tags | FR-TAG-002, 003, 005, 006, 007, 008 | Customer detail, Inbox |
| Collections | FR-COL-005, 006, 007, 009, 010, 013, 014, 015 | Collections, Conflicts, Reconciliation, Daily targets (FR-COL-015: branch default and personal targets with history; progress on Staff and Overview) |
| Cash | FR-CASH-001, 002, 003, 004, 005 | Cash & deposits |
| Assignments | FR-ASG-001…005 | Assignments & areas, Map, assign one customer from its detail (FR-ASG-002), bulk assign from the list |
| Handovers | FR-HO-001, 003, 004, 006, 007 | Handovers |
| Visits/notes/promises | FR-VIS-004, FR-CUS-006, FR-NOTE-001, FR-PRM-001, 004 | Customer detail, Visits, Promises |
| Co-work | FR-CW-004, 005 | Co-work, Visits (single/joint filter, partners), Staff (single/joint/credit), Settings |
| Attendance | FR-ATT-004, 006, 008 | Attendance |
| Location | FR-LOC-006, 007, 012 | Live map, Route history |
| Notifications | FR-NOT-002, 003, 005 | Bell, Broadcasts |
| Inbox/dashboard/search | FR-INB-001, FR-DSH-001, FR-SRCH-001 | Inbox, Overview, ⌘K |
| Reports | FR-REP-001…006 | Reports, Exports (CSV, XLSX, server PDF), Leaderboard (FR-REP-005), print to PDF (FR-REP-003) |
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
| FR-W-021 **[ADDED 2026-11-17]** | Map point picker: fixed centre pin, map moves under it (pointer, wheel, keyboard), pasted coordinates accepted, coordinates always shown as text, refuses points outside Bangladesh. Used to set a customer's pin (FR-CUS-011). | active | P1 | U E |
| FR-W-022 **[ADDED 2026-11-17]** | Leave approvals: waiting requests first, status and date filters with counts, approve with a confirmation naming the days, reject with a reason, overlap warning and the person's other requests; nav badge with the waiting count (master FR-ATT-008, contract 1.12.0). | active | P2 | U E A |
| FR-W-023 **[ADDED 2026-11-17]** | Holidays and shifts: holidays per year (national or some branches), add and delete; shifts with hours, weekly off, late grace and break limit, add and edit; a user's shift in the user form (master FR-SET-002/003). | active | P2 | U E A |
| FR-W-024 **[ADDED 2026-11-17]** | Notices: compose in Bangla (English optional) to branches and groups, must read, confirm before sending; list with read counts; who has not read first, with read times (master FR-NOT-005, contract 1.12.0). | active | P2 | U E A |
| FR-W-025 **[ADDED 2026-11-18]** | Real ERP shape on customers: invoice number, credit sale, products and serials, guarantor of the sale, frequency, written off, late fee per line, rolled lines hidden, returned/cancelled not collectable, ERP risk badge, detailed address and directions; payments with ERP receipt, method name, collector, advance, discount, reversed (master FR-ERP-006, contract 1.13.0). | active | P1 | U E |
| FR-W-026 **[ADDED 2026-11-18]** | Link a user to an ERP employee from a live list (staff of the user's branches first, change or remove on edit, typed id when the ERP is down); hints for the real ERP's conflict codes with a link to the unlinked collector (master FR-ERP-006). | active | P1 | U E |
| FR-W-027 **[ADDED 2026-11-18]** | Branch map points in Settings: set by moving the map or pasting coordinates, refuse points outside Bangladesh, remove; warehouses marked (master FR-BR-002). | active | P2 | E A |
| FR-W-028 **[ADDED 2026-11-18]** | Invoice viewer: customer invoices filtered by kind (installment / credit) and state; one invoice with products, ERP money lines, every installment with date, amount, paid, left, state, paid-on date and receipt, credit pay-by date with days left/overdue, payments of the invoice, guarantor, print (master FR-CUS-013, contract 1.14.0). | active | P1 | U E A |
| FR-W-030 **[ADDED 2026-11-18, owner request]** | Total customers: the customer list shows the total number of customers in scope in the header and the pager (`includeTotal=true`, capped at 10,000 by field-api). | active | P0 | U |
| FR-W-031 **[ADDED 2026-11-18, owner request]** | "Sync from ERP" button in the top right of the header (permission `erp.sync`): pulls the latest customer data now, repeats while the server says `partial`, reports the count, refetches the screen; failure is an inline banner with retry (master FR-ERP-007, contract 1.17.0). | active | P1 | U E |
| FR-W-032 **[ADDED 2026-11-18, owner request]** | Delete a customer's map pin (permission `customer.location.approve`): confirmation dialog that names the customer and the coordinates and requires typing a confirm word before the button is enabled; works from the customer page, the drawer and therefore the map (master FR-CUS-014, contract 1.17.0). | active | P1 | U E A |
| FR-W-034 **[ADDED 2026-11-18]** | Live map and customer map show each active branch's map point as a branch pin (house glyph, brand colour) and a "my location" button that shows the admin's own browser position (asked on click, kept in the page only, never sent). Requires `Permissions-Policy: geolocation=(self)`. | active | P1 | U E A |
| FR-W-035 **[ADDED 2026-11-18]** | Tasks page `/tasks` (flag `module.tasks`; master FR-TASK-001..005): give one field staff member a task with a title, a free-form note and an optional due date (not tied to a customer; branch picked first so staff of several branches can be chosen in each); tabs In progress / To verify / Late / Resolved / Cancelled with counts, filter by staff, title search; one task opens in a drawer with the note, what the staff member wrote with the resolve request, the admin's note, and the history; **verify** (confirm naming staff and task, optional note), **send back** (reason of at least 5 characters, shown to the staff member), **cancel** (destructive reason dialog), edit while open. Nav badge = requests waiting for verification. Viewers read only. Not optimistic. | active | P4 |
| FR-W-036 **[ADDED 2026-11-21]** | Customer phone numbers (master FR-CUS-016, contract 1.23.0): the customer page and drawer list the ERP numbers first with an ERP mark and the numbers added in the field system with an "added" mark, whose number, who added it and when. Users with `customer.phone.manage` add one to five numbers in one dialog and remove an added one after a confirm; an ERP number cannot be removed. | active | P1 |
| FR-W-037 **[ADDED 2026-11-21]** | Work marks (master FR-CUS-017, contract 1.24.0): every customer row, in every filter and on mobile cards, shows four marks for the current month: visited, money (ERP / pending in ERP), promise (open / broken / kept) and map pin set or missing, each with colour, icon and a text label; a key explains them. The customer drawer and page show "this month": visits, ERP money, pending money as a separate number, promises, and the customer's invoice count. | active | P1 |
| FR-W-038 **[ADDED 2026-11-21]** | Invoice counts (master FR-CUS-018): the customers page header shows the invoices of the customers in view (all, and those with a balance) for one branch or all branches; a row shows the customer's total when it is more than the open ones. | active | P1 |
| FR-W-039 **[ADDED 2026-11-21]** | Readable spans: a duration in minutes is shown as hours and minutes, and a count of days as years, months and days (its two largest units), everywhere a length of time is shown (overdue, late, promise dates, silent phones). | active | P2 |
| FR-W-040 **[ADDED 2026-11-21]** | Settings edits only keys field-api defines; a server setting that is one JSON value (`attendance.defaultShift`, `location.sampling`) is edited as separate fields and saved whole. The mock API refuses unknown keys like the server. | active | P2 |
| FR-W-041 **[ADDED 2026-11-21]** | Settings per branch (master FR-ATT-010..012): a scope select (organisation or one branch) shows and saves only branch-overridable settings for a branch; duty hours include weekly days off (may be none), weekly break windows, overtime threshold; late days per absent day is organisation-wide. | active | P2 |
| FR-W-042 **[ADDED 2026-11-21]** | Attendance shows what the server derives since 1.25.0 (master FR-ATT-010..012): overtime per day and per month, break over the limit, a worked day off, and the absent days that late days count as (separate from absences). | active | P2 |
| FR-W-029 **[ADDED 2026-11-18]** | Customer map: opens on Patuakhali district or the branch point, keeps the user's view in the link; pins in map-pin shape coloured by payment state with a glyph, clusters with the colour mix, colour legend as filter, installment/credit switch; same filters and colour badge on the customer list (master FR-CUS-012, contract 1.14.0). | active | P1 | U E A |
| FR-W-033 **[ADDED 2026-11-18]** | Staff in several branches: the user form lets field staff hold more than one branch with a home-branch picker (first branch); settings choose whether field staff see the whole branch or only assigned customers (master FR-CUS-015, contract 1.19.0). | active | P1 | U E A |

## 3. Non-functional (web specifics)
| ID | Requirement |
|---|---|
| NFR-W-001 | Shell JS ≤ 250 KB gzip; LCP < 2.5 s on 4G mid-range phone; route chunks lazy; Leaflet and Recharts dynamic import. |
| NFR-W-002 | Strict CSP: `default-src 'self'; connect-src api.<domain> tiles.<provider> <storage host>; img-src 'self' data: blob: tiles storage; script-src 'self'; style-src 'self' 'unsafe-inline' (Tailwind runtime-free build OK)`; `frame-ancestors 'none'`. `img-src` also allows the API origin (photos when field-api keeps files itself, its ADR-039). `Permissions-Policy: camera=(), microphone=(), geolocation=(self)` (FR-W-030). |
| NFR-W-003 | No secrets in the bundle; only `NEXT_PUBLIC_*` non-secret config. |
| NFR-W-004 | WCAG 2.2 AA; axe checks in Playwright on every page. |
| NFR-W-005 | Supports latest 2 versions of Chrome, Edge, Firefox, Safari; Android Chrome ≥ 100. |
