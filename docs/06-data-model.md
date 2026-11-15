# 06 — Data Model (admin-web, client side)

admin-web stores **no business data** persistently. Server data lives in field-api (`field-api/docs/06-data-model.md`). This file defines client-side state and the view models used by screens.

## 1. Types
- All API types come from `src/shared/api/schema.d.ts`, generated from `field-api/docs/openapi.yaml` (pinned version recorded in `docs/CHANGELOG.md`). Never hand-write API response types.
- View models (`features/*/model/`) map API types to display-ready objects (formatted money, localized names, badge descriptors). Mapping functions are pure and unit-tested.

```ts
// features/customers/model/customer-row.ts
export interface CustomerRowVM {
  id: string; code: string; name: string;          // localized
  phone: string; areaName: string; assigneeName: string | null;
  outstanding: MoneyVM;                            // { poisha, text: '৳৮,৫০০' }
  daysOverdue: number | null;
  nextDue: DateVM | null;
  badges: BadgeVM[];                               // { tone: 'overdue', icon, label }
  lastVisit: RelativeTimeVM | null;
  openPromise: { date: DateVM; amount: MoneyVM } | null;
  pendingField: MoneyVM | null;                    // field collections not yet in ERP
  asOf: DateTimeVM;
}
```

## 2. Client state

| State | Where | Lifetime | Notes |
|---|---|---|---|
| Access token | memory (auth store) | until reload/expiry | never in storage |
| Refresh token | HttpOnly cookie set by API | 12 h idle / 7 d absolute | JS cannot read |
| Current user, permissions, flags | TanStack Query (`['me']`) | session | refetched on focus and every 5 min |
| Server lists/details | TanStack Query cache | in-memory, gc 10 min | no persistence (sensitive data) |
| Selected branch | Zustand + URL + localStorage `fos.branch` | persistent | validated against `me.branchIds` |
| Table prefs | localStorage `fos.table.<tableId>` `{ columns, order, density, pageSize }` | persistent | versioned key; reset on schema change |
| Theme, language, digits | localStorage `fos.ui` + user profile (server) | persistent | server value wins on login |
| Draft reasons/forms | memory | until closed | — |
| Idempotency keys for open dialogs | memory (per dialog instance) | until success/close | reused on retry |

Nothing containing customer PII is written to localStorage, sessionStorage or IndexedDB.

## 3. Query key catalog (excerpt)
| Key | Endpoint | staleTime |
|---|---|---|
| `['me']` | `GET /auth/me` | 5 min |
| `['branches']` | `GET /branches` | 1 h |
| `['rbac','catalog']` | `GET /rbac/permissions` | 1 h |
| `['dashboard', branch, date]` | `GET /dashboard/overview` | 60 s |
| `['inbox','count', branch]` | `GET /inbox?limit=1` (counts) | 0, poll 60 s |
| `['customers','list', params]` | `GET /customers` | 30 s |
| `['customers','detail', id]` | `GET /customers/{id}` | 30 s |
| `['customers','map', bbox, filter]` | `GET /customers/map` | 60 s |
| `['collections','list', params]` | `GET /collections` | 30 s |
| `['cash','positions', branch]` | `GET /cash/positions` | 30 s |
| `['location','latest', branch]` | `GET /location/latest` | 0, poll 60 s when visible |
| `['location','history', user, date]` | `GET /location/history` | 5 min (past days: Infinity) |

## 4. URL state schema
`/customers?branch=6731…&filter=overdue,bad_suggested&assignee=6734…&sort=-daysOverdue&cursor=…&drawer=customer:6740…`
Parsed/serialized by `shared/lib/url-state.ts` with zod; invalid params are dropped silently.
