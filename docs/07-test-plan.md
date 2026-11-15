# 07 — Test Plan (admin-web)

System-level journeys J-1…J-12 and the FR traceability matrix are in `field-api/docs/07-test-plan.md`. This file covers admin-web's own tests.

## 1. Levels
| Level | Tool | What | Gate |
|---|---|---|---|
| Unit | Vitest | `shared/lib/format` (money, Bangla digits, lakh grouping, Dhaka dates), view-model mappers, url-state, permission helpers, refresh single-flight | 90 % on `shared/lib` and `model/` |
| Component | Vitest + Testing Library + MSW | DataTable (sort/filter/pagination/selection), ReasonDialog, StatusBadge, MoneyText, PermissionsMatrix, KpiCard, Drawer focus management | each shared component has tests |
| Contract | `tsc` against generated `schema.d.ts`; MSW handlers built from openapi examples | contract drift = compile error | CI |
| E2E | Playwright against (a) MSW-backed build and (b) staging stack with mock-erp | journeys below, desktop 1440×900 and mobile 390×844 (Pixel 7 / iPhone 13 profiles) | green before release |
| Accessibility | `@axe-core/playwright` on every page, keyboard-only run of top 5 flows | 0 serious/critical violations | CI |
| Visual | Playwright screenshots of key pages in bn/en × light/dark | reviewed diff | PR |
| Performance | Lighthouse CI (mobile) on Overview, Customers, Map | LCP < 2.5 s, TBT < 300 ms, JS budget | CI |
| Security | CSP header check, no tokens in storage (test asserts `localStorage` has no `token`), dependency audit | — | CI |

## 2. E2E journeys (web)
| ID | Journey |
|---|---|
| W-E1 | Login → forced password change → overview loads with branch switcher (SA) / fixed branch (BM) |
| W-E2 | Silent refresh: access token expires during a table session → request retried transparently |
| W-E3 | Customers: filter overdue + bad_suggested, sort, open drawer, deep link copy-paste opens same state |
| W-E4 | Tag customer with reason; history shows previous value; viewer role cannot see Tag button |
| W-E5 | Resolve conflict (post_to_plan), double-click on submit does not create two resolutions (same idempotency key) |
| W-E6 | Verify and reject deposits; positions update |
| W-E7 | Create handover from map selection; summary shows cash-on-hand warning |
| W-E8 | Permissions: deny `tag.set` for one user with reason; effective view shows source "user"; audit shows diff |
| W-E9 | Feature flag OFF for branch → nav item hidden, direct URL shows module-off page |
| W-E10 | Live map polling stops when tab hidden (mock Page Visibility) |
| W-E11 | Route history: stops list ↔ map highlight; scrubber |
| W-E12 | Export monthly staff performance (bn) → file downloaded, opens |
| W-E13 | Mobile 390 px: inbox → resolve conflict → verify deposit → approve device, all with ≥ 44 px targets |
| W-E14 | Bangla/English toggle, Bangla digits toggle, dark mode persist across reload |

## 3. Manual checklist (per release)
- [ ] Bangla rendering: conjuncts (ক্ষ, ঙ্গ, ন্ত্র), reph, ya-phala correct in Chrome/Firefox/Safari.
- [ ] Long Bangla names do not break table layout (ellipsis + tooltip).
- [ ] Money totals match backend totals on Collections page for a sample day.
- [ ] Print view of a day sheet.
- [ ] Maps: tiles attribution visible; provider switch via config works without rebuild.
- [ ] Session timeout warning appears at 28 min idle.

## 4. Contrast pairs verified (tokens v1.0)
`neutral.900/0` 17.4 · `neutral.600/0` 7.4 · `neutral.500/0` 4.65 · `brand.600/0` 7.5 · `status.overdue` 4.9 · `status.dueToday` 6.4 · `status.promised` 6.1 · `status.paid` 6.4 · `status.current` 6.7 · `status.pending` 6.7 · `status.badSuggested` 4.7 · `status.mock` 6.7 · `info` 5.3 · `danger` 5.7 · white on `status.tagged` 10.0 · dark: text 16.0, secondary 8.3, brand.400 6.3, overdue 6.3, dueToday 9.3, promised 6.3, paid 8.8, pending 7.5. Re-verify with the contrast script (`scripts/check-contrast.ts`) on any token change.
