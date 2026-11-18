# CLAUDE.md — admin-web

Rules for AI coding agents. Read fully before changing anything.

## 1. What this repo is
The admin panel of the Howlader Elecronics Field Operations System for super admins, branch managers and viewers. Next.js 15 + TypeScript, **static export, client-side rendering only** (no SSR, no API routes, no server actions, no middleware). Talks **only** to field-api `/api/v1`.

Read first: `docs/01-system-analysis.md`, `docs/02-requirements.md`, `docs/03-design-guide.md` (tokens + layout rules), `docs/04-architecture.md`, then field-api's `docs/02-requirements.md` (master catalog) and `docs/openapi.yaml`.

## 2. Hard boundaries
1. Never call Laravel or any service except field-api, the map tile provider and presigned storage URLs.
2. Never hand-write API types. Run `pnpm gen:api` from the pinned field-api `openapi.yaml`; record the version in `docs/CHANGELOG.md`. If you need an endpoint that does not exist, stop: it must be added to field-api's contract first.
3. Features live in `src/features/<name>/`; import other features only through their `index.ts`, prefer extension points (dashboard widgets, customer tabs, ⌘K commands). `src/app/features.ts` is the only feature list. Boundary lint must stay strict.
4. Permission keys used in UI must exist in the master catalog (`pnpm check:permissions`). UI hides/disables by permission, but never assumes the server will allow — handle 403.
5. Every feature has a flag (from field-api) and is hidden when OFF.
6. **Money:** display only; amounts are poisha integers formatted by `shared/lib/format.ts`. Never sum ERP and pending field money into one number without labelling. Money actions are not optimistic.
7. **Tokens:** use design tokens (CSS variables / Tailwind theme) only — no raw hex colours, no ad-hoc spacing. Token changes must also be applied to `staff-app/docs/03-design-guide.md §2` (shared tokens v1.x).
8. **Security:** access token in memory only; never write tokens or customer PII to localStorage/sessionStorage/IndexedDB; no `dangerouslySetInnerHTML`; respect CSP (no inline scripts, no new external hosts without updating CSP docs).
9. **i18n:** no user-visible string literals in components; add keys to both `bn.json` and `en.json` (`pnpm check:i18n`). Bangla is the default.
10. Microfinance: reserved — do not build.

## 3. UI rules (summary of 03-design-guide)
- Status = colour + icon + label. Use `<StatusBadge status=…>`.
- Lists: `DataTable` with server pagination, URL state, skeleton loading, empty state, error banner with requestId.
- Row → `Drawer`; destructive/money → confirm dialog naming amount and customer; reasons → `ReasonDialog`.
- Every KPI links to its list. Every ERP-derived number shows "as of".
- Responsive: verify each page at 390 px and 1440 px; columns declare `priority`; card list below 640 px; touch targets ≥ 44 px.
- Accessibility: keyboard reachable, visible focus, `lang="bn"` on Bangla content, axe clean.

## 4. Workflow for every change
1. Find/add FR-ID (master catalog for shared behaviour, `docs/02-requirements.md` FR-W for web-only).
2. Update types (`pnpm gen:api`) if contract changed.
3. Build inside the owning feature; add tests (unit for mappers/format, component for UI logic, Playwright for journeys, axe).
4. **Update docs with every change:** `docs/CHANGELOG.md` always; `docs/09-progress.md` status; `docs/08-decisions.md` if a decision was made; design guide if a pattern/token changed.
5. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e -- --trace off && pnpm check:permissions && pnpm check:i18n` before finishing.

## 5. Feature-add checklist
- [ ] `pnpm new:feature <name>` (copies template), folder = manifest `name`.
- [ ] Manifest: `flag` (field-api key), routes (title i18n key, permission, nav group, icon), permissions, events, commands, widgets/tabs.
- [ ] Register in `src/app/features.ts`; add thin route files under `src/app/(shell)/…`.
- [ ] API hooks in `api/` with query keys `[feature, resource, params]`; invalidate via UI events, not by importing other features' hooks.
- [ ] i18n `bn.json` + `en.json`.
- [ ] Tests: unit (model), component, e2e journey, axe; mobile viewport.
- [ ] Docs: FR status, CHANGELOG, progress.
- [ ] No other feature's internals edited.

## 6. Testing rules
- MSW handlers from OpenAPI examples for component/E2E-mock runs; staging E2E uses mock-erp behind field-api.
- Freeze time to Asia/Dhaka in tests that show dates.
- Never skip or weaken tests to pass CI.
