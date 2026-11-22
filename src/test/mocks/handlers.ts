/**
 * MSW handlers implementing the field-api contract (openapi.yaml) against the in-memory mock db.
 * Behaviour mirrors the documented conventions: problem+json errors, cursor pagination, scope by branch,
 * Idempotency-Key replay on money actions, audit on every privileged change.
 */
import { http, HttpResponse, delay } from 'msw';
import { DateTime } from 'luxon';
import type { components } from '@/shared/api/schema';
import * as db from './db';

type S = components['schemas'];
const BASE = '/api/v1';
const SESSION_KEY = 'fos.mock.session'; // mock-only stand-in for the HttpOnly refresh cookie (holds a user id, never a token)

declare global {
  interface Window {
    __FOS_MOCK_TTL_SEC?: number;
    __FOS_MOCK_LATENCY?: number;
  }
}

const rid = () => `req_${Math.random().toString(36).slice(2, 10)}`;
function problem(status: number, code: string, title: string, detail?: string, details?: Record<string, unknown>) {
  return HttpResponse.json({ type: `https://errors.fos/${code}`, status, code, title, detail, requestId: rid(), details }, { status, headers: { 'Content-Type': 'application/problem+json' } });
}
async function lag() {
  const l = typeof window !== 'undefined' ? window.__FOS_MOCK_LATENCY : undefined;
  await delay(l ?? 120 + Math.random() * 260);
}

// ---------- auth ----------
const tokens = new Map<string, { userId: string; exp: number }>();
function issue(u: db.MockUser): S['LoginResponse'] {
  const ttl = (typeof window !== 'undefined' && window.__FOS_MOCK_TTL_SEC) || 15 * 60;
  const token = `mock.${crypto.randomUUID()}`;
  const exp = Date.now() + ttl * 1000;
  tokens.set(token, { userId: u.id!, exp });
  try {
    sessionStorage.setItem(SESSION_KEY, u.id!);
  } catch {
    /* ignore */
  }
  const { password: _pw, ...user } = u;
  return {
    accessToken: token, accessTokenExpiresAt: new Date(exp).toISOString(), user,
    permissions: db.effective(u).filter((p) => p.allowed).map((p) => p.key), flags: flagsFor(u), serverTime: new Date().toISOString(),
  };
}
function flagsFor(u: db.MockUser): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of db.flags) {
    const ov = f.branchOverrides?.find((o) => u.branchIds?.includes(o.branchId!) && u.role !== 'super_admin');
    out[f.key!] = ov ? !!ov.enabled : !!f.defaultEnabled;
  }
  return out;
}
type Ctx = { user: db.MockUser };
function auth(request: Request): Ctx | Response {
  const h = request.headers.get('Authorization') ?? '';
  const t = tokens.get(h.replace(/^Bearer /, ''));
  if (!t) return problem(401, 'UNAUTHENTICATED', 'Sign in required');
  if (t.exp < Date.now()) return problem(401, 'TOKEN_EXPIRED', 'Access token expired');
  const user = db.userById(t.userId)!;
  return { user };
}
function perms(u: db.MockUser) {
  return new Set(db.effective(u).filter((p) => p.allowed).map((p) => p.key));
}
function need(ctx: Ctx, key: string): Response | null {
  return perms(ctx.user).has(key) ? null : problem(403, 'FORBIDDEN', 'You do not have permission for this action', key);
}
/** branch scope: SA/viewer = all (or the requested branch); BM = own branches ∩ requested */
function scope(ctx: Ctx, url: URL): string[] {
  const req = url.searchParams.get('branchId');
  const mine = ctx.user.role === 'super_admin' || ctx.user.role === 'viewer' ? db.branches.map((b) => b.id!) : (ctx.user.branchIds ?? []);
  return req ? mine.filter((b) => b === req) : mine;
}
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Staff performance rows for a day, or for the month of `date` up to `date` (contract 1.10.0: targets summed over the working days,
 * to date and for the whole period, with achievement against the target to date).
 */
function perfRows(sc: string[], monthly: boolean, date: string): S['StaffPerformanceRow'][] {
  const today = db.today();
  const from = monthly ? `${date.slice(0, 7)}-01` : date;
  const periodEnd = monthly ? new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10) : date;
  const day = (iso: string) => new Date(Date.parse(iso) + 6 * 3600_000).toISOString().slice(0, 10);
  const dates: string[] = [];
  for (let d = from; d <= date; d = nextDay(d)) dates.push(d);
  const allDates: string[] = [];
  for (let d = from; d <= periodEnd; d = nextDay(d)) allDates.push(d);
  const w = Math.min(1, Math.max(0, Number(db.settings['cowork.visitCredit'] ?? 1)));
  return db.staff.filter((s) => s.active && sc.includes(s.branchIds?.[0] ?? '')).map((s) => {
    const mine = db.collections.filter((c) => c.collector?.id === s.id && c.status !== 'voided' && day(c.recordedAt!) >= from && day(c.recordedAt!) <= date);
    const byMethod: Record<string, number> = {};
    mine.forEach((c) => (byMethod[c.method!] = (byMethod[c.method!] ?? 0) + c.amountPoisha!));
    const total = mine.reduce((a, c) => a + c.amountPoisha!, 0);
    const vis = db.visits.filter((v) => v.row.userId === s.id && day(v.row.checkInAt) >= from && day(v.row.checkInAt) <= date);
    // FR-CW-005: joint visits credit every participant, weighted by cowork.visitCredit; money is never shared
    const soloVisits = vis.filter((v) => !v.row.coWork).length;
    const coWorkVisits = db.visits.filter((v) => v.row.coWork && (v.row.userId === s.id || v.row.coWork.participantIds?.includes(s.id!)) && day(v.row.checkInAt) >= from && day(v.row.checkInAt) <= date).length;
    const visitCredit = round2(soloVisits + coWorkVisits * w);
    const prom = db.promises.filter((p) => p.row.ownerId === s.id && p.row.promisedDate >= from && p.row.promisedDate <= date);
    const kept = prom.filter((p) => p.row.status === 'kept' || p.row.status === 'partially_kept').length;
    const att = dates.map((d) => db.attendanceDay(s, d));
    const worked = att.filter((a) => a.firstIn);
    // FR-COL-015: the target in force on each working day of the period
    const goals = allDates.map((d) => ({ d, t: db.staffTarget(s, d) }));
    const sumOf = (rows: typeof goals, k: 'amountPoisha' | 'visits') => rows.reduce((a, g) => a + (g.t[k] ?? 0), 0);
    const toDate = goals.filter((g) => g.d <= (date < today ? date : today));
    const targetToDatePoisha = sumOf(toDate, 'amountPoisha');
    const visitTargetToDate = round2(sumOf(toDate, 'visits'));
    return {
      userId: s.id, name: s.name?.en, period: monthly ? date.slice(0, 7) : date, visits: vis.length, uniqueCustomers: new Set(vis.map((v) => v.row.customerId)).size,
      soloVisits, coWorkVisits, visitCredit,
      collectionsCount: mine.length, collectedPoisha: { total, ...byMethod }, promisesDue: prom.length, promisesKept: kept,
      targetPoisha: sumOf(goals, 'amountPoisha'), visitTarget: round2(sumOf(goals, 'visits')), targetToDatePoisha, visitTargetToDate,
      amountAchievement: targetToDatePoisha ? round2(total / targetToDatePoisha) : null, visitAchievement: visitTargetToDate ? round2(visitCredit / visitTargetToDate) : null,
      targetDays: goals.filter((g) => (g.t.amountPoisha ?? 0) > 0 || (g.t.visits ?? 0) > 0).length,
      promiseFulfilmentRate: prom.length ? kept / prom.length : undefined, presentDays: worked.length, lateDays: att.filter((a) => (a.lateMin ?? 0) > 0).length,
      lateMin: att.reduce((a, d) => a + (d.lateMin ?? 0), 0), breakMin: att.reduce((a, d) => a + (d.breakMin ?? 0), 0),
      fieldMin: Math.round(att.reduce((a, d) => a + (d.dutyMin ?? 0), 0) * 0.72), distanceKm: Math.round(worked.length * 21.5 * 10) / 10,
    };
  });
}

/** Manager views of a co-work session carry how many joint visits it produced. */
function withVisitsCount(s: S['CoworkSession']): S['CoworkSession'] {
  return { ...s, visitsCount: db.visits.filter((v) => v.row.coWork?.sessionId === s.id).length };
}

function page<T>(all: T[], url: URL, def = 25) {
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? def) || def);
  const cur = url.searchParams.get('cursor');
  const off = cur ? Number(atob(cur).replace('o:', '')) || 0 : 0;
  const items = all.slice(off, off + limit);
  return { items, nextCursor: off + limit < all.length ? btoa(`o:${off + limit}`) : null, total: all.length };
}
type Handler = (a: { request: Request; params: Record<string, string>; ctx: Ctx; url: URL }) => Response | Promise<Response>;
const authed = (fn: Handler) => async ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
  await lag();
  const c = auth(request);
  if (c instanceof Response) return c;
  const res = await fn({ request, params: params as Record<string, string>, ctx: c, url: new URL(request.url) });
  // Plain-string person names (e.g. assignee.name) follow Accept-Language, as field-api is expected to do.
  if (request.headers.get('Accept-Language') === 'bn' && res.headers.get('Content-Type')?.includes('application/json')) {
    const text = await res.text();
    return new HttpResponse(text.replace(nameRe(), (_m, key: string, val: string) => `${key}${bnNames.get(val) ?? val}`), { status: res.status, headers: res.headers });
  }
  return res;
};
const bnNames = new Map<string, string>();
let _re: RegExp | null = null;
function nameRe() {
  if (!_re) {
    for (const u of db.users) if (u.name?.en && u.name.bn) bnNames.set(`"${u.name.en}"`, `"${u.name.bn}"`);
    const alts = [...bnNames.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    _re = new RegExp(`("(?:name|userName)":)(${alts})`, 'g');
  }
  return _re;
}
const actor = (u: db.MockUser) => ({ id: u.id, name: u.name?.en, role: u.role });
/** A notice as one viewer sees it: counts for the sender, read state for a recipient. */
function broadcastView(b: db.MockBroadcast, viewer: db.MockUser): S['Broadcast'] {
  const at = b.acks.get(viewer.id!);
  return { ...b.row, recipientCount: b.recipientIds.length, ackCount: b.acks.size, acked: !!at, ...(at ? { ackedAt: at } : {}) };
}

const idem = new Map<string, S["Collection"]>();
let lastErpSyncAt: string | null = null;
let erpSyncCalls = 0;

const custBranchOk = (ctx: Ctx, c: db.MockCustomer) => scope(ctx, new URL('http://x/')).includes(c.branchId);

function recomputeCustomer(c: db.MockCustomer) {
  c.detail.assignee = c.item.assignee;
  c.detail.location = c.item.location;
  c.detail.pendingFieldPoisha = c.item.pendingFieldPoisha;
  c.detail.tag = c.item.tag;
  c.detail.badges = c.item.badges;
  db.deriveCustomer(c);
}
const PAY_ORDER = ['bad', 'missed_many', 'missed_one', 'due_today', 'on_track', 'paid_off'] as const;
/** 1.14.0 filters shared by the list and the map: pin colours (OR), an open invoice of a kind; 1.28.0: paid this month */
function payFilter(url: URL) {
  const pay = (url.searchParams.get('payState') ?? '').split(',').filter(Boolean);
  const kind = url.searchParams.get('invoiceKind');
  const paidMonth = url.searchParams.get('paidThisMonth');
  return (c: db.MockCustomer) => {
    const a = mockActivity(c).activity;
    const paidSomething = (a?.paidPoisha ?? 0) > 0 || (a?.pendingPoisha ?? 0) > 0;
    return (
      (!pay.length || pay.includes(c.item.payState ?? '')) &&
      (!kind || (kind === 'credit' ? (c.item.openInvoices?.credit ?? 0) > 0 : (c.item.openInvoices?.installment ?? 0) > 0)) &&
      (!paidMonth || (paidMonth === 'yes' ? paidSomething : !paidSomething))
    );
  };
}

const uploads = new Map<string, boolean>();
/** Direct (customer) assignments made in this session; `fallback` is the area holder the customer returns to. */
const directAssignments: (S['Assignment'] & { fallback: S['CustomerListItem']['assignee'] | undefined })[] = [];
/** clientId → pin history id of a manager's map pin (idempotent replays, contract 1.11.0). */
const pinClientIds = new Map<string, { id: string; customerId: string }>();
const inBd = (lat: number, lng: number) => lat >= 20.3 && lat <= 26.8 && lng >= 87.9 && lng <= 92.8;
const exportJobs = new Map<string, { at: number; type: string; format: string }>();

/** FR-CUS-017/018 (contract 1.24.0): this month's work on a customer and its invoice count, as field-api derives them. */
function mockActivity(c: db.MockCustomer): Pick<S['CustomerListItem'], 'activity' | 'invoiceCount'> {
  const month = db.today().slice(0, 7);
  const id = c.item.id;
  const visits = db.visits.filter((v) => v.row.customer?.id === id && db.dhakaDate(v.row.checkInAt ?? '').startsWith(month));
  const lastVisitAt = visits.map((v) => v.row.checkInAt ?? '').sort().pop() ?? null;
  const paid = (c.detail.payments ?? []).filter((p) => !p.reversed && (p.date ?? '').startsWith(month));
  const pending = db.collections.filter((x) => x.customer?.id === id && ['received', 'posting', 'posting_failed', 'conflict'].includes(x.status ?? '') && db.dhakaDate(x.recordedAt ?? '').startsWith(month));
  const promises = db.promises.filter((p) => p.row.customer?.id === id);
  const due = promises.filter((p) => (p.row.promisedDate ?? '').startsWith(month));
  const plans = (c.detail.plans ?? []).filter((p) => p.status !== 'cancelled');
  return {
    activity: {
      month,
      visitCount: visits.length,
      visitedToday: visits.some((v) => db.dhakaDate(v.row.checkInAt ?? '') === db.today()),
      lastVisitAt,
      paidPoisha: paid.reduce((n, p) => n + (p.amountPoisha ?? 0), 0),
      lastPaidDate: paid.map((p) => p.date ?? '').sort().pop() ?? null,
      pendingPoisha: pending.reduce((n, x) => n + (x.amountPoisha ?? 0), 0),
      promisesMade: promises.filter((p) => db.dhakaDate(p.row.createdAt ?? '').startsWith(month) && p.row.status !== 'cancelled').length,
      promisesKept: due.filter((p) => p.row.status === 'kept' || p.row.status === 'partially_kept').length,
      promisesBroken: due.filter((p) => p.row.status === 'broken').length,
    },
    invoiceCount: { total: plans.length, open: plans.filter((p) => p.status !== 'closed' && (p.outstandingPoisha ?? 0) > 0).length },
  };
}

/** FR-CASH-007/008: one cash collection as the server lists it, with the promise it was collected against (1.30.0). */
function mockCashLine(c: S['Collection']): S['CashInHandItem'] {
  const day = db.dhakaDate(c.recordedAt ?? '');
  const match = db.promises
    .map((p) => p.row)
    .filter((p) => p.customer?.id === c.customer?.id && !['cancelled', 'superseded'].includes(p.status ?? '') && db.dhakaDate(p.createdAt ?? '') <= day && (p.promisedDate ?? '') >= db.dhakaDate(new Date(new Date(c.recordedAt!).getTime() - 86400_000).toISOString()))
    .sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1))[0];
  const promise: S['CashInHandItem']['promise'] = match
    ? { id: match.id!, promisedDate: match.promisedDate!, promisedAmountPoisha: match.promisedAmountPoisha ?? 0, status: (['open', 'kept', 'partially_kept', 'broken'] as const).find((x) => x === match.status) ?? 'open', onTime: day <= (match.promisedDate ?? '') }
    : null;
  return { collectionId: c.id!, receiptNo: c.receiptNo!, recordedAt: c.recordedAt!, businessDate: day, customer: { id: c.customer?.id, name: c.customer?.name, code: c.customer?.code }, erpPlanId: c.erpPlanId ?? '', amountPoisha: c.amountPoisha ?? 0, inHandPoisha: 0, status: c.status!, promise };
}

/** FR-CUS-016: the mock keeps the same list the server builds (ERP numbers first, then the added ones). */
function mockPhoneRows(d: components['schemas']['CustomerDetail']): components['schemas']['PhoneDetail'][] {
  if (d.phoneDetails?.length) return [...d.phoneDetails];
  return (d.phones ?? []).filter(Boolean).map((number, i) => ({ number, source: 'erp' as const, primary: i === 0 }));
}
function mockMobile(v: string): string | null {
  let d = [...v.trim()].map((ch) => ('০১২৩৪৫৬৭৮৯'.includes(ch) ? String('০১২৩৪৫৬৭৮৯'.indexOf(ch)) : ch)).join('');
  if (/[^0-9 \-()+.]/.test(d)) return null;
  d = d.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('880')) d = d.slice(2);
  else if (d.length === 10 && /^1[3-9]/.test(d)) d = `0${d}`;
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

export const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    await lag();
    const body = (await request.json()) as S['LoginRequest'];
    const id = (body.username ?? body.phone ?? '').trim().toLowerCase();
    const u = db.users.find((x) => x.username?.toLowerCase() === id || x.phone === id);
    if (!u || u.password !== body.password) return problem(401, 'INVALID_CREDENTIALS', 'Wrong username or password');
    if (!u.active) return problem(403, 'USER_INACTIVE', 'Account is deactivated');
    if (u.role === 'field_staff') return problem(403, 'WEB_NOT_ALLOWED', 'Field staff use the mobile app');
    u.lastLoginAt = new Date().toISOString();
    db.addAudit({ actor: actor(u), action: 'auth.login', entity: 'session', entityId: u.id, after: { client: 'web' }, reason: '' });
    return HttpResponse.json(issue(u));
  }),
  http.post(`${BASE}/auth/refresh`, async () => {
    await lag();
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    const u = id ? db.userById(id) : undefined;
    if (!u) return problem(401, 'REFRESH_INVALID', 'Session expired');
    return HttpResponse.json(issue(u));
  }),
  http.post(`${BASE}/auth/logout`, async ({ request }) => {
    tokens.delete((request.headers.get('Authorization') ?? '').replace(/^Bearer /, ''));
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${BASE}/auth/password/change`, authed(async ({ request, ctx }) => {
    const b = (await request.json()) as { currentPassword?: string; newPassword?: string };
    if (b.currentPassword !== ctx.user.password) return problem(400, 'INVALID_CURRENT_PASSWORD', 'Current password is wrong');
    if (!b.newPassword || b.newPassword.length < 8) return problem(400, 'WEAK_PASSWORD', 'Password too weak');
    ctx.user.password = b.newPassword;
    ctx.user.mustChangePassword = false;
    db.addAudit({ actor: actor(ctx.user), action: 'auth.password.change', entity: 'user', entityId: ctx.user.id, reason: '' });
    return new HttpResponse(null, { status: 204 });
  })),
  http.get(`${BASE}/auth/me`, authed(({ ctx }) => {
    const { password: _p, ...user } = ctx.user;
    return HttpResponse.json({ user, permissions: [...perms(ctx.user)], flags: flagsFor(ctx.user) });
  })),

  // ---------- system ----------
  http.get(`${BASE}/meta/app-config`, () =>
    HttpResponse.json({
      minAppVersion: '1.0.0', latestAppVersion: '1.0.3', killSwitch: false, privacyNoticeVersion: '2026-11-v1', serverTime: new Date().toISOString(),
      tileProvider: { id: 'osm-demo', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', maxZoom: 19 },
    }),
  ),
  http.get(`${BASE}/system/erp-status`, authed(() => HttpResponse.json({ ...db.erpStatus, lastSuccessAt: lastErpSyncAt ?? new Date(Date.now() - 3 * 60_000).toISOString() }))),
  // FR-ERP-007 (contract 1.17.0): "Sync from ERP". The first call is cut for time (`partial`) to exercise the repeat loop.
  http.post(`${BASE}/system/erp-sync`, authed(async ({ ctx }) => {
    const deny = need(ctx, 'erp.sync');
    if (deny) return deny;
    await new Promise((r) => setTimeout(r, 250));
    erpSyncCalls += 1;
    const partial = erpSyncCalls % 2 === 1;
    if (!partial) lastErpSyncAt = new Date().toISOString();
    return HttpResponse.json({ customers: partial ? 120 : 37, branches: 3, partial, durationMs: 250, finishedAt: new Date().toISOString() });
  })),
  http.get(`${BASE}/system/erp-employees`, authed(({ ctx }) => need(ctx, 'user.manage') ?? HttpResponse.json({ items: db.erpEmployees }))),
  http.get(`${BASE}/system/health`, () => HttpResponse.json({ status: 'ok', version: '1.6.0', mongo: 'ok', erp: 'ok', storage: 'db', cloudStorage: 'cloudinary' })),
  // FR-MED-003: photos of previous months; the mock keeps counts per month (no files)
  http.get(`${BASE}/media/purge/preview`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'media.delete');
    if (deny) return deny;
    const thisMonth = db.today().slice(0, 7);
    const before = url.searchParams.get('before') ?? thisMonth;
    if (!/^\d{4}-\d{2}$/.test(before)) return problem(400, 'VALIDATION_FAILED', 'before must be YYYY-MM');
    if (before > thisMonth) return problem(422, 'BUSINESS_RULE', 'Not a past month', undefined, { rule: 'NOT_A_PAST_MONTH' });
    const proofs = url.searchParams.get('includeMoneyProofs') === 'true';
    const months = db.photoMonths().filter((m) => m.month < before).map((m) => ({ month: m.month, count: m.photos + (proofs ? m.proofs : 0), bytes: (m.photos + (proofs ? m.proofs : 0)) * db.PHOTO_BYTES })).filter((m) => m.count > 0);
    const total = months.reduce((a, m) => ({ count: a.count + m.count, bytes: a.bytes + m.bytes }), { count: 0, bytes: 0 });
    const today = db.today();
    return HttpResponse.json({
      before, cutoff: DateTime.fromISO(`${before}-01`, { zone: 'Asia/Dhaka' }).toUTC().toISO(), today,
      kinds: ['selfie', 'visit_photo', 'location_proof', ...(proofs ? ['deposit_slip', 'refund_proof'] : [])], includeMoneyProofs: proofs,
      months, total, suggest: total.count > 0 && Number(today.slice(8, 10)) >= 5,
    });
  })),
  http.post(`${BASE}/media/purge`, authed(async ({ ctx, request }) => {
    const deny = need(ctx, 'media.delete');
    if (deny) return deny;
    const b = (await request.json()) as { before: string; includeMoneyProofs?: boolean; confirmText: string };
    if (b.confirmText !== `DELETE ${b.before}`) return problem(422, 'BUSINESS_RULE', 'The confirmation text does not match', undefined, { rule: 'CONFIRM_TEXT_MISMATCH', expected: `DELETE ${b.before}` });
    let left = 200;
    let deleted = 0;
    for (const m of db.photoMonths().filter((x) => x.month < b.before)) {
      const p = Math.min(left, m.photos);
      m.photos -= p;
      left -= p;
      deleted += p;
      if (b.includeMoneyProofs) {
        const q = Math.min(left, m.proofs);
        m.proofs -= q;
        left -= q;
        deleted += q;
      }
    }
    const remaining = db.photoMonths().filter((x) => x.month < b.before).reduce((a, m) => a + m.photos + (b.includeMoneyProofs ? m.proofs : 0), 0);
    if (deleted) db.addAudit({ actor: actor(ctx.user), action: 'media.purged', entity: 'media', entityId: `purge:${b.before}`, after: { before: b.before, deleted }, reason: b.confirmText });
    return HttpResponse.json({ deleted, bytes: deleted * db.PHOTO_BYTES, remaining });
  })),
  http.get(`${BASE}/system/sync-health`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'settings.manage');
    if (deny) return deny;
    return HttpResponse.json(db.syncHealth(scope(ctx, url)));
  })),
  http.get(`${BASE}/devices`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'device.manage');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const userId = url.searchParams.get('userId');
    return HttpResponse.json(db.devices.filter((d) => sc.includes(db.deviceBranch(d)) && (!userId || d.userId === userId)));
  })),
  http.post(`${BASE}/devices/:id/approve`, authed(({ ctx, params }) => {
    const deny = need(ctx, 'device.manage');
    if (deny) return deny;
    const d = db.devices.find((x) => x.id === params.id);
    if (!d) return problem(404, 'NOT_FOUND', 'Device not found');
    if (d.status !== 'pending_approval') return problem(409, 'INVALID_STATE', 'Device is not waiting for approval');
    // one phone per account: the old one is unbound when the new one is approved
    db.devices.filter((x) => x.userId === d.userId && x.status === 'active').forEach((x) => (x.status = 'unbound'));
    d.status = 'active';
    db.addAudit({ actor: actor(ctx.user), action: 'device.approve', entity: 'device', entityId: d.id, after: { status: 'active' }, reason: '' });
    return HttpResponse.json({});
  })),
  http.post(`${BASE}/devices/:id/unbind`, authed(async ({ ctx, params, request }) => {
    const deny = need(ctx, 'device.manage');
    if (deny) return deny;
    const b = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!b.reason || b.reason.trim().length < 5) return problem(422, 'VALIDATION_FAILED', 'reason is required (min 5)');
    const d = db.devices.find((x) => x.id === params.id);
    if (!d) return problem(404, 'NOT_FOUND', 'Device not found');
    d.status = 'unbound';
    db.addAudit({ actor: actor(ctx.user), action: 'device.unbind', entity: 'device', entityId: d.id, after: { status: 'unbound' }, reason: b.reason });
    return HttpResponse.json({});
  })),
  http.get(`${BASE}/branches`, authed(({ ctx, url }) => HttpResponse.json(db.branches.filter((b) => scope(ctx, url).includes(b.id!))))),
  http.put(`${BASE}/branches/:id/location`, authed(async ({ ctx, params, request }) => {
    const deny = need(ctx, 'settings.manage');
    if (deny) return deny;
    const b = db.branches.find((x) => x.id === params.id);
    if (!b) return problem(404, 'NOT_FOUND', 'Branch not found');
    const body = (await request.json()) as { lat: number | null; lng: number | null };
    const clear = body.lat === null && body.lng === null;
    if (!clear && (typeof body.lat !== 'number' || typeof body.lng !== 'number')) return problem(400, 'VALIDATION_FAILED', 'lat and lng are required');
    if (!clear && !(body.lat! >= 20.5 && body.lat! <= 26.8 && body.lng! >= 88 && body.lng! <= 92.8)) return problem(422, 'BUSINESS_RULE', 'Location outside Bangladesh', undefined, { rule: 'LOCATION_OUTSIDE_BANGLADESH' });
    const before = { lat: b.lat, lng: b.lng };
    Object.assign(b, clear ? { lat: null, lng: null } : { lat: body.lat, lng: body.lng });
    db.addAudit({ actor: actor(ctx.user), action: 'branch.location_set', entity: 'branch', entityId: b.id, before, after: { lat: b.lat, lng: b.lng }, reason: '' });
    return HttpResponse.json(b);
  })),

  // ---------- users ----------
  http.get(`${BASE}/users`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'user.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const role = url.searchParams.get('role');
    const active = url.searchParams.get('active');
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const all = db.users
      .filter((u) => u.branchIds?.some((b) => sc.includes(b)))
      .filter((u) => !role || u.role === role)
      .filter((u) => active == null || String(u.active) === active)
      .filter((u) => !q || `${u.name?.bn} ${u.name?.en} ${u.phone} ${u.employeeCode} ${u.username ?? ''}`.toLowerCase().includes(q))
      .map(({ password: _p, ...u }) => u);
    const p = page(all, url);
    return HttpResponse.json({ items: p.items, nextCursor: p.nextCursor });
  })),
  http.post(`${BASE}/users`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'user.manage');
    if (deny) return deny;
    const b = (await request.json()) as S['UserCreate'];
    if (db.users.some((u) => u.phone === b.phone)) return problem(409, 'PHONE_TAKEN', 'Phone already used');
    const temp = `Fos-${Math.random().toString(36).slice(2, 8)}`;
    const u: db.MockUser = { id: db.oid('6734'), ...b, active: true, mustChangePassword: true, locale: 'bn', lastLoginAt: null, version: 1, password: temp, erpEmployeeId: b.erpEmployeeId ?? null, shiftId: b.shiftId ?? null, cashLimitPoisha: b.cashLimitPoisha ?? null };
    db.users.push(u);
    db.addAudit({ actor: actor(ctx.user), action: 'user.create', entity: 'user', entityId: u.id, after: { role: u.role, branchIds: u.branchIds }, reason: '' });
    const { password: _p, ...user } = u;
    return HttpResponse.json({ user, temporaryPassword: temp }, { status: 201 });
  })),
  http.get(`${BASE}/users/:id`, authed(({ params }) => {
    const u = db.userById(params.id);
    if (!u) return problem(404, 'NOT_FOUND', 'User not found');
    const { password: _p, ...user } = u;
    return HttpResponse.json(user);
  })),
  http.patch(`${BASE}/users/:id`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'user.manage');
    if (deny) return deny;
    const u = db.userById(params.id);
    if (!u) return problem(404, 'NOT_FOUND', 'User not found');
    const b = (await request.json()) as S['UserUpdate'];
    const before = { role: u.role, branchIds: u.branchIds, cashLimitPoisha: u.cashLimitPoisha };
    Object.assign(u, { ...b, reason: undefined, version: (u.version ?? 1) + 1 });
    db.addAudit({ actor: actor(ctx.user), action: 'user.update', entity: 'user', entityId: u.id, before, after: { role: u.role, branchIds: u.branchIds, cashLimitPoisha: u.cashLimitPoisha }, reason: b.reason ?? '' });
    const { password: _p, ...user } = u;
    return HttpResponse.json(user);
  })),
  http.post(`${BASE}/users/:id/deactivate`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'user.manage');
    if (deny) return deny;
    const u = db.userById(params.id)!;
    const b = (await request.json().catch(() => ({}))) as { reason?: string };
    if (u.role === 'super_admin' && db.users.filter((x) => x.role === 'super_admin' && x.active).length <= 1) return problem(422, 'LAST_SUPER_ADMIN', 'Cannot deactivate the last super admin');
    u.active = false;
    db.addAudit({ actor: actor(ctx.user), action: 'user.deactivate', entity: 'user', entityId: u.id, before: { active: true }, after: { active: false }, reason: b.reason ?? '' });
    return HttpResponse.json({});
  })),
  http.post(`${BASE}/users/:id/activate`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'user.manage');
    if (deny) return deny;
    const u = db.userById(params.id)!;
    u.active = true;
    db.addAudit({ actor: actor(ctx.user), action: 'user.activate', entity: 'user', entityId: u.id, before: { active: false }, after: { active: true }, reason: '' });
    return HttpResponse.json({});
  })),
  http.post(`${BASE}/users/:id/reset-password`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'user.manage');
    if (deny) return deny;
    const u = db.userById(params.id)!;
    const temp = `Fos-${Math.random().toString(36).slice(2, 8)}`;
    u.password = temp;
    u.mustChangePassword = true;
    db.addAudit({ actor: actor(ctx.user), action: 'user.reset_password', entity: 'user', entityId: u.id, reason: '' });
    return HttpResponse.json({ temporaryPassword: temp });
  })),

  // ---------- map & pin proposals ----------
  http.get(`${BASE}/customers/map`, authed(({ ctx, url, request }) => {
    const deny = need(ctx, 'customer.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const [minLng, minLat, maxLng, maxLat] = (url.searchParams.get('bbox') ?? '').split(',').map(Number) as [number, number, number, number];
    if ([minLng, minLat, maxLng, maxLat].some((n) => !Number.isFinite(n))) return problem(400, 'VALIDATION_FAILED', 'bbox is required: minLng,minLat,maxLng,maxLat');
    const zoom = Number(url.searchParams.get('zoom') ?? 13);
    const filter = (url.searchParams.get('filter') ?? '').split(',').filter(Boolean);
    const ORDER = ['tagged_bad', 'bad_suggested', 'overdue', 'promised_today', 'due_today', 'current', 'paid_up'];
    const worst = (b: string[] | undefined) => ORDER.find((s) => b?.includes(s as never)) ?? 'current';
    const inBox = db.customers
      .filter((c) => sc.includes(c.branchId) && c.item.location?.status === 'ok')
      .filter((c) => c.item.location!.lat! >= minLat && c.item.location!.lat! <= maxLat && c.item.location!.lng! >= minLng && c.item.location!.lng! <= maxLng)
      .filter((c) => !filter.length || filter.some((f) => c.item.badges?.includes(f as never)))
      .filter(payFilter(url));
    if (zoom < 13) {
      const cell = 360 / 2 ** (zoom + 2);
      const cells = new Map<string, { lat: number; lng: number; count: number; rank: number; payRank: number; payStates: Record<string, number> }>();
      for (const c of inBox) {
        const k = `${Math.floor(c.item.location!.lat! / cell)}:${Math.floor(c.item.location!.lng! / cell)}`;
        const cur = cells.get(k) ?? { lat: 0, lng: 0, count: 0, rank: 99, payRank: 99, payStates: {} as Record<string, number> };
        cur.lat += c.item.location!.lat!;
        cur.lng += c.item.location!.lng!;
        cur.count++;
        cur.rank = Math.min(cur.rank, ORDER.indexOf(worst(c.item.badges)));
        const ps = c.item.payState ?? 'on_track';
        cur.payRank = Math.min(cur.payRank, PAY_ORDER.indexOf(ps));
        cur.payStates[ps] = (cur.payStates[ps] ?? 0) + 1;
        cells.set(k, cur);
      }
      return HttpResponse.json({ pins: [], clusters: [...cells.values()].map((v) => ({ lat: v.lat / v.count, lng: v.lng / v.count, count: v.count, worstStatus: ORDER[v.rank] as S['CustomerStatus'], worstPayState: PAY_ORDER[v.payRank], payStates: v.payStates })) });
    }
    return HttpResponse.json({
      clusters: [],
      pins: inBox.slice(0, 2000).map((c) => ({ id: c.item.id, lat: c.item.location!.lat!, lng: c.item.location!.lng!, status: worst(c.item.badges) as S['CustomerStatus'], name: (request.headers.get('Accept-Language') === 'bn' ? c.item.name?.bn : c.item.name?.en) ?? '', outstandingPoisha: c.item.totalOutstandingPoisha, tagged: c.item.tag?.state === 'tagged', payState: c.item.payState, missedCount: c.item.missedCount })),
    });
  })),
  http.get(`${BASE}/location-proposals`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'customer.location.approve');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const status = url.searchParams.get('status');
    return HttpResponse.json(db.proposals.filter((p) => sc.includes(p.branchId)).map((p) => p.row).filter((p) => !status || p.status === status).sort((a, b) => (a.createdAt! < b.createdAt! ? 1 : -1)));
  })),
  // ---------- live location & route history ----------
  http.get(`${BASE}/location/latest`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'location.view');
    if (deny) return deny;
    return HttpResponse.json(db.latestLocations(scope(ctx, url)));
  })),
  http.get(`${BASE}/location/history`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'location.history.view');
    if (deny) return deny;
    const userId = url.searchParams.get('userId');
    const date = url.searchParams.get('date');
    if (!userId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return problem(400, 'VALIDATION_FAILED', 'userId and date (YYYY-MM-DD) are required');
    return HttpResponse.json(db.routeHistory(userId, date));
  })),
  http.get(`${BASE}/location/stops`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'location.history.view');
    if (deny) return deny;
    return HttpResponse.json(db.routeHistory(url.searchParams.get('userId') ?? '', url.searchParams.get('date') ?? '').stops);
  })),
  http.post(`${BASE}/customers/:id/location`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'customer.location.approve');
    if (deny) return deny;
    const c = db.customerById(params.id!);
    if (!c || !custBranchOk(ctx, c)) return problem(404, 'NOT_FOUND', 'Customer not found');
    const b = (await request.json()) as { clientId?: string; lat?: number; lng?: number; note?: string };
    if (!b.clientId || typeof b.lat !== 'number' || typeof b.lng !== 'number') return problem(400, 'VALIDATION_FAILED', 'clientId, lat and lng are required');
    const seen = pinClientIds.get(b.clientId);
    if (seen) return seen.customerId === c.item.id ? HttpResponse.json({ id: seen.id, status: 'approved', location: c.item.location }) : problem(409, 'INVALID_STATE', 'This clientId belongs to another pin');
    if (!inBd(b.lat, b.lng)) return problem(422, 'BUSINESS_RULE', 'The point is outside Bangladesh', undefined, { rule: 'OUTSIDE_BANGLADESH' });
    const before = c.item.location?.status === 'ok' || c.item.location?.status === 'overridden' ? { lat: c.item.location.lat!, lng: c.item.location.lng! } : null;
    c.item.location = { lat: b.lat, lng: b.lng, status: 'overridden', source: 'overlay' };
    recomputeCustomer(c);
    const id = `pin-${crypto.randomUUID()}`;
    pinClientIds.set(b.clientId, { id, customerId: c.item.id! });
    const me = { id: ctx.user.id, name: ctx.user.name?.en ?? '' };
    db.proposals.unshift({ branchId: c.branchId, row: { id, customer: { id: c.item.id, name: c.item.name, code: c.item.code, current: c.item.location as never }, lat: b.lat, lng: b.lng, photoMediaId: null, note: b.note ?? null, proposedBy: me.id, proposer: me, status: 'approved', method: 'map', deviceDistanceM: null, deviceMock: false, autoApplied: false, direct: true, decider: me, decidedAt: new Date().toISOString(), createdAt: new Date().toISOString() } });
    db.addAudit({ actor: actor(ctx.user), action: 'customer.location.set', entity: 'customer', entityId: c.item.id, branchId: c.branchId, before: before ?? {}, after: { lat: b.lat, lng: b.lng }, reason: b.note ?? '' });
    return HttpResponse.json({ id, status: 'approved', location: c.item.location }, { status: 201 });
  })),
  // FR-CUS-014 (contract 1.17.0): delete the pin; idempotent
  http.delete(`${BASE}/customers/:id/location`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'customer.location.approve');
    if (deny) return deny;
    const c = db.customerById(params.id!);
    if (!c || !custBranchOk(ctx, c)) return problem(404, 'NOT_FOUND', 'Customer not found');
    const had = c.item.location?.status === 'ok' || c.item.location?.status === 'overridden';
    if (!had) return HttpResponse.json({ removed: false, location: c.item.location });
    const before = { lat: c.item.location!.lat!, lng: c.item.location!.lng! };
    c.item.location = { lat: null, lng: null, status: 'missing', source: 'overlay' };
    recomputeCustomer(c);
    db.addAudit({ actor: actor(ctx.user), action: 'customer.location.cleared', entity: 'customer', entityId: c.item.id, branchId: c.branchId, before, after: {}, reason: '' });
    return HttpResponse.json({ removed: true, location: c.item.location });
  })),
  // FR-CUS-016 (contract 1.23.0): numbers added in the field system; ERP numbers stay first
  http.post(`${BASE}/customers/:id/phones`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'customer.phone.manage');
    if (deny) return deny;
    const c = db.customerById(params.id!);
    if (!c || !custBranchOk(ctx, c)) return problem(404, 'NOT_FOUND', 'Customer not found');
    const b = (await request.json()) as { phones?: { number?: string; label?: string | null }[] };
    if (!Array.isArray(b.phones) || b.phones.length < 1 || b.phones.length > 5) return problem(400, 'VALIDATION_FAILED', 'One to five numbers');
    const rows = mockPhoneRows(c.detail);
    const numbers = b.phones.map((x) => mockMobile(x.number ?? ''));
    if (numbers.some((n) => !n)) return problem(400, 'VALIDATION_FAILED', 'Bangladesh mobile number, 01XXXXXXXXX');
    const added: string[] = [];
    const skipped: { number: string; reason: 'duplicate' | 'limit' }[] = [];
    numbers.forEach((n, i) => {
      if (rows.some((r) => r.number === n)) return void skipped.push({ number: n!, reason: 'duplicate' });
      if (rows.filter((r) => r.source === 'field').length >= 5) return void skipped.push({ number: n!, reason: 'limit' });
      const label = b.phones![i]!.label?.trim();
      rows.push({ number: n!, source: 'field', primary: false, ...(label ? { label } : {}), addedBy: { id: ctx.user.id, name: ctx.user.name?.en ?? '' }, addedAt: new Date().toISOString() });
      added.push(n!);
    });
    c.detail.phoneDetails = rows;
    c.detail.phones = rows.map((r) => r.number!);
    if (added.length) db.addAudit({ actor: actor(ctx.user), action: 'customer.phone.added', entity: 'customer', entityId: c.item.id, branchId: c.branchId, before: {}, after: { numbers: added.map((n) => `…${n.slice(-4)}`) }, reason: '' });
    return HttpResponse.json({ added, skipped, phones: c.detail.phones, phoneDetails: rows });
  })),
  http.delete(`${BASE}/customers/:id/phones/:number`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'customer.phone.manage');
    if (deny) return deny;
    const c = db.customerById(params.id!);
    if (!c || !custBranchOk(ctx, c)) return problem(404, 'NOT_FOUND', 'Customer not found');
    const n = mockMobile(decodeURIComponent(String(params.number)));
    if (!n) return problem(400, 'VALIDATION_FAILED', 'Bangladesh mobile number, 01XXXXXXXXX');
    const rows = mockPhoneRows(c.detail);
    const hit = rows.find((r) => r.number === n);
    if (hit?.source === 'erp') return problem(422, 'BUSINESS_RULE', 'This number comes from the ERP', undefined, { rule: 'PHONE_FROM_ERP' });
    const left = rows.filter((r) => r.number !== n);
    c.detail.phoneDetails = left;
    c.detail.phones = left.map((r) => r.number!);
    if (hit) db.addAudit({ actor: actor(ctx.user), action: 'customer.phone.removed', entity: 'customer', entityId: c.item.id, branchId: c.branchId, before: { numbers: [`…${n.slice(-4)}`] }, after: {}, reason: '' });
    return HttpResponse.json({ removed: !!hit, phones: c.detail.phones, phoneDetails: left });
  })),
  http.post(`${BASE}/location-proposals/:id/decision`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'customer.location.approve');
    if (deny) return deny;
    const b = (await request.json()) as { decision: 'approve' | 'reject'; reason?: string };
    const p = db.proposals.find((x) => x.row.id === params.id);
    if (!p) return problem(404, 'NOT_FOUND', 'Proposal not found');
    if (p.row.status !== 'pending') return problem(409, 'PROPOSAL_DECIDED', 'This proposal was already decided');
    if (b.decision === 'reject' && (!b.reason || b.reason.length < 5)) return problem(400, 'VALIDATION_FAILED', 'Reason required');
    p.row.status = b.decision === 'approve' ? 'approved' : 'rejected';
    const c = db.customerById(p.row.customer?.id ?? '');
    const before = c?.item.location ? { lat: c.item.location.lat, lng: c.item.location.lng } : {};
    if (c && b.decision === 'approve') {
      c.item.location = { lat: p.row.lat!, lng: p.row.lng!, status: 'overridden', source: 'overlay' };
      c.detail.location = c.item.location;
    }
    db.addAudit({ actor: actor(ctx.user), action: `location.proposal.${b.decision}`, entity: 'customer', entityId: p.row.customer?.id, branchId: p.branchId, before, after: b.decision === 'approve' ? { lat: p.row.lat, lng: p.row.lng } : before, reason: b.reason ?? '' });
    return HttpResponse.json({});
  })),
  // ---------- attendance ----------
  http.get(`${BASE}/attendance/days`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'attendance.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const userId = url.searchParams.get('userId');
    if (!from || !to) return problem(400, 'VALIDATION_FAILED', 'from and to are required');
    const end = to > db.today() ? db.today() : to;
    const out: S['AttendanceDay'][] = [];
    const people = db.staff.filter((s) => s.active && s.branchIds?.some((b) => sc.includes(b))).filter((s) => !userId || s.id === userId);
    for (let d = from; d <= end; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) for (const s of people) out.push(db.attendanceDay(s, d));
    return HttpResponse.json(out);
  })),
  http.get(`${BASE}/attendance/summary`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'attendance.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const month = url.searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return problem(400, 'VALIDATION_FAILED', 'month is required (YYYY-MM)');
    const [y, m] = month.split('-').map(Number) as [number, number];
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dates = Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter((d) => d <= db.today());
    const items = db.staff.filter((s) => s.active && s.branchIds?.some((b) => sc.includes(b))).map((s) => {
      const days = dates.map((d) => db.attendanceDay(s, d));
      const count = (...st: string[]) => days.filter((d) => st.includes(d.status!)).length;
      const sum = (k: 'lateMin' | 'breakMin' | 'dutyMin' | 'overBreakMin' | 'overtimeMin') => days.reduce((a, d) => a + (d[k] ?? 0), 0);
      const late = days.filter((d) => (d.lateMin ?? 0) > 0).length;
      const perAbsent = Number(db.settings['attendance.lateDaysPerAbsent'] ?? 2);
      return {
        userId: s.id, userName: s.name?.en, present: count('present', 'on_duty', 'on_break', 'off_duty', 'late'), late: days.filter((d) => (d.lateMin ?? 0) > 0).length, absent: count('absent'),
        leave: count('leave'), holiday: count('holiday'), weeklyOff: count('weekly_off'), lateMin: sum('lateMin'), breakMin: sum('breakMin'), dutyMin: sum('dutyMin'), overBreakDays: days.filter((d) => (d.breakMin ?? 0) > 60).length,
        overBreakMin: sum('overBreakMin'), overtimeMin: sum('overtimeMin'), overtimeDays: days.filter((d) => (d.overtimeMin ?? 0) > 0).length, offDaysWorked: 0, lateAbsences: perAbsent > 0 ? Math.floor(late / perAbsent) : 0,
      };
    });
    return HttpResponse.json({ month, items });
  })),
  http.get(`${BASE}/attendance/events`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'attendance.view');
    if (deny) return deny;
    const u = db.userById(url.searchParams.get('userId'));
    const date = url.searchParams.get('date') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return problem(400, 'VALIDATION_FAILED', 'date is required');
    if (!u || !scope(ctx, url).includes(u.branchIds?.[0] ?? '')) return problem(404, 'NOT_FOUND', 'User not found');
    return HttpResponse.json(db.attendanceEvents(u, date));
  })),
  http.post(`${BASE}/attendance/photos/delete`, authed(async ({ request, ctx, url }) => {
    const deny = need(ctx, 'media.delete');
    if (deny) return deny;
    const b = (await request.json()) as { userId: string; date: string; reason?: string };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '')) return problem(400, 'VALIDATION_FAILED', 'date is required');
    const u = db.userById(b.userId);
    if (!u || !scope(ctx, url).includes(u.branchIds?.[0] ?? '')) return problem(404, 'NOT_FOUND', 'User not found');
    const key = `${u.id}:${b.date}`;
    const had = db.attendanceEvents(u, b.date).filter((e) => !!e.selfieMediaId).length;
    if (had) {
      db.deletedSelfies.set(key, { at: new Date().toISOString(), by: ctx.user.id!, byName: ctx.user.name?.en ?? '' });
      db.addAudit({ actor: actor(ctx.user), action: 'attendance.photos_deleted', entity: 'attendance_day', entityId: key, branchId: u.branchIds?.[0], after: { deleted: had }, reason: b.reason });
    }
    return HttpResponse.json({ deleted: had, events: db.attendanceEvents(u, b.date) });
  })),
  http.post(`${BASE}/attendance/corrections`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'attendance.manage');
    if (deny) return deny;
    const b = (await request.json()) as { userId: string; businessDate: string; type: string; at: string; reason: string };
    if (!b.reason || b.reason.length < 10) return problem(400, 'VALIDATION_FAILED', 'Reason must be at least 10 characters');
    const u = db.userById(b.userId);
    if (!u) return problem(404, 'NOT_FOUND', 'User not found');
    const before = db.attendanceDay(u, b.businessDate);
    const key = `${b.userId}:${b.businessDate}`;
    db.attendanceCorrections.set(key, [...(db.attendanceCorrections.get(key) ?? []), { type: b.type, at: b.at }]);
    const after = db.attendanceDay(u, b.businessDate);
    db.addAudit({ actor: actor(ctx.user), action: 'attendance.correct', entity: 'attendance_day', entityId: key, branchId: u.branchIds?.[0], before: { status: before.status, firstIn: before.firstIn, lastOut: before.lastOut }, after: { status: after.status, firstIn: after.firstIn, lastOut: after.lastOut, type: b.type }, reason: b.reason });
    return HttpResponse.json({}, { status: 201 });
  })),
  // ---------- promises & visits ----------
  http.get(`${BASE}/promises`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'promise.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const g = (k: string) => url.searchParams.get(k);
    const date = g('date');
    const from = date ?? g('from');
    const to = date ?? g('to');
    const all = db.promises
      .filter((p) => sc.includes(p.branchId))
      .map((p) => p.row)
      .filter((p) => (!from || p.promisedDate >= from) && (!to || p.promisedDate <= to))
      .filter((p) => !g('status') || p.status === g('status'))
      .filter((p) => !g('ownerId') || p.ownerId === g('ownerId'))
      .filter((p) => !g('customerId') || p.customerId === g('customerId'))
      .sort((a, b) => (a.promisedDate === b.promisedDate ? (a.id! < b.id! ? -1 : 1) : a.promisedDate < b.promisedDate ? -1 : 1));
    const pg = page(all, url);
    return HttpResponse.json({ items: pg.items, nextCursor: pg.nextCursor });
  })),
  http.post(`${BASE}/promises/:id/cancel`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'promise.create');
    if (deny) return deny;
    const b = (await request.json()) as { reason: string };
    if (!b.reason || b.reason.length < 5) return problem(400, 'VALIDATION_FAILED', 'Reason required');
    const p = db.promises.find((x) => x.row.id === params.id);
    if (!p) return problem(404, 'NOT_FOUND', 'Promise not found');
    if (p.row.status !== 'open') return problem(409, 'PROMISE_NOT_OPEN', 'Only an open promise can be cancelled');
    p.row.status = 'cancelled';
    const c = db.customerById(p.row.customerId);
    if (c && c.item.openPromise?.id === p.row.id) {
      c.item.openPromise = null;
      c.detail.openPromise = null;
      c.item.badges = c.item.badges?.filter((x) => x !== 'promised_today');
      c.detail.badges = c.item.badges;
    }
    db.addAudit({ actor: actor(ctx.user), action: 'promise.cancel', entity: 'promise', entityId: p.row.id, branchId: p.branchId, before: { status: 'open' }, after: { status: 'cancelled' }, reason: b.reason });
    return HttpResponse.json({});
  })),
  http.get(`${BASE}/visits`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'visit.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const g = (k: string) => url.searchParams.get(k);
    const date = g('date');
    const from = date ?? g('from');
    const to = date ?? g('to');
    const day = (iso: string) => new Date(Date.parse(iso) + 6 * 3600_000).toISOString().slice(0, 10);
    const all = db.visits
      .filter((v) => sc.includes(v.branchId))
      .map((v) => v.row)
      .filter((v) => (!from || day(v.checkInAt) >= from) && (!to || day(v.checkInAt) <= to))
      .filter((v) => !g('outcome') || v.outcome === g('outcome'))
      // 1.9.0: a person's visits include the joint visits they took part in
      .filter((v) => !g('userId') || v.userId === g('userId') || !!v.coWork?.participantIds?.includes(g('userId')!))
      .filter((v) => !g('customerId') || v.customerId === g('customerId'))
      .filter((v) => !g('coWork') || (g('coWork') === 'true') === !!v.coWork)
      .filter((v) => !g('coWorkSessionId') || v.coWork?.sessionId === g('coWorkSessionId'));
    const pg = page(all, url);
    return HttpResponse.json({ items: pg.items, nextCursor: pg.nextCursor });
  })),
  http.get(`${BASE}/cowork/sessions`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'cowork.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const g = (k: string) => url.searchParams.get(k);
    const all = db.coworkSessions
      .filter((s) => sc.includes(s.branchId ?? ''))
      .filter((s) => (!g('from') || s.businessDate >= g('from')!) && (!g('to') || s.businessDate <= g('to')!))
      .filter((s) => !g('userId') || s.members.some((m) => m.userId === g('userId')))
      .sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1))
      .map(withVisitsCount);
    const pg = page(all, url);
    return HttpResponse.json({ items: pg.items, nextCursor: pg.nextCursor });
  })),
  http.get(`${BASE}/cowork/sessions/:id`, authed(({ ctx, params, url }) => {
    const deny = need(ctx, 'cowork.view');
    if (deny) return deny;
    const s = db.coworkSessions.find((x) => x.id === params.id);
    if (!s || !scope(ctx, url).includes(s.branchId ?? '')) return problem(404, 'NOT_FOUND', 'Co-work session not found');
    return HttpResponse.json(withVisitsCount(s));
  })),
  // FR-CW-006 (1.34.0): an office user ends an open session with a reason; the row stays as ended
  http.post(`${BASE}/cowork/sessions/:id/end`, authed(async ({ request, params, ctx, url }) => {
    const deny = need(ctx, 'cowork.manage');
    if (deny) return deny;
    const s = db.coworkSessions.find((x) => x.id === params.id);
    if (!s || !scope(ctx, url).includes(s.branchId ?? '')) return problem(404, 'NOT_FOUND', 'Co-work session not found');
    const b = (await request.json()) as { reason?: string };
    if (!b.reason || b.reason.trim().length < 5) return problem(400, 'VALIDATION_FAILED', 'A reason of at least 5 characters is required');
    if (s.status === 'open') {
      s.status = 'ended';
      s.endedAt = new Date().toISOString();
      s.endedBy = { id: ctx.user.id, name: ctx.user.name?.en ?? '' };
      s.endReason = b.reason.trim();
      db.addAudit({ actor: actor(ctx.user), action: 'cowork.ended_by_office', entity: 'cowork_session', entityId: s.id, before: { status: 'open' }, after: { status: 'ended' }, reason: s.endReason });
    }
    return HttpResponse.json(withVisitsCount(s));
  })),
  http.post(`${BASE}/media/upload-url`, authed(async ({ request }) => {
    const b = (await request.json()) as { kind?: string; contentType?: string; sizeBytes?: number; sha256?: string };
    if (!b.kind || !['image/jpeg', 'image/webp', 'audio/aac', 'audio/mp4'].includes(b.contentType ?? '') || !b.sha256) return problem(400, 'VALIDATION_FAILED', 'kind, contentType and sha256 are required');
    if ((b.sizeBytes ?? 0) > 1_048_576) return problem(413, 'PAYLOAD_TOO_LARGE', 'At most 1 MiB');
    const mediaId = db.oid('6799');
    uploads.set(mediaId, false);
    return HttpResponse.json({ mediaId, uploadUrl: `${BASE}/mock-storage/${mediaId}`, headers: {}, expiresAt: new Date(Date.now() + 600_000).toISOString(), alreadyExists: false }, { status: 201 });
  })),
  http.put(`${BASE}/mock-storage/:id`, ({ params }) => {
    if (!uploads.has(String(params.id))) return new HttpResponse(null, { status: 403 });
    uploads.set(String(params.id), true);
    return new HttpResponse(null, { status: 200 });
  }),
  http.post(`${BASE}/media/:id/confirm`, authed(({ params }) => (uploads.get(String(params.id)) ? HttpResponse.json({}) : problem(409, 'NOT_UPLOADED', 'The file has not been uploaded')))),
  http.get(`${BASE}/media/:id/url`, authed(({ params }) => {
    // a generated placeholder image as a data: URL (no external host, CSP-safe)
    const hue = [...params.id!].reduce((s, ch) => (s + ch.charCodeAt(0)) % 360, 0);
    if (params.id!.startsWith('selfie-')) {
      const face = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960"><rect width="720" height="960" fill="hsl(${hue} 28% 80%)"/><circle cx="360" cy="380" r="150" fill="hsl(${hue} 30% 55%)"/><path d="M110 960c0-200 110-330 250-330s250 130 250 330Z" fill="hsl(${hue} 32% 40%)"/></svg>`;
      return HttpResponse.json({ url: `data:image/svg+xml;utf8,${encodeURIComponent(face)}`, expiresAt: new Date(Date.now() + 300_000).toISOString() });
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="hsl(${hue} 30% 82%)"/><rect x="330" y="300" width="300" height="240" fill="hsl(${hue} 25% 62%)"/><path d="M300 310 480 170 660 310Z" fill="hsl(${hue} 35% 42%)"/><rect x="440" y="400" width="80" height="140" fill="hsl(${hue} 30% 30%)"/></svg>`;
    return HttpResponse.json({ url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, expiresAt: new Date(Date.now() + 300_000).toISOString() });
  })),
  // ---------- areas & handovers ----------
  http.get(`${BASE}/areas`, authed(({ ctx, url }) => HttpResponse.json(db.areas.filter((a) => scope(ctx, url).includes(a.branchId!))))),
  http.post(`${BASE}/areas`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'assignment.manage');
    if (deny) return deny;
    const b = (await request.json()) as S['Area'];
    if (db.areas.some((a) => a.code === b.code)) return problem(409, 'AREA_CODE_TAKEN', 'An area with this code already exists');
    db.areas.push({ ...b, id: db.oid('6738'), customerCount: 0, assignees: [], active: true, version: 1 });
    return HttpResponse.json({}, { status: 201 });
  })),
  http.patch(`${BASE}/areas/:id`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'assignment.manage');
    if (deny) return deny;
    const a = db.areas.find((x) => x.id === params.id);
    if (!a) return problem(404, 'NOT_FOUND', 'Area not found');
    const m = request.headers.get('If-Match');
    if (m && m !== `"${a.version}"`) return problem(412, 'VERSION_CONFLICT', 'The area was changed by someone else');
    const b = (await request.json()) as S['Area'];
    Object.assign(a, { name: b.name, code: b.code, erpAreaCodes: b.erpAreaCodes, active: b.active, version: (a.version ?? 1) + 1 });
    return HttpResponse.json({});
  })),
  http.get(`${BASE}/assignments`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'assignment.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const userId = url.searchParams.get('userId');
    const customerId = url.searchParams.get('customerId');
    const out: S['Assignment'][] = db.areas.filter((a) => sc.includes(a.branchId!)).flatMap((a) => (a.assignees ?? []).map((u) => ({ id: `${a.id}~${u}`, userId: u, type: 'area' as const, areaId: a.id, effectiveFrom: '2026-01-01', effectiveTo: null, source: 'manual' })));
    const direct = directAssignments.filter((d) => d.effectiveTo === null && sc.includes(db.customerById(d.customerId!)?.branchId ?? '')).map(({ fallback: _f, ...d }) => d);
    return HttpResponse.json([...(customerId ? [] : out), ...direct].filter((x) => (!userId || x.userId === userId) && (!customerId || x.customerId === customerId)));
  })),
  http.post(`${BASE}/assignments`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'assignment.manage');
    if (deny) return deny;
    const b = (await request.json()) as { userId: string; type: string; areaId?: string; customerId?: string; reason?: string };
    if (b.type === 'customer') {
      const c = db.customerById(b.customerId ?? '');
      if (!c || !custBranchOk(ctx, c)) return problem(404, 'NOT_FOUND', 'Customer not found');
      const u = db.userById(b.userId);
      if (!u || u.role !== 'field_staff') return problem(404, 'NOT_FOUND', 'User not found');
      if (!u.branchIds?.includes(c.branchId)) return problem(422, 'BUSINESS_RULE', 'The staff member does not work in the customer\'s branch', undefined, { rule: 'USER_NOT_IN_BRANCH' });
      const at = new Date().toISOString();
      let fallback = c.item.assignee;
      for (const d of directAssignments)
        if (d.customerId === c.item.id && d.effectiveTo === null) {
          d.effectiveTo = at;
          fallback = d.fallback;
        }
      const row = { id: `cust~${crypto.randomUUID()}`, userId: u.id, type: 'customer' as const, customerId: c.item.id, effectiveFrom: at, effectiveTo: null, source: 'manual', fallback };
      directAssignments.push(row);
      c.item.assignee = { id: u.id, name: u.name?.en };
      recomputeCustomer(c);
      db.addAudit({ actor: actor(ctx.user), action: 'assignment.created', entity: 'assignment', entityId: row.id, branchId: c.branchId, before: { assignee: fallback?.name ?? null }, after: { user: u.employeeCode, customer: c.item.code }, reason: b.reason ?? '' });
      const { fallback: _f, ...view } = row;
      return HttpResponse.json(view, { status: 201 });
    }
    const a = db.areas.find((x) => x.id === b.areaId);
    if (!a) return problem(404, 'NOT_FOUND', 'Area not found');
    if (a.assignees?.includes(b.userId)) return problem(409, 'ALREADY_ASSIGNED', 'This staff member already holds the area');
    a.assignees = [...(a.assignees ?? []), b.userId];
    db.addAudit({ actor: actor(ctx.user), action: 'assignment.create', entity: 'area', entityId: a.id, branchId: a.branchId, before: {}, after: { user: db.userById(b.userId)?.employeeCode, area: a.code }, reason: '' });
    return HttpResponse.json({}, { status: 201 });
  })),
  http.post(`${BASE}/assignments/bulk`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'assignment.manage');
    if (deny) return deny;
    const b = (await request.json()) as { userId?: string; customerIds?: string[]; reason?: string };
    const u = db.userById(b.userId);
    if (!u || !Array.isArray(b.customerIds) || !b.customerIds.length) return problem(400, 'VALIDATION_FAILED', 'userId and customerIds are required');
    if (b.customerIds.length > 1000) return problem(400, 'VALIDATION_FAILED', 'At most 1000 customers at once');
    let assigned = 0;
    let skipped = 0;
    for (const id of b.customerIds) {
      const c = db.customerById(id);
      if (!c || c.item.assignee?.id === u.id) {
        skipped++;
        continue;
      }
      c.item.assignee = { id: u.id, name: u.name?.en };
      assigned++;
    }
    db.addAudit({ actor: actor(ctx.user), action: 'assignment.bulk', entity: 'user', entityId: u.id, before: {}, after: { customers: assigned }, reason: b.reason ?? '' });
    return HttpResponse.json({ assigned, skipped });
  })),
  http.delete(`${BASE}/assignments/:id`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'assignment.manage');
    if (deny) return deny;
    if (params.id!.startsWith('cust~')) {
      const d = directAssignments.find((x) => x.id === params.id && x.effectiveTo === null);
      const c = d && db.customerById(d.customerId!);
      if (!d || !c) return problem(404, 'NOT_FOUND', 'Assignment not found');
      d.effectiveTo = new Date().toISOString();
      c.item.assignee = d.fallback;
      recomputeCustomer(c);
      db.addAudit({ actor: actor(ctx.user), action: 'assignment.ended', entity: 'assignment', entityId: d.id, branchId: c.branchId, before: { user: db.userById(d.userId)?.employeeCode, customer: c.item.code }, after: { assignee: d.fallback?.name ?? null }, reason: '' });
      return new HttpResponse(null, { status: 204 });
    }
    const [areaId, userId] = params.id!.split('~');
    const a = db.areas.find((x) => x.id === areaId);
    if (!a || !a.assignees?.includes(userId!)) return problem(404, 'NOT_FOUND', 'Assignment not found');
    a.assignees = a.assignees.filter((u) => u !== userId);
    db.addAudit({ actor: actor(ctx.user), action: 'assignment.end', entity: 'area', entityId: a.id, branchId: a.branchId, before: { user: db.userById(userId)?.employeeCode, area: a.code }, after: {}, reason: '' });
    return new HttpResponse(null, { status: 204 });
  })),
  http.get(`${BASE}/handovers`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'handover.create');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const status = url.searchParams.get('status');
    return HttpResponse.json(db.handovers.filter((h) => sc.some((b) => db.userById(h.fromUserId)?.branchIds?.includes(b))).filter((h) => !status || h.status === status));
  })),
  http.post(`${BASE}/handovers`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'handover.create');
    if (deny) return deny;
    const b = (await request.json()) as S['HandoverCreate'];
    if (!b.reason || b.reason.length < 10) return problem(400, 'VALIDATION_FAILED', 'Reason must be at least 10 characters');
    if (b.fromUserId === b.toUserId) return problem(400, 'VALIDATION_FAILED', 'Cannot hand over to the same user');
    if (!b.areaIds?.length && !b.customerIds?.length) return problem(400, 'VALIDATION_FAILED', 'Pick at least one area or customer');
    if (db.handovers.some((h) => h.status === 'pending_acceptance' && h.fromUserId === b.fromUserId && h.areaIds?.some((a) => b.areaIds?.includes(a))))
      return problem(409, 'HANDOVER_PENDING', 'A pending handover already covers one of these areas');
    const h: S['Handover'] = {
      ...b, id: db.oid('6770'), status: 'pending_acceptance', createdBy: ctx.user.id, createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(), summary: db.handoverSummary(b.areaIds ?? []),
    };
    db.handovers.unshift(h);
    db.addAudit({ actor: actor(ctx.user), action: 'handover.create', entity: 'handover', entityId: h.id, branchId: db.userById(b.fromUserId)?.branchIds?.[0], before: {}, after: { from: db.userById(b.fromUserId)?.employeeCode, to: db.userById(b.toUserId)?.employeeCode, customers: h.summary?.customers }, reason: b.reason });
    return HttpResponse.json(h, { status: 201 });
  })),
  http.post(`${BASE}/handovers/:id/cancel`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'handover.create');
    if (deny) return deny;
    const h = db.handovers.find((x) => x.id === params.id);
    if (!h) return problem(404, 'NOT_FOUND', 'Handover not found');
    if (h.status !== 'pending_acceptance') return problem(409, 'HANDOVER_NOT_PENDING', 'Only a pending handover can be cancelled');
    h.status = 'cancelled';
    db.addAudit({ actor: actor(ctx.user), action: 'handover.cancel', entity: 'handover', entityId: h.id, before: { status: 'pending_acceptance' }, after: { status: 'cancelled' }, reason: '' });
    return HttpResponse.json({});
  })),
  // ---------- rbac ----------
  http.get(`${BASE}/rbac/permissions`, authed(() =>
    HttpResponse.json(db.catalog.map((p) => ({ key: p.key, module: p.module, description: { en: p.description, bn: p.description }, defaults: Object.fromEntries(Object.entries(p.defaults).map(([r, v]) => [r, !!v])), reserved: p.reserved }))),
  )),
  http.get(`${BASE}/rbac/users/:userId/effective`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'rbac.view');
    if (deny) return deny;
    const u = db.userById(params.userId);
    if (!u) return problem(404, 'NOT_FOUND', 'User not found');
    return HttpResponse.json(db.effective(u));
  })),
  http.get(`${BASE}/rbac/overrides/branch/:branchId`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'rbac.view');
    if (deny) return deny;
    const items = Object.entries(db.branchOverrides[params.branchId!] ?? {}).flatMap(([role, keys]) =>
      Object.entries(keys ?? {}).map(([key, effect]) => ({ role: role as db.Role, key, effect })),
    );
    return HttpResponse.json({ branchId: params.branchId, items });
  })),
  http.get(`${BASE}/rbac/overrides/user/:userId`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'rbac.view');
    if (deny) return deny;
    const items = Object.entries(db.userOverrides[params.userId!] ?? {}).map(([key, effect]) => ({ key, effect }));
    return HttpResponse.json({ userId: params.userId, items });
  })),
  http.put(`${BASE}/rbac/overrides/branch/:branchId`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'rbac.manage');
    if (deny) return deny;
    const b = (await request.json()) as { role: db.Role; changes: S['OverrideChange'][]; reason: string };
    if (!b.reason || b.reason.length < 5) return problem(400, 'VALIDATION_FAILED', 'Reason required');
    const bo = (db.branchOverrides[params.branchId!] ??= {});
    const ro = (bo[b.role] ??= {});
    const before = { ...ro };
    for (const c of b.changes) {
      if (db.catalog.find((p) => p.key === c.key)?.reserved) return problem(422, 'PERMISSION_RESERVED', 'Reserved permission');
      if (c.effect === 'inherit') delete ro[c.key];
      else ro[c.key] = c.effect;
    }
    db.addAudit({ actor: actor(ctx.user), action: 'rbac.override.branch', entity: 'branch', entityId: params.branchId, branchId: params.branchId, before: { role: b.role, ...before }, after: { role: b.role, ...ro }, reason: b.reason });
    return HttpResponse.json({});
  })),
  http.put(`${BASE}/rbac/overrides/user/:userId`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'rbac.manage');
    if (deny) return deny;
    const b = (await request.json()) as { changes: S['OverrideChange'][]; reason: string };
    const uo = (db.userOverrides[params.userId!] ??= {});
    const before = { ...uo };
    for (const c of b.changes) {
      if (c.effect === 'inherit') delete uo[c.key];
      else uo[c.key] = c.effect;
    }
    const u = db.userById(params.userId);
    db.addAudit({ actor: actor(ctx.user), action: 'rbac.override.set', entity: 'user', entityId: params.userId, branchId: u?.branchIds?.[0], before, after: { ...uo }, reason: b.reason });
    return HttpResponse.json({});
  })),

  // ---------- activity (FR-ACT-001, 1.28.0) ----------
  http.get(`${BASE}/activity`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'activity.view');
    if (deny) return deny;
    const type = url.searchParams.get('type');
    if (type && !['collection', 'visit', 'promise', 'pin', 'collection_withdrawn', 'collection_edited', 'deposit_deleted'].includes(type)) return problem(400, 'VALIDATION_FAILED', 'type');
    const userId = url.searchParams.get('userId');
    const sc = scope(ctx, url);
    const mine = db.activity.filter((a) => !a.branchId || sc.includes(a.branchId));
    const seen = db.activitySeen.get(ctx.user.id!) ?? null;
    const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 30) || 30);
    const cursor = url.searchParams.get('cursor');
    const all = mine.filter((a) => (!type || a.type === type) && (!userId || a.actor?.id === userId));
    const start = cursor ? all.findIndex((a) => a.id === cursor) + 1 : 0;
    const page = all.slice(start, start + limit).map((a) => ({ ...a, unseen: !seen || a.at > seen }));
    // as the server: the count covers the caller's whole scope, whatever the filters
    const whole = new URL(url.href);
    whole.searchParams.delete('branchId');
    const allSc = scope(ctx, whole);
    const unseen = Math.min(99, db.activity.filter((a) => (!a.branchId || allSc.includes(a.branchId)) && (!seen || a.at > seen)).length);
    return HttpResponse.json({ items: page, unseen, seenAt: seen, nextCursor: start + limit < all.length ? page.at(-1)!.id : null } satisfies S['ActivityFeed']);
  })),
  http.post(`${BASE}/activity/seen`, authed(({ ctx }) => {
    const deny = need(ctx, 'activity.view');
    if (deny) return deny;
    const at = new Date().toISOString();
    db.activitySeen.set(ctx.user.id!, at);
    return HttpResponse.json({ seenAt: at, unseen: 0 });
  })),

  // ---------- settings & flags ----------
  http.get(`${BASE}/settings`, authed(({ url }) => {
    const branchId = url.searchParams.get('branchId');
    return HttpResponse.json({ ...db.settings, ...(branchId ? db.settingOverrides[branchId] : {}) });
  })),
  http.patch(`${BASE}/settings`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'settings.manage');
    if (deny) return deny;
    const b = (await request.json()) as { changes: Record<string, unknown>; reason: string; branchId?: string };
    // as field-api: a key it does not define is refused, and so is a branch value for an org-only setting
    const unknown = Object.keys(b.changes).find((k) => !(k in db.settings));
    if (unknown) return problem(400, 'VALIDATION_FAILED', 'Unknown setting', unknown, { fields: [{ path: unknown, message: 'Unknown setting' }] });
    const orgOnly = b.branchId ? Object.keys(b.changes).find((k) => !db.BRANCH_SETTINGS.has(k)) : undefined;
    if (orgOnly) return problem(422, 'BUSINESS_RULE', 'SETTING_NOT_BRANCH_OVERRIDABLE', orgOnly, { key: orgOnly });
    const target = b.branchId ? (db.settingOverrides[b.branchId] ??= {}) : db.settings;
    const before = Object.fromEntries(Object.keys(b.changes).map((k) => [k, target[k] ?? db.settings[k]]));
    Object.assign(target, b.changes);
    db.addAudit({ actor: actor(ctx.user), action: 'settings.update', entity: 'settings', entityId: b.branchId ?? 'global', before, after: b.changes, reason: b.reason });
    return HttpResponse.json({});
  })),
  http.get(`${BASE}/feature-flags/effective`, authed(({ url, ctx }) => {
    const deny = need(ctx, 'flag.manage');
    if (deny) return deny;
    const branchId = url.searchParams.get('branchId');
    if (!branchId) return problem(400, 'VALIDATION_FAILED', 'branchId is required');
    const flags = Object.fromEntries(db.flags.map((f) => [f.key!, f.branchOverrides?.find((o) => o.branchId === branchId)?.enabled ?? !!f.defaultEnabled]));
    return HttpResponse.json({ branchId, flags });
  })),
  http.get(`${BASE}/feature-flags`, authed(() => HttpResponse.json(db.flags))),
  http.put(`${BASE}/feature-flags/:key`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'flag.manage');
    if (deny) return deny;
    const f = db.flags.find((x) => x.key === params.key);
    if (!f) return problem(404, 'NOT_FOUND', 'Unknown flag');
    if (f.lockedReason) return problem(422, 'FLAG_LOCKED', 'This flag is locked', f.lockedReason);
    const b = (await request.json()) as { defaultEnabled?: boolean; branchOverrides?: { branchId: string; enabled: boolean }[]; reason: string };
    const before = { defaultEnabled: f.defaultEnabled, branchOverrides: f.branchOverrides };
    if (b.defaultEnabled != null) f.defaultEnabled = b.defaultEnabled;
    if (b.branchOverrides) f.branchOverrides = b.branchOverrides;
    db.addAudit({ actor: actor(ctx.user), action: 'flag.set', entity: 'feature_flag', entityId: f.key, before, after: { defaultEnabled: f.defaultEnabled, branchOverrides: f.branchOverrides }, reason: b.reason });
    return HttpResponse.json({});
  })),

  // ---------- customers ----------
  http.get(`${BASE}/customers`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'customer.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const filters = (url.searchParams.get('filter') ?? '').split(',').filter(Boolean);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const assignedTo = url.searchParams.get('assignedTo');
    const areaId = url.searchParams.get('areaId');
    let all = db.customers.filter((c) => sc.includes(c.branchId)).filter(payFilter(url));
    if (areaId) all = all.filter((c) => c.areaId === areaId);
    if (assignedTo) all = all.filter((c) => c.item.assignee?.id === (assignedTo === 'me' ? ctx.user.id : assignedTo));
    if (q) all = all.filter((c) => `${c.item.name?.bn} ${c.item.name?.en} ${c.item.code} ${c.item.phone}`.toLowerCase().includes(q));
    for (const f of filters) {
      all = all.filter((c) => {
        const b = c.item.badges ?? [];
        if (f === 'no_location') return c.item.location?.status !== 'ok';
        if (f === 'unassigned') return !c.item.assignee?.id;
        return b.includes(f as S['CustomerStatus']);
      });
    }
    const sort = url.searchParams.get('sort') ?? '-daysOverdue';
    const key: Record<string, (c: db.MockCustomer) => number | string> = {
      '-daysOverdue': (c) => -(c.item.daysOverdue ?? 0), name: (c) => c.item.name?.en ?? '', '-totalOutstanding': (c) => -(c.item.totalOutstandingPoisha ?? 0), nextDueDate: (c) => c.item.nextDueDate ?? '9999',
    };
    const k = key[sort] ?? key['-daysOverdue']!;
    all = [...all].sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0));
    const p = page(all.map((c) => ({ ...c.item, ...mockActivity(c) })), url);
    // like field-api: `total` (and since 1.24.0 `invoiceTotals`) only when asked for (includeTotal=true)
    if (url.searchParams.get('includeTotal') === 'true') {
      const counts = all.map((c) => ({ ...mockActivity(c).invoiceCount, inst: c.item.openInvoices?.installment ?? 0, credit: c.item.openInvoices?.credit ?? 0 }));
      const sum = (f: (x: (typeof counts)[number]) => number) => counts.reduce((n, x) => n + f(x), 0);
      return HttpResponse.json({ ...p, invoiceTotals: { total: sum((x) => x.total ?? 0), open: sum((x) => x.open ?? 0), installmentOpen: sum((x) => x.inst), creditOpen: sum((x) => x.credit) } });
    }
    const { total: _total, ...rest } = p;
    void _total;
    return HttpResponse.json(rest);
  })),
  http.get(`${BASE}/customers/:id`, authed(({ params, ctx }) => {
    const c = db.customerById(params.id!);
    if (!c || !custBranchOk(ctx, c)) return problem(404, 'NOT_FOUND', 'Customer not found');
    recomputeCustomer(c);
    return HttpResponse.json({ ...c.detail, ...mockActivity(c) }, { headers: { ETag: `"${c.detail.version}"` } });
  })),
  http.post(`${BASE}/customers/:id/refresh`, authed(({ params }) => {
    const c = db.customerById(params.id!)!;
    c.item.erpFetchedAt = new Date().toISOString();
    c.detail.erpFetchedAt = c.item.erpFetchedAt;
    recomputeCustomer(c);
    return HttpResponse.json(c.detail);
  })),
  http.get(`${BASE}/customers/:id/timeline`, authed(({ params, url }) => {
    const c = db.customerById(params.id!)!;
    const items: S['TimelineItem'][] = [
      ...(c.detail.payments ?? []).slice(0, 12).map((p) => ({ kind: 'erp_payment' as const, at: `${p.date}T06:00:00Z`, actor: { name: p.source === 'field' ? c.item.assignee?.name : 'Office' }, summary: { bn: `ERP পেমেন্ট ${p.receiptNo}`, en: `ERP payment ${p.receiptNo}` }, refId: p.erpPaymentId, data: { amountPoisha: p.amountPoisha, method: p.method, source: p.source } })),
      ...(c.detail.pendingCollections ?? []).map((col) => ({ kind: 'collection' as const, at: col.recordedAt, actor: col.collector, summary: { bn: `মাঠে আদায় ${col.receiptNo}`, en: `Field collection ${col.receiptNo}` }, refId: col.id, data: { amountPoisha: col.amountPoisha, method: col.method, status: col.status } })),
      ...(c.detail.recentNotes ?? []).map((n) => ({ kind: 'note' as const, at: n.createdAt, actor: n.author, summary: { bn: n.text, en: n.text }, refId: n.id, data: { category: n.category } })),
      ...c.tagHistory.map((e) => ({ kind: 'tag' as const, at: e.at, actor: e.actor, summary: { bn: e.next?.state === 'tagged' ? 'খারাপ গ্রাহক হিসেবে ট্যাগ' : 'ট্যাগ সরানো হয়েছে', en: e.next?.state === 'tagged' ? 'Tagged as bad customer' : 'Tag removed' }, refId: e.id, data: { reason: e.reason } })),
      ...(c.item.lastVisitAt ? [{ kind: 'visit' as const, at: c.item.lastVisitAt, actor: c.item.assignee, summary: { bn: 'ভিজিট — বাড়িতে পাওয়া যায়নি', en: 'Visit — not at home' }, refId: 'v1', data: { outcome: 'not_home' } }] : []),
      ...(c.item.openPromise ? [{ kind: 'promise' as const, at: c.item.openPromise.createdAt, actor: c.item.assignee, summary: { bn: 'পরিশোধের প্রতিশ্রুতি', en: 'Promise to pay' }, refId: c.item.openPromise.id, data: { promisedDate: c.item.openPromise.promisedDate, amountPoisha: c.item.openPromise.promisedAmountPoisha } }] : []),
    ].sort((a, b) => ((a.at ?? '') < (b.at ?? '') ? 1 : -1));
    const p = page(items, url, 30);
    return HttpResponse.json({ items: p.items, nextCursor: p.nextCursor });
  })),
  http.get(`${BASE}/customers/:id/contact-attempts`, authed(({ params }) => {
    const c = db.customerById(params.id!);
    if (!c) return problem(404, 'NOT_FOUND', 'Customer not found');
    // deterministic per customer: derived from the id, no numbers stored (FR-M-014)
    const seed = [...c.item.id!].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 9973, 7);
    const outcomes = ['connected', 'no_answer', 'busy', 'switched_off', 'connected', 'no_answer'] as const;
    const n = (c.item.daysOverdue ?? 0) > 0 ? 2 + (seed % 6) : seed % 2;
    const items: S['ContactAttempt'][] = Array.from({ length: n }, (_, i) => {
      const sms = (seed + i) % 4 === 3;
      const outcome = sms ? ('sent' as const) : outcomes[(seed + i * 5) % outcomes.length]!;
      const at = new Date(Date.now() - (i * 26 + (seed % 9) + 1) * 3600_000).toISOString();
      return {
        id: `ca-${c.item.id}-${i}`, clientId: `00000000-0000-4000-8000-${String(seed * 100 + i).padStart(12, '0')}`, customerId: c.item.id!, userId: c.item.assignee?.id,
        // 1.12.0: every fifth call of an overdue customer went to the guarantor (no phone slot)
        ...(!sms && i % 5 === 4 ? { channel: 'call' as const, target: 'guarantor' as const } : { channel: sms ? ('sms' as const) : ('call' as const), target: 'customer' as const, phoneIndex: i % 3 === 2 ? 1 : 0 }), at, receivedAt: at,
        durationSec: outcome === 'connected' ? 40 + ((seed * (i + 3)) % 400) : null, outcome,
        note: outcome === 'connected' && i === 0 ? 'সামনের সপ্তাহে দেবেন বলেছেন' : undefined,
      };
    });
    return HttpResponse.json(items);
  })),
  http.get(`${BASE}/customers/:id/tag-history`, authed(({ params }) => HttpResponse.json(db.customerById(params.id!)?.tagHistory ?? []))),
  http.put(`${BASE}/customers/:id/tag`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'tag.set');
    if (deny) return deny;
    const c = db.customerById(params.id!);
    if (!c) return problem(404, 'NOT_FOUND', 'Customer not found');
    const b = (await request.json()) as { state: 'tagged' | 'none'; severity?: S['Tag']['severity']; reasonCode: string; reason: string };
    if (!b.reason || b.reason.length < 10) return problem(400, 'VALIDATION_FAILED', 'Reason must be at least 10 characters');
    const prev = { ...c.item.tag };
    const next: S['Tag'] = b.state === 'tagged' ? { state: 'tagged', severity: b.severity ?? 'bad', reasonCode: b.reasonCode, reason: b.reason, setBy: ctx.user.id, setAt: new Date().toISOString() } : { state: 'none' };
    c.item.tag = next;
    const badges = (c.item.badges ?? []).filter((x) => x !== 'tagged_bad' && x !== 'bad_suggested');
    const suggested = c.detail.plans?.some((p) => p.badSuggested);
    c.item.badges = b.state === 'tagged' ? ['tagged_bad', ...badges] : suggested ? ['bad_suggested', ...badges] : badges;
    const ev: S['TagEvent'] = { id: db.oid('6770'), previous: prev, next, reasonCode: b.reasonCode, reason: b.reason, actor: actor(ctx.user), source: 'web', at: new Date().toISOString() };
    c.tagHistory.unshift(ev);
    c.detail.version = (c.detail.version ?? 1) + 1;
    recomputeCustomer(c);
    db.addAudit({ actor: actor(ctx.user), action: b.state === 'tagged' ? 'tag.set' : 'tag.clear', entity: 'customer', entityId: c.item.id, branchId: c.branchId, before: prev as Record<string, unknown>, after: next as Record<string, unknown>, reason: b.reason });
    return HttpResponse.json({ tag: next, eventId: ev.id });
  })),

  // ---------- collections ----------
  http.get(`${BASE}/collections`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'collection.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const sp = url.searchParams;
    let all = db.collections.filter((c) => sc.includes(db.collectionBranch(c) ?? ''));
    const from = sp.get('from');
    const to = sp.get('to');
    if (from) all = all.filter((c) => c.recordedAt! >= new Date(`${from}T00:00:00+06:00`).toISOString());
    if (to) all = all.filter((c) => c.recordedAt! < new Date(new Date(`${to}T00:00:00+06:00`).getTime() + 86400000).toISOString());
    for (const [k, f] of [['method', (c: S['Collection'], v: string) => c.method === v], ['status', (c: S['Collection'], v: string) => v.split(',').includes(c.status!)], ['collectorId', (c: S['Collection'], v: string) => c.collector?.id === v], ['customerId', (c: S['Collection'], v: string) => c.customer?.id === v], ['flag', (c: S['Collection'], v: string) => !!c.flags?.includes(v as never)]] as const) {
      const v = sp.get(k);
      if (v) all = all.filter((c) => f(c, v));
    }
    all = [...all].sort((a, b) => (a.recordedAt! < b.recordedAt! ? 1 : -1));
    const totals: Record<string, number> = {};
    for (const c of all) if (!['voided', 'resolved_voided', 'resolved_refund'].includes(c.status!)) totals[c.method!] = (totals[c.method!] ?? 0) + c.amountPoisha!;
    const p = page(all, url);
    return HttpResponse.json({ items: p.items, nextCursor: p.nextCursor, totals });
  })),
  http.get(`${BASE}/collections/conflicts`, authed(({ ctx, url }) => {
    const sc = scope(ctx, url);
    const all = db.collections.filter((c) => (c.status === 'conflict' || c.status === 'posting_failed') && sc.includes(db.collectionBranch(c) ?? '')).sort((a, b) => (a.receivedAt! < b.receivedAt! ? -1 : 1));
    const p = page(all, url);
    const items = p.items.map((c) => ({ ...c, cashOnHand: db.cashPositions.find((x) => x.userId === c.collector?.id) }));
    return HttpResponse.json({ items, nextCursor: p.nextCursor });
  })),
  http.get(`${BASE}/collections/:id`, authed(({ params }) => {
    const c = db.collections.find((x) => x.id === params.id);
    if (!c) return problem(404, 'NOT_FOUND', 'Collection not found');
    const pos = db.cashPositions.find((p) => p.userId === c.collector?.id);
    return HttpResponse.json({ ...c, cashOnHand: pos });
  })),
  http.post(`${BASE}/collections/:id/resolve`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'collection.resolve');
    if (deny) return deny;
    const key = request.headers.get('Idempotency-Key');
    if (!key) return problem(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header required');
    if (idem.has(key)) return HttpResponse.json(idem.get(key), { headers: { 'Idempotent-Replayed': 'true' } });
    const c = db.collections.find((x) => x.id === params.id);
    if (!c) return problem(404, 'NOT_FOUND', 'Collection not found');
    if (c.status !== 'conflict' && c.status !== 'posting_failed') return problem(409, 'ALREADY_RESOLVED', 'This collection is already resolved');
    const b = (await request.json()) as { action: string; erpPlanId?: string; reason: string; proofMediaId?: string };
    if (b.action === 'refund' && !b.proofMediaId) return problem(422, 'BUSINESS_RULE', 'PROOF_REQUIRED');
    const before = { status: c.status };
    const map: Record<string, S['CollectionStatus']> = { post_to_plan: 'resolved_posted', post_as_advance: 'resolved_posted', retry_post: 'posted', refund: 'resolved_refund', void: 'resolved_voided' };
    c.status = map[b.action] ?? 'resolved_posted';
    if (c.status === 'resolved_posted' || c.status === 'posted') c.erpReceiptNo = `R-${Math.floor(80000 + Math.random() * 19999)}`;
    if (b.erpPlanId) c.erpPlanId = b.erpPlanId;
    c.resolution = { action: b.action, by: ctx.user.id, at: new Date().toISOString(), reason: b.reason };
    const cust = db.customerById(c.customer!.id!);
    if (cust) {
      cust.item.pendingFieldPoisha = Math.max(0, (cust.item.pendingFieldPoisha ?? 0) - c.amountPoisha!);
      cust.detail.pendingCollections = cust.detail.pendingCollections?.filter((x) => x.id !== c.id);
    }
    db.inbox.filter((i) => i.entityId === c.id && i.status === 'open').forEach((i) => (i.status = 'resolved'));
    db.addAudit({ actor: actor(ctx.user), action: 'collection.resolve', entity: 'collection', entityId: c.id, branchId: db.collectionBranch(c), before, after: { status: c.status, action: b.action, erpPlanId: c.erpPlanId }, reason: b.reason });
    idem.set(key, c);
    return HttpResponse.json(c);
  })),
  http.post(`${BASE}/collections/:id/void`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'collection.void');
    if (deny) return deny;
    const c = db.collections.find((x) => x.id === params.id)!;
    if (c.status === 'posted' || c.status === 'resolved_posted') return problem(409, 'ALREADY_POSTED', 'Posted collections must be reversed in the ERP');
    const b = (await request.json()) as { reason: string };
    const before = { status: c.status };
    c.status = 'voided';
    c.voided = { by: ctx.user.id!, byName: ctx.user.name?.en ?? '', at: new Date().toISOString(), reason: b.reason, kind: 'admin' };
    db.addAudit({ actor: actor(ctx.user), action: 'collection.void', entity: 'collection', entityId: c.id, branchId: db.collectionBranch(c), before, after: { status: 'voided' }, reason: b.reason });
    return HttpResponse.json({});
  })),

  // ---------- cash ----------
  http.get(`${BASE}/cash/positions/:id/collections`, authed(({ ctx, url, params }) => {
    // FR-CASH-007 (1.27.0): the newest cash collections add up to the position (deposits pay off the oldest first)
    const pos = db.cashPositions.find((p) => p.userId === params.id);
    const u = db.userById(String(params.id));
    if (!pos || !u || !scope(ctx, url).includes(u.branchIds?.[0] ?? '') || (ctx.user.role === 'field_staff' && ctx.user.id !== u.id)) return problem(404, 'NOT_FOUND', 'User not found');
    // 1.35.0: a collection a deposit took (`depositId`) is out of hand
    const cash = db.collections.filter((c) => c.collector?.id === u.id && c.method === 'cash' && !c.depositId && !['voided', 'resolved_voided', 'resolved_refund'].includes(c.status!)).sort((a, b) => (a.recordedAt! < b.recordedAt! ? 1 : -1));
    let left = pos.onHandPoisha ?? 0;
    const items: S['CashInHandItem'][] = [];
    for (const c of cash) {
      if (left <= 0) break;
      const part = Math.min(left, c.amountPoisha ?? 0);
      left -= part;
      items.push({ ...mockCashLine(c), inHandPoisha: part });
    }
    return HttpResponse.json({ userId: u.id!, userName: pos.userName ?? '', onHandPoisha: (pos.onHandPoisha ?? 0) - left, pendingDepositsPoisha: pos.pendingDepositsPoisha ?? 0, count: items.length, items, generatedAt: new Date().toISOString() } satisfies S['CashInHand']);
  })),
  // FR-CASH-008 (1.30.0): the collections one deposit covered (oldest first), and the promise behind each line
  http.get(`${BASE}/cash/deposits/:id/collections`, authed(({ ctx, url, params }) => {
    const dep = db.deposits.find((d) => d.id === params.id);
    const u = dep ? db.userById(dep.userId!) : undefined;
    if (!dep || !u || !scope(ctx, url).includes(u.branchIds?.[0] ?? '') || (ctx.user.role === 'field_staff' && ctx.user.id !== u.id)) return problem(404, 'NOT_FOUND', 'Deposit not found');
    // FR-CASH-010 (1.35.0): a submitted deposit lists every collection it took, whole, with method and ERP state
    if (dep.status === 'submitted') {
      const taken = db.collections.filter((c) => c.depositId === dep.id).sort((a, b) => (a.recordedAt! < b.recordedAt! ? -1 : 1));
      const lines = taken.map((c) => ({ ...mockCashLine(c), coveredPoisha: c.amountPoisha!, method: c.method!, erpReceiptNo: c.erpReceiptNo ?? null }));
      return HttpResponse.json({ deposit: { ...dep, userName: u.name?.en ?? '' }, coveredPoisha: taken.filter((c) => c.method === 'cash').reduce((n, c) => n + c.amountPoisha!, 0), unmatchedPoisha: 0, items: lines, generatedAt: new Date().toISOString() } satisfies S['DepositCoverage']);
    }
    const cash = db.collections.filter((c) => c.collector?.id === u.id && c.method === 'cash' && !c.depositId && !['voided', 'resolved_voided', 'resolved_refund'].includes(c.status!)).sort((a, b) => (a.recordedAt! < b.recordedAt! ? -1 : 1));
    const order = db.deposits.filter((d) => d.userId === u.id && (d.status === 'pending' || d.status === 'verified')).sort((a, b) => (a.depositedAt! < b.depositedAt! ? -1 : 1));
    let skip = order.slice(0, order.findIndex((d) => d.id === dep.id)).reduce((n, d) => n + (d.amountPoisha ?? 0), 0);
    let left = dep.status === 'rejected' || dep.status === 'deleted' ? 0 : (dep.amountPoisha ?? 0);
    const items: S['DepositCoverage']['items'] = [];
    for (const c of cash) {
      const skipped = Math.min(skip, c.amountPoisha ?? 0);
      skip -= skipped;
      const free = (c.amountPoisha ?? 0) - skipped;
      if (free <= 0) continue;
      if (left <= 0) break;
      const covered = Math.min(left, free);
      left -= covered;
      items.push({ ...mockCashLine(c), inHandPoisha: free - covered, coveredPoisha: covered });
    }
    return HttpResponse.json({ deposit: { ...dep, userName: u.name?.en ?? '' }, coveredPoisha: items.reduce((n, i) => n + i.coveredPoisha, 0), unmatchedPoisha: left, items, generatedAt: new Date().toISOString() } satisfies S['DepositCoverage']);
  })),
  http.get(`${BASE}/cash/positions`, authed(({ ctx, url }) => {
    const sc = scope(ctx, url);
    return HttpResponse.json(db.cashPositions.filter((p) => sc.includes(db.userById(p.userId)?.branchIds?.[0] ?? '')));
  })),
  http.get(`${BASE}/cash/deposits`, authed(({ ctx, url }) => {
    const sc = scope(ctx, url);
    const st = url.searchParams.get('status');
    const all = db.deposits.filter((d) => sc.includes(db.userById(d.userId)?.branchIds?.[0] ?? '')).filter((d) => !st || d.status === st).sort((a, b) => (a.depositedAt! < b.depositedAt! ? 1 : -1));
    const p = page(all, url);
    return HttpResponse.json({ items: p.items, nextCursor: p.nextCursor });
  })),
  // 1.35.0 (ADR-049): a deposit is final; verify, reject and delete answer 409 INVALID_STATE DEPOSIT_FINAL (404 out of scope)
  ...(['verify', 'reject', 'delete'] as const).map((action) =>
    http.post(`${BASE}/cash/deposits/:id/${action}`, authed(({ params, ctx, url }) => {
      const d = db.deposits.find((x) => x.id === params.id);
      if (!d || !scope(ctx, url).includes(db.userById(d.userId)?.branchIds?.[0] ?? '')) return problem(404, 'NOT_FOUND', 'Deposit not found');
      return problem(409, 'INVALID_STATE', 'A deposit is final', 'DEPOSIT_FINAL', { reason: 'DEPOSIT_FINAL' });
    })),
  ),

  // ---------- inbox / dashboard / search ----------
  http.get(`${BASE}/inbox`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'inbox.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const st = url.searchParams.get('status') ?? 'open';
    const type = url.searchParams.get('type');
    const inScope = db.inbox.filter((i) => !i.branchId || sc.includes(i.branchId));
    const sev = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const all = inScope.filter((i) => i.status === st).filter((i) => !type || i.type?.startsWith(type)).sort((a, b) => sev[a.severity!] - sev[b.severity!] || (a.createdAt! < b.createdAt! ? -1 : 1));
    const counts: Record<string, number> = { open: 0, critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of inScope.filter((x) => x.status === 'open')) {
      counts.open!++;
      counts[i.severity!]!++;
    }
    const p = page(all, url, 50);
    return HttpResponse.json({ items: p.items, counts, nextCursor: p.nextCursor });
  })),
  http.post(`${BASE}/inbox/:id/resolve`, authed(async ({ request, params, ctx }) => {
    const i = db.inbox.find((x) => x.id === params.id)!;
    const b = (await request.json().catch(() => ({}))) as { reason?: string };
    i.status = 'resolved';
    db.addAudit({ actor: actor(ctx.user), action: 'inbox.resolve', entity: 'inbox', entityId: i.id, reason: b.reason ?? '' });
    return HttpResponse.json({});
  })),
  http.post(`${BASE}/inbox/:id/snooze`, authed(({ params }) => {
    const i = db.inbox.find((x) => x.id === params.id)!;
    i.status = 'snoozed';
    return HttpResponse.json({});
  })),
  http.get(`${BASE}/dashboard/overview`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'report.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const startToday = db.now().startOf('day').toUTC().toISO()!;
    const inScopeCol = db.collections.filter((c) => sc.includes(db.collectionBranch(c) ?? '') && !['voided', 'resolved_voided', 'resolved_refund'].includes(c.status!));
    const todayCol = inScopeCol.filter((c) => c.recordedAt! >= startToday);
    const sum = (a: S['Collection'][]) => a.reduce((s, c) => s + c.amountPoisha!, 0);
    const staffIn = db.staff.filter((s) => s.active && sc.includes(s.branchIds?.[0] ?? ''));
    const cust = db.customers.filter((c) => sc.includes(c.branchId));
    const pos = db.cashPositions.filter((p) => sc.includes(db.userById(p.userId)?.branchIds?.[0] ?? ''));
    const trend7d = Array.from({ length: 7 }).map((_, i) => {
      const d = db.now().minus({ days: 6 - i }).startOf('day');
      const s = d.toUTC().toISO()!;
      const e = d.plus({ days: 1 }).toUTC().toISO()!;
      const dayCol = inScopeCol.filter((c) => c.recordedAt! >= s && c.recordedAt! < e);
      return { date: d.toISODate()!, collectedPoisha: sum(dayCol), visits: Math.round(dayCol.length * 1.7) };
    });
    const present = Math.round(staffIn.length * 0.9);
    const goals = staffIn.map((u) => db.staffTarget(u, db.today()));
    const perf = perfRows(sc, false, db.today());
    const out: S['DashboardOverview'] = {
      date: db.today(),
      collected: { totalPoisha: sum(todayCol), cashPoisha: sum(todayCol.filter((c) => c.method === 'cash')), mobilePoisha: sum(todayCol.filter((c) => c.method !== 'cash')), count: todayCol.length, targetPoisha: goals.reduce((a, g) => a + (g.amountPoisha ?? 0), 0) },
      visits: { count: Math.round(todayCol.length * 1.8), uniqueCustomers: Math.round(todayCol.length * 1.5), credit: Math.round(perf.reduce((a, r) => a + (r.visitCredit ?? 0), 0) * 100) / 100, target: goals.reduce((a, g) => a + (g.visits ?? 0), 0) },
      promises: { dueToday: cust.filter((c) => c.item.badges?.includes('promised_today')).length, keptToday: 3, brokenYesterday: 2 },
      attendance: { present, late: Math.max(1, Math.round(staffIn.length * 0.1)), absent: staffIn.length - present, onDutyNow: present - 1 },
      cash: { onHandPoisha: pos.reduce((s, p) => s + p.onHandPoisha!, 0), overLimitStaff: pos.filter((p) => p.state === 'exceeded').length, pendingDeposits: db.deposits.filter((d) => d.status === 'pending' && sc.includes(db.userById(d.userId)?.branchIds?.[0] ?? '')).length },
      exceptions: { conflicts: inScopeCol.filter((c) => c.status === 'conflict').length, postingFailed: inScopeCol.filter((c) => c.status === 'posting_failed').length, mockLocation: inScopeCol.filter((c) => c.flags?.includes('mock_location')).length },
      overdue: { customers: cust.filter((c) => (c.item.daysOverdue ?? 0) > 0).length, amountPoisha: cust.filter((c) => (c.item.daysOverdue ?? 0) > 0).reduce((s, c) => s + c.item.totalOutstandingPoisha!, 0), badSuggested: cust.filter((c) => c.item.badges?.includes('bad_suggested')).length, tagged: cust.filter((c) => c.item.tag?.state === 'tagged').length },
      erp: { ...db.erpStatus, lastSuccessAt: new Date(Date.now() - 3 * 60_000).toISOString() },
      trend7d,
    };
    return HttpResponse.json(out);
  })),
  // ---------- daily targets (FR-COL-015, contract 1.10.0) ----------
  http.get(`${BASE}/targets`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'target.view');
    if (deny) return deny;
    const req = url.searchParams.get('branchId');
    const sc = scope(ctx, url);
    const branchId = req ?? sc[0] ?? '';
    if (!sc.includes(branchId)) return problem(404, 'NOT_FOUND', 'Branch not found');
    const date = url.searchParams.get('date') ?? db.today();
    const items = db.staff.filter((u) => u.active && u.branchIds?.[0] === branchId).map((u) => db.staffTarget(u, date)).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    return HttpResponse.json({ branchId, date, defaults: db.branchDefault(branchId, date), items } satisfies S['BranchTargets']);
  })),
  http.get(`${BASE}/targets/users/:id/history`, authed(({ ctx, params }) => {
    const deny = need(ctx, 'target.view');
    if (deny) return deny;
    const u = db.userById(String(params.id));
    if (!u || !scope(ctx, new URL('http://x/')).includes(u.branchIds?.[0] ?? '')) return problem(404, 'NOT_FOUND', 'Staff not found');
    const rows = db.targetChanges.filter((t) => t.userId === u.id).sort((a, b) => b.setAt.localeCompare(a.setAt));
    return HttpResponse.json(rows satisfies S['TargetChange'][]);
  })),
  ...(['user', 'clear', 'branch'] as const).map((kind) =>
    (kind === 'clear' ? http.post : http.put)(`${BASE}/targets/${kind === 'branch' ? 'branches' : 'users'}/:id${kind === 'clear' ? '/clear' : ''}`, authed(async ({ ctx, params, request }) => {
      const deny = need(ctx, 'target.manage');
      if (deny) return deny;
      const b = (await request.json()) as { amountPoisha?: number; visits?: number; effectiveFrom?: string; reason?: string };
      const sc = scope(ctx, new URL('http://x/'));
      const u = kind === 'branch' ? undefined : db.userById(String(params.id));
      const branchId = kind === 'branch' ? String(params.id) : (u?.branchIds?.[0] ?? '');
      if (!sc.includes(branchId) || (kind !== 'branch' && (!u || u.role !== 'field_staff' || !u.active))) return problem(404, 'NOT_FOUND', kind === 'branch' ? 'Branch not found' : 'Staff not found');
      const reason = (b.reason ?? '').trim();
      const errors: Record<string, string> = {};
      if (reason.length < 3 || reason.length > 300) errors.reason = 'Between 3 and 300 characters';
      if (kind !== 'clear') {
        if (!Number.isInteger(b.amountPoisha) || b.amountPoisha! < 0) errors.amountPoisha = 'A whole number of poisha, 0 or more';
        if (typeof b.visits !== 'number' || b.visits < 0 || b.visits > 100) errors.visits = 'Between 0 and 100';
      }
      if (Object.keys(errors).length) return problem(422, 'VALIDATION_FAILED', 'Check the highlighted fields', undefined, { fields: errors });
      const from = b.effectiveFrom ?? db.today();
      if (from < db.today()) return problem(422, 'BUSINESS_RULE', 'Targets of past days cannot change', 'TARGET_IN_PAST', { rule: 'TARGET_IN_PAST' });
      const setBy = { id: ctx.user.id!, name: ctx.user.name?.en ?? '' };
      const row = db.addTarget({
        userId: u?.id ?? null, branchId, kind: kind === 'clear' ? 'cleared' : 'set', amountPoisha: kind === 'clear' ? null : b.amountPoisha!, visits: kind === 'clear' ? null : b.visits!,
        effectiveFrom: from, reason, setBy,
      });
      const action = kind === 'branch' ? 'target.branch_set' : kind === 'clear' ? 'target.cleared' : 'target.set';
      db.addAudit({ actor: actor(ctx.user), action, entity: kind === 'branch' ? 'branch' : 'user', entityId: kind === 'branch' ? branchId : u!.id, after: { amountPoisha: row.amountPoisha, visits: row.visits, effectiveFrom: from }, reason });
      return HttpResponse.json(kind === 'branch' ? db.branchDefault(branchId, from) : db.staffTarget(u!, from));
    })),
  ),
  http.get(`${BASE}/reports/staff-performance`, authed(({ ctx, url }) => {
    const rows = perfRows(scope(ctx, url), url.searchParams.get('period') === 'monthly', url.searchParams.get('date') ?? db.today());
    rows.sort((a, b) => (b.collectedPoisha?.total ?? 0) - (a.collectedPoisha?.total ?? 0));
    return HttpResponse.json(rows);
  })),
  http.get(`${BASE}/reports/collection-board`, authed(({ ctx, url }) => {
    // FR-REP-007 (1.26.0): verified money per collector; every branch unless reports.leaderboardScope = branch
    const own = ctx.user.branchIds?.[0];
    if (!perms(ctx.user).has('report.view') && !(own && db.settings['reports.leaderboardVisibleToStaff'])) return problem(403, 'FORBIDDEN', 'The leaderboard is not visible to you', 'report.view');
    const period = url.searchParams.get('period');
    if (period !== 'month' && period !== 'all') return problem(400, 'VALIDATION_FAILED', 'period must be month or all');
    const today = db.today();
    const month = period === 'month' ? (url.searchParams.get('month') ?? today.slice(0, 7)) : null;
    if (month && (!/^\d{4}-\d{2}$/.test(month) || `${month}-01` > today)) return problem(400, 'VALIDATION_FAILED', 'this month or earlier (YYYY-MM)');
    const everywhere = db.settings['reports.leaderboardScope'] !== 'branch';
    const asked = url.searchParams.get('branchId');
    const allowed = everywhere || ctx.user.role === 'super_admin' ? db.branches.map((b) => b.id!) : (ctx.user.branchIds ?? []);
    if (asked && !allowed.includes(asked)) return problem(404, 'NOT_FOUND', 'Branch not found');
    const inView = asked ? [asked] : allowed;
    const sums = new Map<string, { postedPoisha: number; count: number }>();
    for (const c of db.collections) {
      if (c.status !== 'posted' && c.status !== 'resolved_posted') continue;
      if (!inView.includes(db.collectionBranch(c) ?? '') || (month && !c.recordedAt!.startsWith(month))) continue;
      const s = sums.get(c.collector!.id!) ?? { postedPoisha: 0, count: 0 };
      s.postedPoisha += c.amountPoisha ?? 0;
      s.count++;
      sums.set(c.collector!.id!, s);
    }
    const people = new Set([...sums.keys(), ...db.staff.filter((u) => u.active && u.branchIds?.some((b) => inView.includes(b))).map((u) => u.id!)]);
    const items: S['CollectionBoardRow'][] = [...people].flatMap((id) => {
      const u = db.userById(id);
      if (!u) return [];
      const p = sums.get(id) ?? { postedPoisha: 0, count: 0 };
      return [{ rank: null, userId: id, name: { bn: u.name?.bn ?? '', en: u.name?.en ?? '' }, employeeCode: u.employeeCode ?? '', role: u.role!, branchId: u.branchIds?.[0] ?? null, postedPoisha: p.postedPoisha, count: p.count, me: id === ctx.user.id }];
    });
    const byName = (a: S['CollectionBoardRow'], b: S['CollectionBoardRow']) => (a.name.en ?? '').localeCompare(b.name.en ?? '');
    const ranked = items.filter((r) => r.postedPoisha > 0).sort((a, b) => b.postedPoisha - a.postedPoisha || byName(a, b));
    ranked.forEach((r, i) => (r.rank = i > 0 && ranked[i - 1]!.postedPoisha === r.postedPoisha ? ranked[i - 1]!.rank : i + 1));
    const rest = items.filter((r) => r.postedPoisha === 0).sort(byName);
    const mine = ranked.find((r) => r.me) ?? rest.find((r) => r.me);
    return HttpResponse.json({
      period, month, scope: everywhere ? 'all' : 'branch', branchId: asked, generatedAt: new Date().toISOString(), items: [...ranked, ...rest],
      me: mine ? { rank: mine.rank, of: ranked.length, postedPoisha: mine.postedPoisha } : null,
    } satisfies S['CollectionBoard']);
  })),
  http.get(`${BASE}/reports/leaderboard`, authed(({ ctx, url }) => {
    // FR-REP-005: managers with report.view; field staff only when the setting allows it
    const staffView = ctx.user.role === 'field_staff';
    if (staffView ? !db.settings['reports.leaderboardVisibleToStaff'] : !perms(ctx.user).has('report.view')) return problem(403, 'FORBIDDEN', 'The leaderboard is not visible to you', 'report.view');
    // without a branchId the board covers every branch in scope (branchId null); field staff always get their own branch
    const asked = staffView ? (ctx.user.branchIds?.[0] ?? '') : url.searchParams.get('branchId');
    const sc = asked ? [asked] : scope(ctx, url);
    if (asked && !(staffView || scope(ctx, url).includes(asked))) return problem(404, 'NOT_FOUND', 'Branch not found');
    const branchId = asked || null;
    const period = url.searchParams.get('period') === 'day' ? 'day' : 'month';
    const metric = (url.searchParams.get('metric') ?? 'collected') as S['Leaderboard']['metric'];
    const raw = url.searchParams.get('date');
    const today = db.today();
    const date = period === 'month' ? (raw && /^\d{4}-\d{2}$/.test(raw) ? raw : today.slice(0, 7)) : raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
    const end = period === 'month' ? (date === today.slice(0, 7) ? today : new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10)) : date;
    if (end > today) return problem(422, 'BUSINESS_RULE', 'Future period', 'DATE_IN_FUTURE');
    const min = Number(db.settings['reports.leaderboardMinPresentDays'] ?? 1);
    const rows = perfRows(sc, period === 'month', end);
    const valueOf = (r: S['StaffPerformanceRow']) =>
      metric === 'collected' ? (r.collectedPoisha?.total ?? 0) : metric === 'visit_credit' ? (r.visitCredit ?? 0) : metric === 'promises_kept' ? (r.promisesKept ?? 0) : (r.amountAchievement ?? null);
    const items: S['LeaderboardRow'][] = rows.map((r) => {
      const value = valueOf(r);
      const eligible = (r.presentDays ?? 0) >= min && value !== null;
      return {
        rank: null, userId: r.userId, name: r.name, employeeCode: db.userById(r.userId)?.employeeCode, value, collectedPoisha: r.collectedPoisha?.total ?? 0, visitCredit: r.visitCredit ?? 0,
        promisesKept: r.promisesKept ?? 0, amountAchievement: r.amountAchievement ?? null, presentDays: r.presentDays ?? 0, eligible, me: r.userId === ctx.user.id,
      };
    });
    const ranked = items.filter((r) => r.eligible).sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''));
    ranked.forEach((r, i) => (r.rank = i > 0 && ranked[i - 1]!.value === r.value ? ranked[i - 1]!.rank : i + 1));
    const rest = items.filter((r) => !r.eligible).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    const all = [...ranked, ...rest];
    return HttpResponse.json({ branchId, period, date, metric, minPresentDays: min, items: all, me: all.find((r) => r.me) ?? null } satisfies S['Leaderboard']);
  })),
  http.get(`${BASE}/reports/data-quality`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'report.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const branches = db.branches.filter((b) => sc.includes(b.id!)).map((b) => {
      const cs = db.customers.filter((c) => c.branchId === b.id);
      const found = cs.map((c) => db.qualityFindings(c));
      const issues = Object.fromEntries(db.DQ_ISSUES.map((k) => [k, found.filter((f) => f.some((x) => x.issue === k)).length]));
      return { branchId: b.id, branchName: b.name, customers: cs.length, withIssues: found.filter((f) => f.length).length, issues, maxBranchKm: Number(db.settings['reports.dataQualityMaxBranchKm'] ?? 30) };
    });
    return HttpResponse.json({ generatedAt: new Date(Date.now() - 6 * 60_000).toISOString(), maxBranchKm: Number(db.settings['reports.dataQualityMaxBranchKm'] ?? 30), branches } satisfies S['DataQualitySummary']);
  })),
  http.get(`${BASE}/reports/data-quality/items`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'report.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const issue = url.searchParams.get('issue');
    const rows: S['DataQualityItem'][] = db.customers
      .filter((c) => sc.includes(c.branchId))
      .flatMap((c) => {
        const f = db.qualityFindings(c);
        const area = db.areas.find((a) => a.id === c.areaId);
        return f
          .filter((x) => !issue || x.issue === issue)
          .map((x) => ({ customerId: c.item.id, code: c.item.code, name: c.item.name, branchId: c.branchId, areaCode: area?.code ?? null, assignee: c.item.assignee?.id ? c.item.assignee : null, issue: x.issue, detail: x.detail, issues: f.map((y) => y.issue) }));
      });
    const pg = page(rows, url);
    return HttpResponse.json({ items: pg.items, nextCursor: pg.nextCursor });
  })),
  http.get(`${BASE}/reports/branch-trends`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'report.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const granularity = (url.searchParams.get('granularity') ?? 'day') as 'day' | 'week' | 'month';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || to > db.today()) return problem(400, 'VALIDATION_FAILED', 'from and to must be dates, ending today or earlier');
    const day = (iso: string) => new Date(Date.parse(iso) + 6 * 3600_000).toISOString().slice(0, 10);
    const next = (d: string, n = 1) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    // weeks start on Saturday
    const bucket = (d: string) => (granularity === 'month' ? d.slice(0, 7) : granularity === 'week' ? next(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 1) % 7)) : d);
    const rows = new Map<string, { period: string; totalPoisha: number; cashPoisha: number; mobilePoisha: number; count: number; visits: number }>();
    for (let d = from; d <= to; d = next(d)) if (!rows.has(bucket(d))) rows.set(bucket(d), { period: bucket(d), totalPoisha: 0, cashPoisha: 0, mobilePoisha: 0, count: 0, visits: 0 });
    for (const c of db.collections) {
      const d = day(c.recordedAt!);
      if (c.status === 'voided' || d < from || d > to || !sc.includes(db.collectionBranch(c) ?? '')) continue;
      const r = rows.get(bucket(d))!;
      r.totalPoisha += c.amountPoisha!;
      r.count++;
      if (c.method === 'cash') r.cashPoisha += c.amountPoisha!;
      else r.mobilePoisha += c.amountPoisha!;
    }
    for (const v of db.visits) {
      const d = day(v.row.checkInAt);
      if (d >= from && d <= to && sc.includes(v.branchId)) rows.get(bucket(d))!.visits++;
    }
    const base = db.customers.filter((c) => sc.includes(c.branchId) && (c.item.daysOverdue ?? 0) > 0);
    const snap = (keep: (i: number) => boolean) => {
      const b = { d1_30: { count: 0, amountPoisha: 0 }, d31_60: { count: 0, amountPoisha: 0 }, d61_90: { count: 0, amountPoisha: 0 }, d90p: { count: 0, amountPoisha: 0 } };
      base.forEach((c, i) => {
        if (!keep(i)) return;
        const days = c.item.daysOverdue ?? 0;
        const k = days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90p';
        b[k].count++;
        b[k].amountPoisha += c.item.overduePoisha ?? 0;
      });
      const all = Object.values(b);
      return { buckets: b, totalOverdue: { count: all.reduce((a, x) => a + x.count, 0), amountPoisha: all.reduce((a, x) => a + x.amountPoisha, 0) } };
    };
    const bad = db.customers.filter((c) => sc.includes(c.branchId) && c.item.badges?.includes('bad_suggested')).length;
    const tagged = db.customers.filter((c) => sc.includes(c.branchId) && c.item.badges?.includes('tagged_bad')).length;
    // snapshots exist for the last 20 nights only; older days have none (the UI must cope)
    const overdue = [];
    for (let d = from, i = 0; d <= to; d = next(d), i++) {
      const age = Math.round((Date.parse(to) - Date.parse(d)) / 86_400_000);
      if (age > 20) continue;
      overdue.push({ date: d, ...snap((n) => age === 0 || (n * 7 + age) % 23 !== 0), badSuggested: bad, tagged });
    }
    return HttpResponse.json({ from, to, granularity, collection: [...rows.values()], overdue });
  })),
  http.get(`${BASE}/reports/reconciliation`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'report.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const date = url.searchParams.get('date') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return problem(400, 'VALIDATION_FAILED', 'date is required');
    const day = (iso: string) => new Date(Date.parse(iso) + 6 * 3600_000).toISOString().slice(0, 10);
    const mine = db.collections.filter((c) => day(c.recordedAt!) === date && sc.includes(db.collectionBranch(c) ?? ''));
    const posted = mine.filter((c) => c.status === 'posted');
    const waiting = mine.filter((c) => ['received', 'posting', 'posting_failed', 'conflict'].includes(c.status!));
    const who = (c: S['Collection']) => ({ collectionId: c.id ?? null, receiptNo: c.receiptNo ?? null, status: c.status ?? null, customer: c.customer ? { id: c.customer.id, name: c.customer.name?.bn, code: c.customer.code } : null, collector: c.collector ? { id: c.collector.id, name: c.collector.name } : null });
    const mismatches: NonNullable<S['ReconciliationReport']['mismatches']> = waiting.map((c) => ({ kind: 'not_posted' as const, ...who(c), erpPaymentId: null, fosAmountPoisha: c.amountPoisha ?? null, erpAmountPoisha: null }));
    let erpPoisha = posted.reduce((a, c) => a + c.amountPoisha!, 0);
    let erpCount = posted.length;
    let matched = posted.length;
    // older days carry one amount difference and one voided receipt so the table has something to show
    if (date < db.today() && posted.length > 2) {
      const a = posted[0]!;
      mismatches.push({ kind: 'amount_differs', ...who(a), erpPaymentId: 'PAY-90412', fosAmountPoisha: a.amountPoisha ?? null, erpAmountPoisha: a.amountPoisha! - 50_000 });
      erpPoisha -= 50_000;
      matched--;
      const b = posted[1]!;
      mismatches.push({ kind: 'missing_in_erp', ...who(b), erpPaymentId: null, fosAmountPoisha: b.amountPoisha ?? null, erpAmountPoisha: null });
      erpPoisha -= b.amountPoisha!;
      erpCount--;
      matched--;
    }
    mine.filter((c) => c.status === 'voided').forEach((c) => mismatches.push({ kind: 'voided_in_fos', ...who(c), erpPaymentId: null, fosAmountPoisha: c.amountPoisha ?? null, erpAmountPoisha: null }));
    return HttpResponse.json({
      date, balanced: mismatches.length === 0, erpFetchedAt: erpCount ? new Date(Date.now() - 4 * 60_000).toISOString() : null,
      totals: { fosPostedCount: posted.length, fosPostedPoisha: posted.reduce((a, c) => a + c.amountPoisha!, 0), fosWaitingCount: waiting.length, fosWaitingPoisha: waiting.reduce((a, c) => a + c.amountPoisha!, 0), erpCount, erpPoisha, matchedCount: matched },
      mismatches,
    });
  })),
  http.post(`${BASE}/reports/exports`, authed(async ({ ctx, request }) => {
    const deny = need(ctx, 'report.export');
    if (deny) return deny;
    const b = (await request.json()) as { type?: string; format?: string };
    if (b.type === 'audit') {
      const denyAudit = need(ctx, 'audit.view');
      if (denyAudit) return denyAudit;
    }
    const id = db.oid('6795');
    exportJobs.set(id, { at: Date.now(), type: b.type ?? 'export', format: b.format ?? 'csv' });
    return HttpResponse.json({ id, status: 'queued' }, { status: 202 });
  })),
  http.get(`${BASE}/reports/exports/:id`, authed(({ params }) => {
    const j = exportJobs.get(String(params.id));
    if (!j) return problem(404, 'NOT_FOUND', 'Export not found');
    const age = Date.now() - j.at;
    const status = age < 1500 ? 'queued' : age < 4000 ? 'running' : 'ready';
    return HttpResponse.json({ id: params.id, status, ...(status === 'ready' ? { downloadUrl: `${BASE}/mock-download/${String(params.id)}/${j.type}.${j.format}` } : {}) });
  })),
  http.get(`${BASE}/mock-download/:id/:file`, ({ params }) => new HttpResponse('﻿demo,export\n1,2\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${String(params.file)}"` } })),
  http.get(`${BASE}/search`, authed(({ ctx, url }) => {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    if (q.length < 2) return problem(400, 'VALIDATION_FAILED', 'Query too short');
    const sc = scope(ctx, url);
    const cs = db.customers.filter((c) => sc.includes(c.branchId) && `${c.item.name?.bn} ${c.item.name?.en} ${c.item.code} ${c.item.phone}`.toLowerCase().includes(q)).slice(0, 6).map((c) => ({ type: 'customer', id: c.item.id, title: `${c.item.name?.bn} · ${c.item.name?.en}`, subtitle: `${c.item.code} · ${c.item.phone}` }));
    const us = db.users.filter((u) => u.branchIds?.some((b) => sc.includes(b)) && `${u.name?.bn} ${u.name?.en} ${u.employeeCode}`.toLowerCase().includes(q)).slice(0, 4).map((u) => ({ type: 'user', id: u.id, title: `${u.name?.bn} · ${u.name?.en}`, subtitle: `${u.employeeCode} · ${u.role}` }));
    const rs = db.collections.filter((c) => c.receiptNo?.toLowerCase().includes(q)).slice(0, 4).map((c) => ({ type: 'receipt', id: c.id, title: c.receiptNo, subtitle: `${c.customer?.name?.en}` }));
    return HttpResponse.json([...cs, ...us, ...rs]);
  })),
  http.get(`${BASE}/audit`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'audit.view');
    if (deny) return deny;
    const sp = url.searchParams;
    let all = db.audit;
    const action = sp.get('action');
    const entity = sp.get('entity');
    const actorId = sp.get('actorId');
    if (action) all = all.filter((a) => a.action?.startsWith(action));
    if (entity) all = all.filter((a) => a.entity === entity);
    if (actorId) all = all.filter((a) => a.actor?.id === actorId);
    const entityId = sp.get('entityId');
    const from = sp.get('from');
    const to = sp.get('to');
    if (entityId) all = all.filter((a) => a.entityId === entityId);
    if (from) all = all.filter((a) => a.at! >= from);
    if (to) all = all.filter((a) => a.at! <= to);
    const sc = scope(ctx, url);
    all = all.filter((a) => !a.branchId || sc.includes(a.branchId));
    const p = page(all, url);
    return HttpResponse.json({ items: p.items, nextCursor: p.nextCursor });
  })),
  // ---------- leave requests (1.12.0) ----------
  http.get(`${BASE}/leave-requests`, authed(({ ctx, url }) => {
    const g = (k: string) => url.searchParams.get(k);
    const manager = perms(ctx.user).has('attendance.manage');
    const sc = scope(ctx, url);
    const items = db.leaveRequests
      .filter((r) => (manager ? sc.includes(r.branchId ?? '') : r.userId === ctx.user.id))
      .filter((r) => !g('status') || r.status === g('status'))
      .filter((r) => !manager || !g('userId') || r.userId === g('userId'))
      .filter((r) => (!g('from') || r.to! >= g('from')!) && (!g('to') || r.from! <= g('to')!))
      .sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1))
      .slice(0, 300);
    return HttpResponse.json({ items });
  })),
  http.post(`${BASE}/leave-requests/:id/decision`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'attendance.manage');
    if (deny) return deny;
    const r = db.leaveRequests.find((x) => x.id === params.id);
    if (!r || !scope(ctx, new URL('http://x/')).includes(r.branchId ?? '')) return problem(404, 'NOT_FOUND', 'Leave request not found');
    const b = (await request.json()) as S['Decision'];
    if (r.userId === ctx.user.id) return problem(422, 'BUSINESS_RULE', 'You cannot decide your own leave', undefined, { rule: 'CANNOT_DECIDE_OWN_LEAVE' });
    if (r.status !== 'pending') return problem(409, 'INVALID_STATE', 'This request is already decided', undefined, { reason: 'ALREADY_DECIDED' });
    if (b.decision === 'reject' && (b.reason ?? '').trim().length < 5) return problem(422, 'BUSINESS_RULE', 'A reason is required to reject', undefined, { rule: 'REASON_REQUIRED' });
    Object.assign(r, { status: b.decision === 'approve' ? 'approved' : 'rejected', decidedBy: ctx.user.id, decidedAt: new Date().toISOString(), ...(b.reason?.trim() ? { decisionReason: b.reason.trim() } : {}) });
    db.addAudit({ actor: actor(ctx.user), action: 'leave.decided', entity: 'leave', entityId: r.id, branchId: r.branchId ?? undefined, before: { status: 'pending' }, after: { status: r.status }, reason: b.reason ?? '' });
    return HttpResponse.json(r);
  })),
  // ---------- holidays and shifts ----------
  http.get(`${BASE}/calendar/holidays`, authed(({ url }) => {
    const y = url.searchParams.get('year');
    const br = url.searchParams.get('branchId');
    const items = db.holidays
      .filter((h) => !y || h.date!.startsWith(`${y}-`))
      .filter((h) => !br || !h.branchIds?.length || h.branchIds.includes(br))
      .sort((a, b) => (a.date! < b.date! ? -1 : 1));
    return HttpResponse.json(items);
  })),
  http.post(`${BASE}/calendar/holidays`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'settings.manage');
    if (deny) return deny;
    const b = (await request.json()) as S['HolidayCreate'];
    const type = b.type ?? 'national';
    const branchIds = b.branchIds ?? [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '') || !b.name?.bn?.trim() || (type === 'branch') !== branchIds.length > 0) return problem(400, 'VALIDATION_FAILED', 'date, name.bn and branches that match the type are required');
    const clash = db.holidays.find((h) => h.date === b.date && (!h.branchIds?.length || !branchIds.length || h.branchIds.some((x) => branchIds.includes(x))));
    if (clash) return problem(409, 'INVALID_STATE', 'A holiday already exists on this date', undefined, { reason: 'HOLIDAY_EXISTS', id: clash.id });
    const h: S['Holiday'] = { id: db.oid('6741'), date: b.date, name: { bn: b.name.bn.trim(), en: b.name.en?.trim() || b.name.bn.trim() }, branchIds, type };
    db.holidays.push(h);
    db.addAudit({ actor: actor(ctx.user), action: 'holiday.created', entity: 'holiday', entityId: h.id, after: { date: h.date, type, branchIds }, reason: '' });
    return HttpResponse.json(h, { status: 201 });
  })),
  http.delete(`${BASE}/calendar/holidays/:id`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'settings.manage');
    if (deny) return deny;
    const i = db.holidays.findIndex((h) => h.id === params.id);
    if (i < 0) return problem(404, 'NOT_FOUND', 'Holiday not found');
    const [h] = db.holidays.splice(i, 1);
    db.addAudit({ actor: actor(ctx.user), action: 'holiday.deleted', entity: 'holiday', entityId: h!.id, before: { date: h!.date, type: h!.type }, reason: '' });
    return new HttpResponse(null, { status: 204 });
  })),
  http.get(`${BASE}/shifts`, authed(() => HttpResponse.json(db.shifts))),
  http.post(`${BASE}/shifts`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'settings.manage');
    if (deny) return deny;
    const b = (await request.json()) as S['Shift'];
    if (!b.name?.trim() || !/^\d{2}:\d{2}$/.test(b.start ?? '') || !/^\d{2}:\d{2}$/.test(b.end ?? '')) return problem(400, 'VALIDATION_FAILED', 'name, start and end are required');
    const sh: S['Shift'] = { id: db.oid('6744'), name: b.name.trim(), start: b.start, end: b.end, weeklyOff: b.weeklyOff ?? [5], lateGraceMin: b.lateGraceMin ?? 15, maxBreakMin: b.maxBreakMin ?? 60 };
    db.shifts.push(sh);
    db.addAudit({ actor: actor(ctx.user), action: 'shift.created', entity: 'shift', entityId: sh.id, after: sh, reason: '' });
    return HttpResponse.json(sh, { status: 201 });
  })),
  http.patch(`${BASE}/shifts/:id`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'settings.manage');
    if (deny) return deny;
    const sh = db.shifts.find((x) => x.id === params.id);
    if (!sh) return problem(404, 'NOT_FOUND', 'Shift not found');
    const b = (await request.json()) as S['Shift'];
    const before = { ...sh };
    Object.assign(sh, { ...b, id: sh.id });
    db.addAudit({ actor: actor(ctx.user), action: 'shift.updated', entity: 'shift', entityId: sh.id, before, after: sh, reason: '' });
    return HttpResponse.json(sh);
  })),
  // ---------- notices (broadcasts) ----------
  http.get(`${BASE}/broadcasts`, authed(({ ctx, url }) => {
    const canSend = perms(ctx.user).has('notification.broadcast');
    const sa = ctx.user.role === 'super_admin';
    const mine = ctx.user.branchIds ?? [];
    const all = db.broadcasts
      .filter((b) => (canSend ? sa || b.row.createdBy?.id === ctx.user.id || (b.row.branchIds ?? []).some((x) => mine.includes(x)) || b.recipientIds.includes(ctx.user.id!) : b.recipientIds.includes(ctx.user.id!)))
      .map((b) => broadcastView(b, ctx.user));
    const pg = page(all, url);
    return HttpResponse.json({ items: pg.items, nextCursor: pg.nextCursor });
  })),
  http.post(`${BASE}/broadcasts`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'notification.broadcast');
    if (deny) return deny;
    const b = (await request.json()) as { branchIds?: string[]; roles?: db.Role[]; title?: S['I18nText']; body?: S['I18nText']; requireAck?: boolean };
    if (!b.title?.bn?.trim() || !b.body?.bn?.trim()) return problem(400, 'VALIDATION_FAILED', 'title.bn and body.bn are required');
    const sa = ctx.user.role === 'super_admin';
    const asked = b.branchIds?.length ? b.branchIds : null;
    if (asked && !sa && !asked.every((x) => (ctx.user.branchIds ?? []).includes(x))) return problem(404, 'NOT_FOUND', 'Branch not found');
    const branchIds = asked ?? (sa ? [] : (ctx.user.branchIds ?? []));
    const roles = (b.roles?.length ? b.roles : ['field_staff']) as db.Role[];
    if (!db.broadcastRecipients(branchIds, roles, ctx.user.id).length) return problem(422, 'BUSINESS_RULE', 'Nobody would receive this notice', undefined, { rule: 'NO_RECIPIENTS' });
    const txt = (t: S['I18nText']) => ({ bn: t.bn!.trim(), en: t.en?.trim() || t.bn!.trim() });
    const m = db.addBroadcast({ title: txt(b.title), body: txt(b.body), branchIds, roles, requireAck: !!b.requireAck, createdBy: { id: ctx.user.id, name: ctx.user.name?.en }, createdAt: new Date().toISOString() });
    db.addAudit({ actor: actor(ctx.user), action: 'broadcast.sent', entity: 'broadcast', entityId: m.row.id, after: { recipients: m.recipientIds.length, roles, requireAck: !!b.requireAck }, reason: '' });
    return HttpResponse.json(broadcastView(m, ctx.user), { status: 201 });
  })),
  http.get(`${BASE}/broadcasts/:id/recipients`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'notification.broadcast');
    if (deny) return deny;
    const b = db.broadcasts.find((x) => x.row.id === params.id);
    const sa = ctx.user.role === 'super_admin';
    if (!b || !(sa || b.row.createdBy?.id === ctx.user.id || (b.row.branchIds ?? []).some((x) => (ctx.user.branchIds ?? []).includes(x)))) return problem(404, 'NOT_FOUND', 'Notice not found');
    const items = b.recipientIds.map((id) => {
      const u = db.userById(id)!;
      const at = b.acks.get(id);
      return { userId: id, name: u.name, employeeCode: u.employeeCode, branchId: u.branchIds?.[0] ?? null, role: u.role, acked: !!at, ...(at ? { ackedAt: at } : {}) };
    });
    items.sort((a, c) => Number(a.acked) - Number(c.acked) || (a.name?.en ?? '').localeCompare(c.name?.en ?? ''));
    return HttpResponse.json({ broadcastId: b.row.id, recipientCount: b.recipientIds.length, ackCount: b.acks.size, items });
  })),
  // ---------- tasks (1.16.0) ----------
  http.get(`${BASE}/tasks`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'task.view');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const g = (k: string) => url.searchParams.get(k);
    const base = db.tasks
      .filter((x) => sc.includes(x.branchId))
      .filter((x) => !g('assigneeId') || x.assignee.id === g('assigneeId'))
      .filter((x) => !g('q') || x.title.toLowerCase().includes(g('q')!.toLowerCase()))
      .map(db.taskView);
    const n = (s: S['TaskStatus']) => base.filter((x) => x.status === s).length;
    const counts = { open: n('open'), resolve_requested: n('resolve_requested'), resolved: n('resolved'), cancelled: n('cancelled'), overdue: base.filter((x) => x.overdue).length };
    const all = base
      .filter((x) => !g('status') || x.status === g('status'))
      .filter((x) => g('overdue') !== 'true' || x.overdue)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const pg = page(all, url);
    return HttpResponse.json({ items: pg.items, nextCursor: pg.nextCursor, counts });
  })),
  http.post(`${BASE}/tasks`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'task.manage');
    if (deny) return deny;
    const b = (await request.json()) as S['TaskCreate'];
    if (!b.title?.trim() || b.title.trim().length > 120 || !b.assigneeId) return problem(400, 'VALIDATION_FAILED', 'title and assigneeId are required');
    const prior = b.clientId ? db.tasks.find((x) => x.createdBy.id === ctx.user.id && (x as { clientId?: string }).clientId === b.clientId) : undefined;
    if (prior) return HttpResponse.json(db.taskView(prior));
    const u = db.userById(b.assigneeId);
    const sc = scope(ctx, new URL('http://x/'));
    const branchId = b.branchId ?? u?.branchIds?.find((x) => sc.includes(x));
    if (!u || !u.active || u.role !== 'field_staff' || !branchId || !u.branchIds?.includes(branchId) || !sc.includes(branchId)) return problem(422, 'BUSINESS_RULE', 'This person cannot be given a task', undefined, { rule: 'TASK_INVALID_ASSIGNEE' });
    if (b.dueDate && b.dueDate < db.now().toISODate()!) return problem(422, 'BUSINESS_RULE', 'The due date is in the past', undefined, { rule: 'TASK_DUE_IN_PAST' });
    const t = db.addTask(ctx.user, u, b.title.trim(), b.note?.trim() || null, b.dueDate ?? null, 0, branchId);
    if (b.clientId) (t as { clientId?: string }).clientId = b.clientId;
    db.addAudit({ actor: actor(ctx.user), action: 'task.created', entity: 'task', entityId: t.id, branchId, after: { assigneeId: u.id, title: t.title, dueDate: t.dueDate }, reason: '' });
    return HttpResponse.json(db.taskView(t), { status: 201 });
  })),
  http.get(`${BASE}/tasks/:id`, authed(({ ctx, params, url }) => {
    const deny = need(ctx, 'task.view');
    if (deny) return deny;
    const t = db.tasks.find((x) => x.id === params.id);
    if (!t || !scope(ctx, url).includes(t.branchId)) return problem(404, 'NOT_FOUND', 'Task not found');
    return HttpResponse.json(db.taskView(t));
  })),
  http.patch(`${BASE}/tasks/:id`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'task.manage');
    if (deny) return deny;
    const t = db.tasks.find((x) => x.id === params.id);
    if (!t || !scope(ctx, new URL('http://x/')).includes(t.branchId)) return problem(404, 'NOT_FOUND', 'Task not found');
    if (t.status !== 'open') return problem(409, 'INVALID_STATE', 'The task can no longer be edited', undefined, { reason: `TASK_${t.status.toUpperCase()}` });
    const b = (await request.json()) as { title?: string; note?: string | null; dueDate?: string | null };
    if (!Object.keys(b).length) return problem(400, 'VALIDATION_FAILED', 'nothing to change');
    if (b.dueDate && b.dueDate < db.now().toISODate()!) return problem(422, 'BUSINESS_RULE', 'The due date is in the past', undefined, { rule: 'TASK_DUE_IN_PAST' });
    if (b.title !== undefined) t.title = b.title.trim();
    if (b.note !== undefined) t.note = b.note?.trim() || null;
    if (b.dueDate !== undefined) t.dueDate = b.dueDate;
    db.taskStep(t, ctx.user, 'edited', null);
    db.addAudit({ actor: actor(ctx.user), action: 'task.edited', entity: 'task', entityId: t.id, branchId: t.branchId, after: { title: t.title, dueDate: t.dueDate }, reason: '' });
    return HttpResponse.json(db.taskView(t));
  })),
  ...(['verify', 'reject', 'cancel'] as const).map((step) =>
    http.post(`${BASE}/tasks/:id/${step}`, authed(async ({ request, params, ctx }) => {
      const deny = need(ctx, 'task.manage');
      if (deny) return deny;
      const t = db.tasks.find((x) => x.id === params.id);
      if (!t || !scope(ctx, new URL('http://x/')).includes(t.branchId)) return problem(404, 'NOT_FOUND', 'Task not found');
      const b = ((await request.json().catch(() => ({}))) ?? {}) as { note?: string; reason?: string };
      const done = { verify: 'resolved', reject: 'open', cancel: 'cancelled' }[step];
      if (t.status === done && step !== 'reject') return HttpResponse.json(db.taskView(t)); // verify and cancel repeat harmlessly
      const from = step === 'cancel' ? ['open', 'resolve_requested'] : ['resolve_requested'];
      if (!from.includes(t.status)) return problem(409, 'INVALID_STATE', 'The task is not in a state that allows this', undefined, { reason: `TASK_${t.status.toUpperCase()}` });
      if (step === 'reject' && (b.reason ?? '').trim().length < 5) return problem(422, 'BUSINESS_RULE', 'A reason is required', undefined, { rule: 'REASON_REQUIRED' });
      const note = (step === 'reject' ? b.reason : b.note)?.trim() || null;
      db.taskStep(t, ctx.user, ({ verify: 'verified', reject: 'rejected', cancel: 'cancelled' } as const)[step], note);
      db.addAudit({ actor: actor(ctx.user), action: `task.${({ verify: 'verified', reject: 'rejected', cancel: 'cancelled' })[step]}`, entity: 'task', entityId: t.id, branchId: t.branchId, after: { status: t.status }, reason: note ?? '' });
      return HttpResponse.json(db.taskView(t));
    })),
  ),
  // ---------- map places (1.38.0) ----------
  http.get(`${BASE}/places`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'place.view');
    if (deny) return deny;
    const g = (k: string) => url.searchParams.get(k);
    const status = g('status') ?? 'active';
    if (status === 'deleted' && need(ctx, 'place.manage')) return need(ctx, 'place.manage')!;
    const sc = scope(ctx, url);
    const box = g('bbox')?.split(',').map(Number);
    const words = g('q')?.toLowerCase();
    const all = db.places
      .filter((p) => sc.includes(p.branchId) && p.status === status)
      .filter((p) => !g('icon') || p.icon === g('icon'))
      .filter((p) => g('pendingMove') !== 'true' || !!p.pendingMove)
      .filter((p) => !words || p.name.toLowerCase().includes(words) || (p.note ?? '').toLowerCase().includes(words))
      .filter((p) => !box || box.length !== 4 || (p.location.lng >= box[0]! && p.location.lat >= box[1]! && p.location.lng <= box[2]! && p.location.lat <= box[3]!));
    const pg = page(all, url, 200);
    return HttpResponse.json({ items: pg.items, nextCursor: pg.nextCursor });
  })),
  http.post(`${BASE}/places`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'place.create');
    if (deny) return deny;
    const b = (await request.json()) as S['PlaceCreate'];
    const name = b.name?.trim() ?? '';
    if (!b.clientId || !name || name.length > 60 || (b.note ?? '').length > 200 || !b.location) return problem(400, 'VALIDATION_FAILED', 'name, icon, location and clientId are required');
    const prior = db.places.find((p) => p.createdBy.id === ctx.user.id && p.clientId === b.clientId);
    if (prior) return HttpResponse.json(prior);
    const { lat, lng } = b.location;
    if (lat < 20.3 || lat > 26.8 || lng < 87.9 || lng > 92.8) return problem(422, 'BUSINESS_RULE', 'The point is outside Bangladesh', undefined, { rule: 'OUTSIDE_BANGLADESH' });
    const sc = scope(ctx, new URL('http://x/'));
    const branchId = b.branchId ?? ctx.user.branchIds?.[0];
    if (!branchId || !sc.includes(branchId)) return problem(422, 'BUSINESS_RULE', 'Not one of your branches', undefined, { rule: 'PLACE_INVALID_BRANCH' });
    const p = db.addPlace(ctx.user, name, b.icon, b.note?.trim() || null, { lat, lng }, branchId, 0);
    p.clientId = b.clientId;
    db.addAudit({ actor: actor(ctx.user), action: 'place.created', entity: 'place', entityId: p.id, branchId, after: { name, icon: b.icon, location: b.location }, reason: '' });
    return HttpResponse.json(p, { status: 201 });
  })),
  http.get(`${BASE}/places/move-requests`, authed(({ ctx, url }) => {
    const deny = need(ctx, 'place.manage');
    if (deny) return deny;
    const sc = scope(ctx, url);
    const items = db.places.filter((p) => p.status === 'active' && p.pendingMove && sc.includes(p.branchId)).sort((a, b) => (a.pendingMove!.requestedAt < b.pendingMove!.requestedAt ? -1 : 1));
    return HttpResponse.json({ items });
  })),
  http.get(`${BASE}/places/:id`, authed(({ ctx, params }) => {
    const deny = need(ctx, 'place.view');
    if (deny) return deny;
    const p = db.places.find((x) => x.id === params.id);
    if (!p || !scope(ctx, new URL('http://x/')).includes(p.branchId) || (p.status === 'deleted' && need(ctx, 'place.manage'))) return problem(404, 'NOT_FOUND', 'Place not found');
    return HttpResponse.json(p);
  })),
  http.patch(`${BASE}/places/:id`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'place.create');
    if (deny) return deny;
    const manage = !need(ctx, 'place.manage');
    const p = db.places.find((x) => x.id === params.id);
    if (!p || !scope(ctx, new URL('http://x/')).includes(p.branchId) || (p.status === 'deleted' && !manage)) return problem(404, 'NOT_FOUND', 'Place not found');
    const b = (await request.json()) as S['PlaceUpdate'];
    if (!Object.keys(b).length) return problem(400, 'VALIDATION_FAILED', 'nothing to change');
    if (!manage && (b.location || p.createdBy.id !== ctx.user.id)) return problem(403, 'FORBIDDEN', 'Only the office can do this', undefined, { permission: 'place.manage', reason: b.location ? 'MOVE_NEEDS_MANAGE' : 'NOT_OWNER' });
    if (p.status === 'deleted') return problem(409, 'INVALID_STATE', 'The place was removed', undefined, { reason: 'PLACE_DELETED' });
    const m = /W\/"(\d+)"/.exec(request.headers.get('if-match') ?? '');
    if (m && Number(m[1]) !== p.version) return problem(412, 'PRECONDITION_FAILED', 'Changed meanwhile', undefined, { currentVersion: p.version });
    if (b.name !== undefined) p.name = b.name.trim();
    if (b.icon !== undefined) p.icon = b.icon;
    if (b.note !== undefined) p.note = b.note?.trim() || null;
    if (b.location) {
      const from = p.location;
      p.location = b.location;
      db.placeStep(p, ctx.user, 'moved', { from, to: b.location });
      if (p.pendingMove) {
        p.lastMoveDecision = { decision: 'reject', by: { id: ctx.user.id!, name: ctx.user.name?.en ?? '' }, at: p.updatedAt, reason: 'Moved by the office', requestedBy: p.pendingMove.requestedBy };
        p.pendingMove = null;
      }
    } else db.placeStep(p, ctx.user, 'edited');
    db.addAudit({ actor: actor(ctx.user), action: b.location ? 'place.moved' : 'place.edited', entity: 'place', entityId: p.id, branchId: p.branchId, after: b, reason: '' });
    return HttpResponse.json(p);
  })),
  http.delete(`${BASE}/places/:id`, authed(({ ctx, params, url }) => {
    const deny = need(ctx, 'place.manage');
    if (deny) return deny;
    const p = db.places.find((x) => x.id === params.id);
    if (!p || !scope(ctx, new URL('http://x/')).includes(p.branchId)) return problem(404, 'NOT_FOUND', 'Place not found');
    if (p.status === 'deleted') return HttpResponse.json(p);
    const reason = url.searchParams.get('reason')?.trim() || null;
    db.placeStep(p, ctx.user, 'deleted', { note: reason });
    Object.assign(p, { status: 'deleted', deletedAt: p.updatedAt, deleteReason: reason, pendingMove: null });
    db.addAudit({ actor: actor(ctx.user), action: 'place.deleted', entity: 'place', entityId: p.id, branchId: p.branchId, reason: reason ?? '' });
    return HttpResponse.json(p);
  })),
  http.post(`${BASE}/places/:id/move-request/decision`, authed(async ({ request, ctx, params }) => {
    const deny = need(ctx, 'place.manage');
    if (deny) return deny;
    const p = db.places.find((x) => x.id === params.id);
    if (!p || !scope(ctx, new URL('http://x/')).includes(p.branchId)) return problem(404, 'NOT_FOUND', 'Place not found');
    const b = (await request.json()) as { decision: 'approve' | 'reject'; reason?: string };
    if (!p.pendingMove) return problem(409, 'INVALID_STATE', 'No open move request', undefined, { reason: 'NO_PENDING_MOVE' });
    if (b.decision === 'reject' && (b.reason ?? '').trim().length < 5) return problem(422, 'BUSINESS_RULE', 'A reason is required', undefined, { rule: 'REASON_REQUIRED' });
    const pm = p.pendingMove;
    const from = p.location;
    if (b.decision === 'approve') p.location = pm.location;
    db.placeStep(p, ctx.user, b.decision === 'approve' ? 'move_approved' : 'move_rejected', { note: b.reason?.trim() || null, from, to: pm.location });
    p.lastMoveDecision = { decision: b.decision, by: { id: ctx.user.id!, name: ctx.user.name?.en ?? '' }, at: p.updatedAt, reason: b.reason?.trim() || null, requestedBy: pm.requestedBy };
    p.pendingMove = null;
    db.addAudit({ actor: actor(ctx.user), action: `place.move_${b.decision === 'approve' ? 'approved' : 'rejected'}`, entity: 'place', entityId: p.id, branchId: p.branchId, reason: b.reason ?? '' });
    return HttpResponse.json(p);
  })),
  http.get(`${BASE}/notifications`, authed(() => HttpResponse.json({ items: [], nextCursor: null }))),
];
