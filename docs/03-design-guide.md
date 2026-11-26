# 03 — Design Guide (admin-web) and Shared Design Tokens v1.3

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

## 2. Shared design tokens v1.4 (identical in staff-app)

> Canonical source: this section. `staff-app/docs/03-design-guide.md §2` must hold the same values. Token changes bump the version in both files and both CHANGELOGs.
>
> **v1.2 (2026-11-26, from staff-app ADR-M41):** adds the `shadow.sm` / `shadow.md` group (§2.6), light theme only. **v1.3 (2026-11-26, FR-W-072, ADR-W30; staff-app FR-M-081, PR #61):** adds the bad-tag kinds `status.tag.<reasonCode | legal>` (§2.3b) and the action tones `action.*` (§2.3c). Final values, identical to `staff-app/docs/03-design-guide.md §2` and `docs/design-tokens.json` 1.3.0. **v1.4 (2026-11-26, FR-W-074, ADR-W31; staff-app PR #63):** adds `status.returned` (§2.3) for invoices returned in the ERP; `docs/design-tokens.json` 1.4.0.

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
| `success` | `#166534` | `#E8F6EC` | `#4ADE80` | `#0F2A1A` | check-circle | done, posted, verified, deposited |
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
| `status.returned` (v1.4) | `#0F766E` | `#E3F5F2` | `#2DD4BF` | `#0B2624` | package-return (admin: lucide 0.460 has none → `undo-2`; `package-x` on "Returned product customer") | invoice returned in the ERP: shown, never counted |

All fg/bg pairs meet WCAG AA 4.5:1, most ≥ 6:1 (computed values in `07-test-plan.md §4`). `brand.400` (3.6:1 on white) is for dark mode and large graphics only, never body text on light surfaces.

Customer map pins have the familiar map-pin shape (round head, point on the spot; `shared/map/pin-icon.tsx`) and use the **pay-state** colours of §2.3a with a glyph inside (so they work for colour-blind users); other maps (live staff, routes) keep `status.*` dots. Cluster bubbles take the **worst** state in the cluster and show the mix of states as a ring. Branch pins use the same shape in `primary` (outline `primary-hover`) with a house glyph and sit under customer pins; the admin's own position ("my location" button, 44 px, top right of the map) is an `info.fg` dot with a white ring and a translucent accuracy circle (FR-W-034). Map places (FR-PLC-001) are **not pins**: a small rounded square (`.fos-tile`, 22 px, 24 px when selected with a `focus-ring` halo; `radius-sm`; 1.5 px `neutral-0` border) filled `info.fg` (`warning.fg` while a move is requested) with the kind's 24×24 symbol stroked in `neutral-0`, centred on the spot (`tileIconHtml` in `shared/map/pin-icon.tsx`). They follow street-map zoom levels (`PLACE_ICON_ZOOM` = 13, `PLACE_LABEL_ZOOM` = 16 in `features/places/model/places.ts`): below 13 no places; 13–15 the square only (name on hover); 16 and up the square and the name as a permanent label (`.fos-map-label`: surface, line border, 12 px semibold fg). The open place is always shown with its name. They show on every map (customer, live, routes, pin approvals, every point picker). No new tokens.

### 2.3a Colour — pay state (map pins, v1.1)
The colour of a customer's map pin and pay-state badge (field-api `PayState`, ADR-035; admin ADR-W18). CSS variables `--ps-<state>-pin|fg|bg` (`bad`, `missed-many`, `missed-one`, `due-today`, `on-track`, `paid-off`); `--pin-shadow` `rgb(16 24 40 / 0.35)` for the pin's drop shadow.

| Token | Pin (light) | Fg (light) | Bg (light) | Pin (dark) | Fg (dark) | Bg (dark) | Glyph | Meaning |
|---|---|---|---|---|---|---|---|---|
| `payState.bad` | `#DC2626` | `#B91C1C` | `#FDECEC` | `#EF4444` | `#F87171` | `#2D1212` | alert (!) | tagged bad, or full term over with money left |
| `payState.missedMany` | `#EA580C` | `#C2410C` | `#FFF1E8` | `#F97316` | `#FB923C` | `#2E1A0C` | number missed | 2+ installments missed |
| `payState.missedOne` | `#EAB308` | `#854D0E` | `#FEF9C3` | `#FACC15` | `#FDE047` | `#2E2A08` | 1 | one installment missed |
| `payState.dueToday` | `#2563EB` | `#1D4ED8` | `#E8F0FE` | `#60A5FA` | `#93C5FD` | `#0F1F3D` | dot | installment due today, nothing missed |
| `payState.onTrack` | `#16A34A` | `#166534` | `#E8F6EC` | `#4ADE80` | `#4ADE80` | `#0F2A1A` | check | everything due so far paid |
| `payState.paidOff` | `#64748B` | `#475569` | `#EEF1F5` | `#94A3B8` | `#A9B1BF` | `#1A2030` | check | nothing left to pay |

Fg on bg ≥ 4.6:1 in both themes. The pin body takes the pin colour with a 1.25 px outline in the fg colour (so yellow still stands out on light tiles; dark mode mixes the pin colour with `neutral.950`), a white face and a glyph in the fg colour (`neutral.900` in dark mode).

### 2.3b Colour — bad-tag kinds (v1.3, FR-W-072)
A **bad tag** is a tag whose state is `tagged` and whose severity is anything but `watch` (a missing or unknown severity counts as bad). Such a customer has a **frame in its kind's colour** wherever customers are listed (DataTable row and < 640 px card, drawer and detail header, map list, ⌘K search results, customer picker) and a **chip** (icon + short word) next to the name. `watch`, `pending` and `none` get no frame. Keys are the contract's `reasonCode` values plus `legal` (the severity). fg = frame, icon and chip text; bg = chip tint. CSS `--st-tag-<key>-fg|bg` (kebab case); Tailwind `st-tag-<key>` / `st-tag-<key>-bg`; mapper `shared/ui/tag-look.ts` (`tagLookOf`, `reasonLook`).

| Token | Fg (light) | Bg (light) | Fg (dark) | Bg (dark) | Icon (web) | Kind |
|---|---|---|---|---|---|---|
| `status.tag.absconded` | `#7F1D1D` | `#FBDADA` | `#EF4444` | `#2D1212` | footprints | পলাতক — **strongest**: 2 px frame, filled chip (fg as fill, bg as text) |
| `status.tag.legal` | `#991B1B` | `#FDE3E3` | `#F87171` | `#2D1212` | gavel | severity `legal`, whatever the reason |
| `status.tag.refused_to_pay` | `#B91C1C` | `#FDECEC` | `#FCA5A5` | `#2D1212` | ban | refuses to pay |
| `status.tag.other` | `#D42020` | `#FEF2F2` | `#FECACA` | `#2D1212` | flag (filled) | other; **generic bad = fallback** for an unknown or missing code (there is no `bad` token) |
| `status.tag.fraud_suspected` | `#9D174D` | `#FCE7F3` | `#F472B6` | `#2E1020` | shield-alert | fraud suspected |
| `status.tag.repeated_broken_promise` | `#6D28D9` | `#F1EAFE` | `#A78BFA` | `#1F1536` | heart-crack | repeated broken promises |
| `status.tag.plan_ended_unpaid` | `#C2410C` | `#FFF1E8` | `#FB923C` | `#2E1A0C` | calendar-x | plan over, balance unpaid |

**Precedence:** absconded → legal → the reason → `other`. Staff-app also counts a latest visit outcome `runaway` (no later visit or collection) as absconded; admin list items carry no visit outcome, so the panel does not (ADR-W30). **Frame:** 1.5 px, absconded 2 px, +0.5 px with `prefers-contrast: more`. **Chip:** fg on bg with a 1 px fg hairline; absconded is filled. **Contrast:** chip text ≥ 4.6:1 in both themes (light 4.69–7.70, dark 4.62–12.0); frames ≥ 4.3:1 on surface, raised and the selected row. Never colour alone: the chip says the kind with an icon and a word. The tag dialog shows every reason with its frame and a swatch (the kind's icon in fg on its bg); the picked one takes the tint, and a live line shows the chip the customer will get (watch → no frame). ⌘K customer results (`SearchResult.tag`) and the map list (`MapPin.tag`, contract 1.52.0) are framed the same way; a pin with only `tagged: true` (older server) uses `other`.

### 2.3c Colour — action tones (v1.3, shared set)
Tonal containers for shortcut icons in staff-app (bg = 40 px circle/square, fg = icon). admin-web keeps them in `tokens.css` (`--action-<key>-fg|bg`) for parity but does not use them yet.

| Token | Fg (light) | Bg (light) | Fg (dark) | Bg (dark) | Meaning |
|---|---|---|---|---|---|
| `action.brand` | `#2437A6` | `#DCE5FF` | `#B9C6FF` | `#1B2757` | duty and the office |
| `action.teal` | `#115E59` | `#D5F3F0` | `#5EEAD4` | `#0E2F2D` | the field and people |
| `action.green` | `#166534` | `#DDF3E4` | `#4ADE80` | `#0F2A1A` | money |
| `action.violet` | `#5B21B6` | `#EBE5FD` | `#C4B5FD` | `#251A45` | goals |
| `action.amber` | `#92400E` | `#FEF0C7` | `#FBBF24` | `#2E2208` | time and notices |

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
- **Shadow (v1.2, shared with staff-app):** `shadow.sm` `0 1px 2px rgb(16 24 40 / 0.06), 0 1px 3px rgb(16 24 40 / 0.08)` (cards) · `shadow.md` `0 4px 12px -2px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.04)` (summary cards). Light theme only: dark mode has no shadow (`none`), depth comes from the surface steps and the 1 px border. CSS `--sh-sm` / `--sh-md`, Tailwind `shadow-sm` / `shadow-md`.
- **Motion:** `fast 120ms`, `base 200ms`, `slow 300ms`; easing `standard cubic-bezier(.2,0,0,1)`, `emphasized cubic-bezier(.3,0,0,1)`. Respect `prefers-reduced-motion`: no slide, fade only, and colour/opacity transitions are instant.
- **Focus ring:** 2 px `brand.600` + 2 px offset white (dark: `brand.400` with `neutral.950` offset). Never removed.
- **Z-index:** base 0 · sticky 10 · header 20 · drawer 40 · dialog 50 · toast 60 · tooltip 70.

### 2.7 Iconography
lucide (web) / Material Symbols Rounded (app) mapped by meaning in this table so both apps "say" the same thing: collection = `wallet`/`payments`, visit = `map-pin-check`/`where_to_vote`, promise = `handshake`/`handshake`, note = `sticky-note`/`sticky_note_2`, handover = `arrow-left-right`/`swap_horiz`, cash = `banknote`/`payments`, attendance = `clock`/`schedule`, location = `navigation`/`near_me`, tag = `flag`/`flag`, sync = `refresh-cw`/`sync`, conflict = `git-merge` / `merge_type`.

## 3. Layout (admin-web)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ▣ Howlader Field   [Branch: All ▾]   [⌘K Search customers, staff, receipts…]  🔔3 (ERP ● 2m) 👤 │  ← header 56 px
├────────────┬─────────────────────────────────────────────────────────────────────┤
│ Overview   │  [Customers | Map | Pins 6 | Areas …]   ← section tab strip                 │
│ Inbox  12  │  Page title                                   [secondary] [Primary]   │
│ ───────── │  Breadcrumb · "as of 10:42"                                            │
│ Customers 6│ ┌────────── KPI ──────────┬──────────┬──────────┬──────────┐           │
│ Collections│ │ Collected today ৳4,82,500│ Visits 312│ Present 27/30│ Conflicts 3│           │
│ Field work │ └──────────────────────────┴──────────┴──────────┴──────────┘           │
│ Staff    4 │ ┌ Filters bar: [Date ▾][Staff ▾][Status chips…]  Saved views ▾  ⚙ cols ┐ │
│ ───────── │ │ Table (sticky header, 13 px, 44 px rows, zebra off, hover neutral.100) │ │
│ Reports    │ │ …                                                                     │ │
│ ───────── │ └───────────────────────────────────────────────── pagination ───────┘ │
│ Admin      │                                                     ┌─ Drawer 480 px ─┐ │
│            │                                                     │ row detail       │ │
│            │                                                     │ tabs, actions    │ │
│            │                                                     └──────────────────┘ │
│            │                                                                        │
│            │                                                                        │
│            │                                                                        │
│            │                                                                        │
│            │                                                                        │
│            │                                                                        │
└────────────┴─────────────────────────────────────────────────────────────────────┘
 sidebar 248 px (collapsible to 64 px icon rail)
```
- Content max width 1600 px; page padding 24 px (desktop), 16 px (tablet/mobile).
- Grid: 12 columns, 24 px gutter (desktop), 16 px (≤ md).
- Header shows **ERP freshness dot** (green < 15 min, amber < 60, red otherwise) — click → ERP status panel.
- Branch switcher is global; persists in URL (`?branch=`) and localStorage; managers with one branch see a static label.

### Navigation: sections with tabs (FR-W-069, ADR-W28)
The sidebar has **8 items**; related pages are tabs of one section. The list lives in `src/app/navigation.ts` (the only place to regroup).

| Sidebar item | Tabs (each its own route) |
|---|---|
| Overview | — (`/`) |
| Inbox | Inbox `/inbox` · Requests `/requests` · Staff activity `/activity` · Notices `/notices` |
| Customers | Customers `/customers` · Customer map `/map` · Pin approvals `/pin-approvals` · Possible customers `/prospects` · Areas & assignments `/areas` · Data quality `/data-quality` |
| Collections | Collections `/collections` · Conflicts `/collections/conflicts` · Cash on hand `/cash` · Handovers `/handovers` |
| Field work | Visits `/visits` · Co-work `/cowork` · Promises `/promises` · Tasks `/tasks` · Places `/places` |
| Staff | Staff `/staff` · Attendance `/attendance` · Leave requests `/attendance/leave` · Live map `/live` · Route history `/routes` · Leaderboard `/leaderboard` · Targets `/targets` |
| Reports | — (`/reports`, with its own Reports / Reconciliation / Downloads tabs) |
| Admin | Users `/admin/users` · Devices `/admin/devices` · Permissions `/admin/permissions` · Settings `/admin/settings` · Holidays & shifts `/attendance/calendar` · Feature flags `/admin/flags` · Audit log `/admin/audit` · Photo storage `/admin/photos` · System health `/admin/system` |

- Groups (top · field · insights · admin) are separated by a rule; no headings.
- A tab shows only with its module flag on and its permission held; a section without visible tabs is hidden; the sidebar item opens the first visible tab, with the filters it was left with.
- The **section tab strip** (`SectionTabs`, shell) sits above the page header on a tab page, not on pages below a tab (customer detail, place move requests: there only the sidebar item is highlighted). Underline tabs, `text.sm`, icon + label + count badge; active = `primary` text and a 2 px `primary` underline; ≥ 44 px on touch; scrolls sideways under `lg` with a fade at the end edge; tab text lines up with the page content edge; hidden on paper. It is a `nav` ("Customers pages") with `aria-current="page"`, not a tablist.
- Section badge = sum of the tabs in `badgeFrom` (actionable queues only).
- Every old URL is still a page; a new page goes into a section in `navigation.ts` (until then it shows as its own sidebar item).

## 4. Page inventory (each with default sort and primary action)

| Page | Route | Primary content | Default sort | Primary action |
|---|---|---|---|---|
| Overview | `/` | KPIs (collected vs target, visits, attendance, cash on hand, conflicts, overdue), 7-day trend, staff leaderboard table, inbox preview, ERP status | — | — |
| Inbox | `/inbox` | Grouped by severity; each item one-line summary + action buttons inline (Resolve conflict, Approve pin…) | severity, age | Resolve |
| Customers | `/customers` | Table: name/code, phone, area, assignee, outstanding, days overdue, next due, badges, last visit, open promise | daysOverdue desc | Assign |
| Customer detail | `/customers/[id]` | Header (name bn/en, code, phone, address, status badges, tag control); tabs: Overview (plans cards + schedule table), Payments (ERP + field, distinguished), Timeline, Notes, Visits (photos grid), Promises, Location (pin, proposals), Tag history | — | Tag / Assign |
| Map | `/map` | Full-bleed Leaflet map, left panel filters + list synced with viewport, pin popups | — | Draw area → Assign |
| Collections | `/collections` | Table with totals bar by method; status chips; flags column | recordedAt desc | Export |
| Conflicts | `/collections/conflicts` | Card list with ERP response, customer context, resolution form | age | Resolve |
| Cash & deposits | `/cash` | Positions table (on-hand bar vs limit, oldest cash age), deposits list (final, read-only from 1.35.0) whose drawer shows each collection with its ERP state | over-limit first | — |
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
| Places | `/places` | Map of labelled pins above a table of places (name, kind, state, added by); Places move requests `/places/move-requests` as cards with a small map (current, requested, dashed line) | newest / oldest request | New place · Approve move |
| Audit log | `/admin/audit` | Filterable table + diff viewer drawer; shared date filter (Dhaka dates) | at desc | Export |
| Requests | `/requests` | Queue tabs with counts (my queue, area manager, super admin, assigned to me, all), filters, drawer with the full timeline, comments and forward / assign / resolve / reopen / close | createdAt desc | New request |
| System health | `/admin/system` | ERP status, outbox, jobs, sync health per device, app versions in field | — | Retry |

## 5. Components and rules

### 5.1 Tables (TanStack Table)
- Row height 44 px (comfortable) / 36 px (compact toggle); cell padding 12 px horizontal.
- Sticky header (bg `neutral.50`, 12 px uppercase-free semibold label — do **not** uppercase Bangla), sticky first column on horizontal scroll.
- Numbers and money right-aligned, tabular; dates left-aligned relative ("৩ দিন আগে") with absolute on hover.
- Status column: badge (icon + label). Max 2 badges + "+N".
- Row click opens **drawer** (keeps list context); ⌘/Ctrl-click opens full page in new tab.
- Selection checkboxes → bulk action bar slides up from bottom (Assign, Export, Tag).
- Server-side pagination (cursor) with page sizes 25/50/100; infinite scroll **not** used for admin tables (users need stable positions). When the total is known the pager is numbered (`PagerBar`: first, previous, pages with gaps `1 … 4 5 6 … 20`, next, last, "Showing 101–200 of 2,430", current page `aria-current="page"`, 36 px buttons, 44 px on touch; below 640 px "Page 3 of 20" with the arrows). The customers list uses 100 / 500 / 1000 (FR-W-060); card lists (pin approvals) use the same bar under the grid.
- **Date filter (FR-W-063):** every list that filters by day uses `DateRangeFilter`: one 36 px button with a calendar icon, the preset name and the days ("Last 7 days · 17 Nov – 23 Nov"); the panel lists the presets (each with its days) and a custom range (two date fields, the number of days, Apply). Place it first in the filter row; on phones it takes the full width. Staff filters use `StaffSelect` ("All staff").
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
- Bulk deletes (photo purge, FR-W-054): `ConfirmTypeDialog` with `exact` and a text that names the scope (`DELETE 2026-11`); long runs show a progress bar inside the dialog and the dialog cannot be closed while it runs.
- Validation with zod schemas generated from OpenAPI where possible.

### 5.3 Buttons
Primary (brand.600 bg, white), Secondary (white bg, neutral.300 border), Ghost, Destructive (danger), Link. Sizes: sm 32, md 40, lg 44. One primary per view region. Icon-only buttons have tooltip + aria-label.

### 5.4 Badges & chips
Badge height 22, radius 4, 12 px medium, icon 14 px. Returned marker (`<ReturnedMark>`, FR-W-074): a `status.returned` (v1.4) StatusBadge with its own icon — `returned_count` "Returned ×N" (Undo2), `only_returned` "Returned product customer" (PackageX), `returned` chip on a returned invoice, `returned_payment` "Returned invoice" tag on a payment; returned invoices are listed apart and never counted. Filter chips height 32, radius full; selected = brand.50 bg + brand.700 text + check icon. Bad-tag chip (`<TagChip>`, FR-W-072): badge size, kind fg on kind bg with a 1 px fg hairline, the kind's icon; absconded is filled (bg on fg). A row that needs a frame passes `rowBorderClass` to `DataTable`, which draws it around the row (inset shadows on the cells) and around the card below 640 px.

### 5.5 KPI cards
Label (13 px secondary) · value (30 px semibold tabular) · delta vs yesterday/last month (▲ success / ▼ danger with text "+12%") · sparkline (7 days) · click → filtered list. "as of" timestamp in footer.

### 5.6 Drawer
480 px (desktop), full-screen (mobile). Header: title, status, close (Esc). Body: padded by the drawer itself, `space.20` on both sides like the header and footer (FR-W-067) — never add your own outer padding; `flush` only for edge-to-edge content. Footer: actions. Tabs inside if > 1 section. URL reflects open drawer (`?drawer=customer:6740…`) so it can be shared.

### 5.7 Maps (react-leaflet)
- Tile layer from `TileProvider` config (`/meta/app-config`); attribution always visible bottom-right.
- Custom SVG pins 28 px with glyph; selected pin 36 px with halo.
- A pin may carry a corner mark (`PinLook.corner`, top right, r 4.6 of the 28×40 box, `status.returned` fg fill + `--neutral-0` ring and arrow): used for customers with returned invoices (FR-W-074). The pin's colour and glyph keep saying the pay state.
- Clustering (`leaflet.markercluster` or supercluster) below zoom 14.
- Legend toggleable; layer switcher (customers / staff / areas / routes).
- Route polyline 4 px brand.600, gaps dashed neutral.400, stops as numbered circles; scrubber syncs a moving marker.
- Map + list split view: list updates with viewport ("Showing 46 customers in view").
- Every map hosts the `widgets.mapLayers` layers through `useMapLayers` (`shared/feature/map-layers.tsx`): map places on the customer map, live map, route history and pin approval cards (click opens the place drawer), and under the pin of every `MapPicker` (shown only; a click still moves the pin there).
- With nothing better to fit (no saved view, no branch point, no markers), every map opens on `DEFAULT_VIEW`: Galachipa upazila, Patuakhali (22.164, 90.426), zoom 12 (`shared/map/geo.ts`).
- Picking a point (`MapPicker`): the pin is fixed in the middle (primary fill, lifts 8 px while the map moves, its shadow dot stays on the point) and the map moves under it; a click pans to the clicked spot; the current point is drawn as a hollow `--fg-secondary` circle for comparison. Always show the picked coordinates as text (`font-mono`, 5 decimals, `aria-live`) and offer a paste field next to the map. Height `44dvh` on phones, 360 px from `sm`.

### 5.8 Charts (Recharts)
- Dashboard (FR-W-064): stacked bars for money by method per day (`StackedBars`, 2 px surface gap, rounded top), two lines on one axis for this month vs last month (`LineCompare`, last month dashed `--fg-tertiary`), plain HTML bars for shares (pay states, visit outcomes, methods, branches) with the colour dot, label and value as text; payment methods keep their §2.4 colours, visit outcomes a fixed categorical order. Animation off on bars (layout changes must not replay it). Every number is a link; the period section has its own date filter.
- Gridlines `neutral.200` dashed horizontal only; axis labels 12 px secondary; currency axis in lakh format (৳১.২ লাখ).
- Tooltip shows exact values and date in Bangla/English per locale.
- Every chart has a "view as table" toggle (accessibility + export).

### 5.8a Print and PDF (FR-REP-003)
- Report pages (Reports trends and reconciliation, Staff, Attendance) carry a secondary **PDF / Print** button in the page header; the browser's "Save as PDF" makes the file, so Bangla conjuncts are shaped and Noto Sans Bengali is embedded.
- On paper: A4, light theme always, no sidebar, header, toolbars, pagers, drawers or toasts; a masthead with organisation, branch, print time and who printed; every table column is printed (priority classes are ignored); table headers repeat on each page and rows are never split.
- Controls turn into text: a `Segmented` prints "label: chosen option"; date pickers and arrows are hidden and a `PrintOnly` line states the date or period.
- Charts print as their data table (charts sized for the screen do not re-layout for the page).

### 5.9 Toasts & banners
Toast bottom-right, 4 s, max 3; success/info only. Errors that need action are banners or inline, never toasts.

### 5.10 Empty, loading, error, offline
- Admin offline (navigator.onLine false): top banner "You are offline — showing last loaded data" and disable mutations.
- Feature disabled: page shows "This module is turned off for this branch" with link to flags (SA only).

## 6. Responsive rules
| Breakpoint | Width | Layout |
|---|---|---|
| `xs` | < 640 | Sidebar → bottom sheet nav via hamburger; tables → **card lists** (title = name, 3 key fields, badges, chevron; the card is a plain container that opens on tap, the chevron is its one open button named by the title, focus ring around the card — never a `role=button` card, cells may hold links); drawers full screen; KPI cards 2 per row; maps full-screen with bottom sheet list |
| `sm` | ≥ 640 | Same as xs, KPI 2 per row, filters in a sheet |
| `md` | ≥ 768 | Icon-rail sidebar (64 px); tables with priority columns only (hide by `meta.priority` 3+) |
| `lg` | ≥ 1024 | Full sidebar; drawers side panel |
| `xl` | ≥ 1280 | Default desktop |
| `2xl` | ≥ 1536 | Split views (list + map, list + detail) |
- Each table column declares `priority` 1–5; columns with priority > n are hidden at each breakpoint and accessible via row expansion.
- Touch targets ≥ 44 px on coarse pointers.
- Manager phone-browser critical tasks (must be excellent at 360 px): Inbox, resolve conflict, read a deposit, approve handover/device/pin, live map, staff today.

## 7. Accessibility
WCAG 2.2 AA: contrast per tokens; keyboard: every action reachable, visible focus, `/` focuses search, `⌘K` command palette, `g i` inbox, `g c` customers; Radix provides ARIA patterns; tables use proper `<th scope>`; charts have table alternative; `lang="bn"` set on Bangla content for screen readers and font shaping; never rely on hover only (touch).

## 8. Localization
- `next-intl` is not used (no SSR); use **i18next + react-i18next** with namespaces per feature (`customers.json`), English default (owner decision 2026-11-22), Bangla toggle per user (stored in the browser; a saved choice is kept).
- ICU plurals; Bangla digits toggle (user setting) applied by `formatNumber`/`formatMoney`/`formatDate` from `src/shared/lib/format.ts`; never `toLocaleString` ad hoc.
- Dates: Bangla month names; calendar weeks start Saturday (BD convention) — confirm OD-W02.

## 9. Dark mode
Supported (system default + toggle). Surfaces: bg `#0B0E14`, surface `#121722`, raised `#1A2030`, border `#262E3F`; text primary `#E7EAF0`, secondary `#A9B1BF`; primary `brand.400`. Status colours use the dark column of §2.3. Maps use a dark tile style if provider offers one, else normal tiles with 85 % brightness filter.
