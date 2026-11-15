# 03 — Design Guide (admin-web) and Shared Design Tokens v1.0

Design intent: **calm, dense, trustworthy.** This is a money-and-people control room used for hours a day. It should feel like Linear / Stripe Dashboard quality: quiet neutrals, one confident brand colour, status colours that carry meaning, generous but efficient spacing, crisp tables, zero decoration that does not inform. Bangla is a first-class script, not a translation afterthought.

Stack for UI: Tailwind CSS 4 + shadcn/ui (Radix primitives) + lucide-react icons + TanStack Table + Recharts + react-leaflet. Tokens are CSS variables; Tailwind theme maps to them.

---

## 1. Principles
1. **Status first.** Every screen answers "what needs my attention?" before "what exists?". Exceptions surface at the top (inbox counts, red badges), lists sort by urgency by default.
2. **One click to the truth.** Any number on a dashboard is a link to the filtered list that produced it.
3. **Never colour alone.** Status = colour + icon + label.
4. **Money is sacred.** Amounts right-aligned, tabular figures, `৳`, never truncated; "pending in ERP" visibly different from "posted".
5. **Explain freshness.** Every ERP-derived number shows "as of 10:42" on hover or inline.
6. **Reversible by default.** Confirm only destructive or money actions; everything else is undoable or audited.
7. **Bilingual parity.** Every layout tested with Bangla (longer, taller glyphs) and English.

## 2. Shared design tokens v1.0 (identical in staff-app)

> Canonical source: this section. `staff-app/docs/03-design-guide.md §2` must hold the same values. Token changes bump the version in both files and both CHANGELOGs.

### 2.1 Colour — brand
| Token | Hex | Use |
|---|---|---|
| `brand.50` | `#EEF3FF` | selected row bg, subtle fills |
| `brand.100` | `#DCE5FF` | hover on subtle |
| `brand.200` | `#BACBFF` | focus ring (light) |
| `brand.300` | `#8EA8FF` | — |
| `brand.400` | `#5F7DF7` | primary in dark mode |
| `brand.500` | `#3D5AE8` | charts series 1 |
| `brand.600` | `#2C44CC` | **primary** (buttons, links, active nav) — 7.5:1 on white |
| `brand.700` | `#2437A6` | primary hover/pressed |
| `brand.800` | `#1F3085` | — |
| `brand.900` | `#1C2B6B` | sidebar (optional dark sidebar) |
| `brand.950` | `#121A42` | — |

### 2.2 Colour — neutral (cool grey)
| Token | Hex | Light-mode use |
|---|---|---|
| `neutral.0` | `#FFFFFF` | surface |
| `neutral.25` | `#FBFCFD` | page background |
| `neutral.50` | `#F6F7F9` | table header, subtle panel |
| `neutral.100` | `#EDEFF3` | hover row, input disabled |
| `neutral.200` | `#DDE1E8` | borders, dividers |
| `neutral.300` | `#C4CAD4` | strong border, input border |
| `neutral.400` | `#98A1B0` | placeholder, disabled text |
| `neutral.500` | `#6B7587` | tertiary text (4.7:1) |
| `neutral.600` | `#4D5666` | secondary text (7.4:1) |
| `neutral.700` | `#374050` | — |
| `neutral.800` | `#232A36` | — |
| `neutral.900` | `#151A23` | primary text (17:1) |
| `neutral.950` | `#0B0E14` | dark-mode background |

### 2.3 Colour — semantic & status
| Token | Fg (light) | Bg (light) | Fg (dark) | Bg (dark) | Icon | Meaning |
|---|---|---|---|---|---|---|
| `success` | `#166534` | `#E8F6EC` | `#4ADE80` | `#0F2A1A` | check-circle | done, posted, verified |
| `warning` | `#92400E` | `#FEF3C7` | `#FBBF24` | `#2E2208` | alert-triangle | attention soon |
| `danger` | `#B91C1C` | `#FDECEC` | `#F87171` | `#2D1212` | x-octagon | error, destructive |
| `info` | `#0369A1` | `#E6F4FB` | `#38BDF8` | `#0B2230` | info | neutral info |
| `status.overdue` | `#C62828` | `#FDECEC` | `#F87171` | `#2D1212` | clock-alert | overdue installment |
| `status.dueToday` | `#92400E` | `#FEF3C7` | `#FBBF24` | `#2E2208` | calendar-clock | due today |
| `status.promised` | `#6D28D9` | `#F1EAFE` | `#A78BFA` | `#1F1536` | handshake | promise due today |
| `status.current` | `#2C44CC` | `#EEF3FF` | `#7C93FA` | `#141B3D` | circle-dot | running, not due |
| `status.paid` | `#166534` | `#E8F6EC` | `#4ADE80` | `#0F2A1A` | badge-check | paid up / posted |
| `status.badSuggested` | `#C2410C` | `#FFF1E8` (dashed border `#C2410C`) | `#FB923C` | `#2E1A0C` | flag (outline) | suggested bad |
| `status.tagged` | `#FFFFFF` on `#7F1D1D` | `#7F1D1D` | `#FFFFFF` on `#B91C1C` | — | flag (filled) | tagged bad |
| `status.pending` | `#475569` | `#EEF1F5` | `#A9B1BF` | `#1A2030` | cloud-upload | pending in ERP / queued |
| `status.mock` | `#9D174D` | `#FCE7F3` | `#F472B6` | `#2E1020` | shield-alert | mock GPS / fraud flag |

All fg/bg pairs meet WCAG AA 4.5:1, most ≥ 6:1 (computed values in `07-test-plan.md §4`). `brand.400` (3.6:1 on white) is for dark mode and large graphics only, never body text on light surfaces.

Map pins use `status.*` fg as fill, white 2 px stroke, and a glyph inside (so they work for colour-blind users). Cluster bubbles take the **worst** status in the cluster.

### 2.4 Chart palette (categorical, colour-blind safe order)
`#2C44CC` · `#0EA5A4` · `#F59E0B` · `#DB2777` · `#7C3AED` · `#65A30D` · `#0284C7` · `#EA580C`. Payment methods fixed: cash `#2C44CC`, bKash `#DB2777`, Nagad `#EA580C`, Rocket `#7C3AED`, bank `#0EA5A4`, other `#64748B`.

### 2.5 Typography
| Role | Latin | Bangla | Notes |
|---|---|---|---|
| UI sans | **Inter** (variable) | **Noto Sans Bengali** (variable, 400–700) | font-stack: `"Inter", "Noto Sans Bengali", system-ui, sans-serif`; Bangla glyphs auto-fall to Noto via unicode-range |
| Display (optional headings) | Inter Display / Inter 600 | **Hind Siliguri 600** | only for page titles in Bangla if preferred by client (OD-W03) |
| Mono | **JetBrains Mono** | — | receipt numbers, ids, txn refs |
| Numerals | `font-variant-numeric: tabular-nums` in tables and money | Bangla digits via formatter (০১২৩৪৫৬৭৮৯) | |

Type scale (web, px / line-height). Bangla text uses line-height × 1.15 automatically (`:lang(bn)` rule) because of matras and conjuncts.

| Token | Size | LH | Weight | Use |
|---|---|---|---|---|
| `text.xs` | 12 | 16 | 500 | badges, captions |
| `text.sm` | 13 | 20 | 400/500 | table cells, dense UI |
| `text.base` | 14 | 22 | 400 | body, inputs |
| `text.md` | 16 | 24 | 500 | card titles, drawer titles |
| `text.lg` | 18 | 28 | 600 | section headers |
| `text.xl` | 20 | 28 | 600 | page title (mobile) |
| `text.2xl` | 24 | 32 | 600 | page title (desktop) |
| `text.3xl` | 30 | 38 | 600 | KPI numbers |
| `text.4xl` | 36 | 44 | 700 | hero KPI (dashboard) |

### 2.6 Spacing, radius, elevation, motion
- **Spacing (4-pt grid):** `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64` px → tokens `space.0 … space.64`.
- **Radius:** `xs 4` (badges) · `sm 6` (inputs, buttons) · `md 8` (cards, menus) · `lg 12` (dialogs, drawers) · `xl 16` (app sheets) · `full`.
- **Elevation (light):** `e0` none; `e1` `0 1px 2px rgb(16 24 40 / .06)`; `e2` `0 2px 8px rgb(16 24 40 / .08)` (popover, card hover); `e3` `0 12px 32px rgb(16 24 40 / .14)` (dialog, drawer). Dark mode uses surface steps instead of shadows.
- **Motion:** `fast 120ms`, `base 200ms`, `slow 300ms`; easing `standard cubic-bezier(.2,0,0,1)`, `emphasized cubic-bezier(.3,0,0,1)`. Respect `prefers-reduced-motion` (no slide, fade only).
- **Focus ring:** 2 px `brand.600` + 2 px offset white (dark: `brand.400` with `neutral.950` offset). Never removed.
- **Z-index:** base 0 · sticky 10 · header 20 · drawer 40 · dialog 50 · toast 60 · tooltip 70.

### 2.7 Iconography
lucide (web) / Material Symbols Rounded (app) mapped by meaning in this table so both apps "say" the same thing: collection = `wallet`/`payments`, visit = `map-pin-check`/`where_to_vote`, promise = `handshake`/`handshake`, note = `sticky-note`/`sticky_note_2`, handover = `arrow-left-right`/`swap_horiz`, cash = `banknote`/`payments`, attendance = `clock`/`schedule`, location = `navigation`/`near_me`, tag = `flag`/`flag`, sync = `refresh-cw`/`sync`, conflict = `git-merge` / `merge_type`.

## 3. Layout (admin-web)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ▣ Howlader Field   [Branch: All ▾]   [⌘K Search customers, staff, receipts…]  🔔3 (ERP ● 2m) 👤 │  ← header 56 px
├────────────┬─────────────────────────────────────────────────────────────────────┤
│ Overview   │  Page title                                   [secondary] [Primary]   │
│ Inbox  12  │  Breadcrumb · "as of 10:42"                                            │
│ ───────── │ ┌────────── KPI ──────────┬──────────┬──────────┬──────────┐           │
│ Customers  │ │ Collected today ৳4,82,500│ Visits 312│ Present 27/30│ Conflicts 3│           │
│ Map        │ └──────────────────────────┴──────────┴──────────┴──────────┘           │
│ Collections│ ┌ Filters bar: [Date ▾][Staff ▾][Status chips…]  Saved views ▾  ⚙ cols ┐ │
│ Cash       │ │ Table (sticky header, 13 px, 44 px rows, zebra off, hover neutral.100) │ │
│ Promises   │ │ …                                                                     │ │
│ Visits     │ └───────────────────────────────────────────────── pagination ───────┘ │
│ ───────── │                                                     ┌─ Drawer 480 px ─┐ │
│ Staff      │                                                     │ row detail       │ │
│ Attendance │                                                     │ tabs, actions    │ │
│ Live map   │                                                     └──────────────────┘ │
│ Assignments│                                                                        │
│ Handovers  │                                                                        │
│ Reports    │                                                                        │
│ ───────── │                                                                        │
│ Settings   │                                                                        │
│ Audit log  │                                                                        │
└────────────┴─────────────────────────────────────────────────────────────────────┘
 sidebar 248 px (collapsible to 64 px icon rail)
```
- Content max width 1600 px; page padding 24 px (desktop), 16 px (tablet/mobile).
- Grid: 12 columns, 24 px gutter (desktop), 16 px (≤ md).
- Header shows **ERP freshness dot** (green < 15 min, amber < 60, red otherwise) — click → ERP status panel.
- Branch switcher is global; persists in URL (`?branch=`) and localStorage; managers with one branch see a static label.

### Navigation groups
1. **Overview, Inbox** (badge with open critical+high count)
2. **Field work:** Customers, Map, Collections (sub: Conflicts), Cash & deposits, Promises, Visits
3. **People:** Staff, Attendance, Live map, Route history, Assignments & areas, Handovers
4. **Insights:** Reports, Reconciliation, Data quality
5. **Admin:** Users & roles, Permissions, Settings, Feature flags, Devices, Audit log, System health
Items hidden when the user lacks the permission or the module flag is off.

## 4. Page inventory (each with default sort and primary action)

| Page | Route | Primary content | Default sort | Primary action |
|---|---|---|---|---|
| Overview | `/` | KPIs (collected vs target, visits, attendance, cash on hand, conflicts, overdue), 7-day trend, staff leaderboard table, inbox preview, ERP status | — | — |
| Inbox | `/inbox` | Grouped by severity; each item one-line summary + action buttons inline (Resolve conflict, Verify deposit, Approve pin…) | severity, age | Resolve |
| Customers | `/customers` | Table: name/code, phone, area, assignee, outstanding, days overdue, next due, badges, last visit, open promise | daysOverdue desc | Assign |
| Customer detail | `/customers/[id]` | Header (name bn/en, code, phone, address, status badges, tag control); tabs: Overview (plans cards + schedule table), Payments (ERP + field, distinguished), Timeline, Notes, Visits (photos grid), Promises, Location (pin, proposals), Tag history | — | Tag / Assign |
| Map | `/map` | Full-bleed Leaflet map, left panel filters + list synced with viewport, pin popups | — | Draw area → Assign |
| Collections | `/collections` | Table with totals bar by method; status chips; flags column | recordedAt desc | Export |
| Conflicts | `/collections/conflicts` | Card list with ERP response, customer context, resolution form | age | Resolve |
| Cash & deposits | `/cash` | Positions table (on-hand bar vs limit, oldest cash age), deposits queue with slip preview | over-limit first | Verify |
| Promises | `/promises` | Calendar strip (today ± 7) + table; kept/broken rate | promisedDate | — |
| Visits | `/visits` | Table + photo lightbox; outcome distribution | checkInAt desc | — |
| Staff | `/staff` | Cards/table: photo, role, branch, today status (on duty, break, off), today collected, cash on hand, device, last sync | status | Add staff |
| Staff detail | `/staff/[id]` | Tabs: Today, Performance, Attendance, Route history, Customers, Cash, Devices, Permissions | — | Handover |
| Attendance | `/attendance` | Day grid (staff × time bar with work/break segments), month matrix (P/L/A/H/W), summaries | — | Correct |
| Live map | `/live` | Latest location markers with freshness rings, battery, mock flags; side list | freshness | — |
| Route history | `/routes?user=&date=` | Polyline, stops (numbered), visits/collections pins, timeline scrubber, summary | — | Export day |
| Assignments & areas | `/assignments` | Split view: areas list + map polygons; staff column with load (customers, outstanding) | — | New area |
| Handovers | `/handovers` | Kanban-ish tabs: Pending / Accepted / Rejected / Expired | createdAt desc | New handover |
| Reports | `/reports/*` | Staff performance, branch trends, overdue aging, promise fulfilment, attendance, exports center | — | Export |
| Users & roles | `/admin/users` | Users table; role/branch editors | — | Add user |
| Permissions | `/admin/permissions` | Matrix: rows = permission keys grouped by module; columns = roles; per-branch tab; per-user override drawer showing effective value + source | — | Save (with reason) |
| Settings | `/admin/settings` | Sectioned form: duty & shifts, holidays, cash, location, collections, tags, notifications, app version, tile provider | — | Save |
| Feature flags | `/admin/flags` | Table: key, description, global toggle, per-branch toggles, owner, review-by | — | Toggle (with reason) |
| Devices | `/admin/devices` | Devices, pending approvals, sessions, remote logout | — | Approve |
| Audit log | `/admin/audit` | Filterable table + diff viewer drawer | at desc | Export |
| System health | `/admin/system` | ERP status, outbox, jobs, sync health per device, app versions in field | — | Retry |

## 5. Components and rules

### 5.1 Tables (TanStack Table)
- Row height 44 px (comfortable) / 36 px (compact toggle); cell padding 12 px horizontal.
- Sticky header (bg `neutral.50`, 12 px uppercase-free semibold label — do **not** uppercase Bangla), sticky first column on horizontal scroll.
- Numbers and money right-aligned, tabular; dates left-aligned relative ("৩ দিন আগে") with absolute on hover.
- Status column: badge (icon + label). Max 2 badges + "+N".
- Row click opens **drawer** (keeps list context); ⌘/Ctrl-click opens full page in new tab.
- Selection checkboxes → bulk action bar slides up from bottom (Assign, Export, Tag).
- Server-side pagination (cursor) with page sizes 25/50/100; infinite scroll **not** used for admin tables (users need stable positions).
- Column visibility, order and density saved per user per table (localStorage) + **Saved views** (named filter sets, stored server-side later, P3).
- Empty state: illustration-free; icon + one sentence + action ("No overdue customers in Barishal Sadar. 🎉" is not allowed — no emoji in UI copy).
- Loading: skeleton rows (6), never spinners for tables.
- Error: inline banner above table with retry and requestId copy.

### 5.2 Forms
- Labels above inputs, 14 px medium; helper text 12 px `neutral.600`; error text 12 px `danger` with icon.
- Input height 40 px (44 px on touch devices via `@media (pointer:coarse)`).
- Money input: prefix `৳`, numeric keypad on mobile, formats on blur, stores poisha.
- Reason fields (required for tag, permission, void, resolve, settings) use a reason-code select + textarea min 10 chars, with counter.
- Destructive/money confirmations: dialog repeats amount and customer name in bold; button label is the verb ("Void ৳5,000"), not "OK".
- Validation with zod schemas generated from OpenAPI where possible.

### 5.3 Buttons
Primary (brand.600 bg, white), Secondary (white bg, neutral.300 border), Ghost, Destructive (danger), Link. Sizes: sm 32, md 40, lg 44. One primary per view region. Icon-only buttons have tooltip + aria-label.

### 5.4 Badges & chips
Badge height 22, radius 4, 12 px medium, icon 14 px. Filter chips height 32, radius full; selected = brand.50 bg + brand.700 text + check icon.

### 5.5 KPI cards
Label (13 px secondary) · value (30 px semibold tabular) · delta vs yesterday/last month (▲ success / ▼ danger with text "+12%") · sparkline (7 days) · click → filtered list. "as of" timestamp in footer.

### 5.6 Drawer
480 px (desktop), full-screen (mobile). Header: title, status, close (Esc). Footer: actions. Tabs inside if > 1 section. URL reflects open drawer (`?drawer=customer:6740…`) so it can be shared.

### 5.7 Maps (react-leaflet)
- Tile layer from `TileProvider` config (`/meta/app-config`); attribution always visible bottom-right.
- Custom SVG pins 28 px with glyph; selected pin 36 px with halo.
- Clustering (`leaflet.markercluster` or supercluster) below zoom 14.
- Legend toggleable; layer switcher (customers / staff / areas / routes).
- Route polyline 4 px brand.600, gaps dashed neutral.400, stops as numbered circles; scrubber syncs a moving marker.
- Map + list split view: list updates with viewport ("Showing 46 customers in view").

### 5.8 Charts (Recharts)
- Gridlines `neutral.200` dashed horizontal only; axis labels 12 px secondary; currency axis in lakh format (৳১.২ লাখ).
- Tooltip shows exact values and date in Bangla/English per locale.
- Every chart has a "view as table" toggle (accessibility + export).

### 5.9 Toasts & banners
Toast bottom-right, 4 s, max 3; success/info only. Errors that need action are banners or inline, never toasts.

### 5.10 Empty, loading, error, offline
- Admin offline (navigator.onLine false): top banner "You are offline — showing last loaded data" and disable mutations.
- Feature disabled: page shows "This module is turned off for this branch" with link to flags (SA only).

## 6. Responsive rules
| Breakpoint | Width | Layout |
|---|---|---|
| `xs` | < 640 | Sidebar → bottom sheet nav via hamburger; tables → **card lists** (title = name, 3 key fields, badges, chevron); drawers full screen; KPI cards 2 per row; maps full-screen with bottom sheet list |
| `sm` | ≥ 640 | Same as xs, KPI 2 per row, filters in a sheet |
| `md` | ≥ 768 | Icon-rail sidebar (64 px); tables with priority columns only (hide by `meta.priority` 3+) |
| `lg` | ≥ 1024 | Full sidebar; drawers side panel |
| `xl` | ≥ 1280 | Default desktop |
| `2xl` | ≥ 1536 | Split views (list + map, list + detail) |
- Each table column declares `priority` 1–5; columns with priority > n are hidden at each breakpoint and accessible via row expansion.
- Touch targets ≥ 44 px on coarse pointers.
- Manager phone-browser critical tasks (must be excellent at 360 px): Inbox, resolve conflict, verify deposit, approve handover/device/pin, live map, staff today.

## 7. Accessibility
WCAG 2.2 AA: contrast per tokens; keyboard: every action reachable, visible focus, `/` focuses search, `⌘K` command palette, `g i` inbox, `g c` customers; Radix provides ARIA patterns; tables use proper `<th scope>`; charts have table alternative; `lang="bn"` set on Bangla content for screen readers and font shaping; never rely on hover only (touch).

## 8. Localization
- `next-intl` is not used (no SSR); use **i18next + react-i18next** with namespaces per feature (`customers.json`), Bangla default, English toggle per user (stored in profile).
- ICU plurals; Bangla digits toggle (user setting) applied by `formatNumber`/`formatMoney`/`formatDate` from `src/shared/lib/format.ts`; never `toLocaleString` ad hoc.
- Dates: Bangla month names; calendar weeks start Saturday (BD convention) — confirm OD-W02.

## 9. Dark mode
Supported (system default + toggle). Surfaces: bg `#0B0E14`, surface `#121722`, raised `#1A2030`, border `#262E3F`; text primary `#E7EAF0`, secondary `#A9B1BF`; primary `brand.400`. Status colours use the dark column of §2.3. Maps use a dark tile style if provider offers one, else normal tiles with 85 % brightness filter.
