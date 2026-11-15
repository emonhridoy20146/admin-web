/**
 * MSW handlers implementing the field-api contract (openapi.yaml) against the in-memory mock db.
 * Behaviour mirrors the documented conventions: problem+json errors, cursor pagination, scope by branch,
 * Idempotency-Key replay on money actions, audit on every privileged change.
 */
import { http, HttpResponse, delay } from 'msw';
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
const idem = new Map<string, S["Collection"]>();

const custBranchOk = (ctx: Ctx, c: db.MockCustomer) => scope(ctx, new URL('http://x/')).includes(c.branchId);

function recomputeCustomer(c: db.MockCustomer) {
  c.detail.pendingFieldPoisha = c.item.pendingFieldPoisha;
  c.detail.tag = c.item.tag;
  c.detail.badges = c.item.badges;
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
  http.get(`${BASE}/system/erp-status`, authed(() => HttpResponse.json({ ...db.erpStatus, lastSuccessAt: new Date(Date.now() - 3 * 60_000).toISOString() }))),
  http.get(`${BASE}/branches`, authed(({ ctx, url }) => HttpResponse.json(db.branches.filter((b) => scope(ctx, url).includes(b.id!))))),

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

  // ---------- settings & flags ----------
  http.get(`${BASE}/settings`, authed(() => HttpResponse.json(db.settings))),
  http.patch(`${BASE}/settings`, authed(async ({ request, ctx }) => {
    const deny = need(ctx, 'settings.manage');
    if (deny) return deny;
    const b = (await request.json()) as { changes: Record<string, unknown>; reason: string; branchId?: string };
    const before = Object.fromEntries(Object.keys(b.changes).map((k) => [k, db.settings[k]]));
    Object.assign(db.settings, b.changes);
    db.addAudit({ actor: actor(ctx.user), action: 'settings.update', entity: 'settings', entityId: 'global', before, after: b.changes, reason: b.reason });
    return HttpResponse.json({});
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
    let all = db.customers.filter((c) => sc.includes(c.branchId));
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
    const p = page(all.map((c) => c.item), url);
    return HttpResponse.json(p);
  })),
  http.get(`${BASE}/customers/:id`, authed(({ params, ctx }) => {
    const c = db.customerById(params.id!);
    if (!c || !custBranchOk(ctx, c)) return problem(404, 'NOT_FOUND', 'Customer not found');
    recomputeCustomer(c);
    return HttpResponse.json(c.detail, { headers: { ETag: `"${c.detail.version}"` } });
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
    return HttpResponse.json({ items: p.items, nextCursor: p.nextCursor });
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
    const b = (await request.json()) as { action: string; erpPlanId?: string; reason: string };
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
    c.resolution = { action: 'void', by: ctx.user.id, at: new Date().toISOString(), reason: b.reason };
    db.addAudit({ actor: actor(ctx.user), action: 'collection.void', entity: 'collection', entityId: c.id, branchId: db.collectionBranch(c), before, after: { status: 'voided' }, reason: b.reason });
    return HttpResponse.json({});
  })),

  // ---------- cash ----------
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
  http.post(`${BASE}/cash/deposits/:id/verify`, authed(({ params, ctx }) => {
    const deny = need(ctx, 'cash.deposit.verify');
    if (deny) return deny;
    const d = db.deposits.find((x) => x.id === params.id);
    if (!d) return problem(404, 'NOT_FOUND', 'Deposit not found');
    if (d.status !== 'pending') return problem(409, 'ALREADY_DECIDED', 'Deposit already decided');
    d.status = 'verified';
    d.verifiedBy = ctx.user.id;
    d.verifiedAt = new Date().toISOString();
    const pos = db.cashPositions.find((p) => p.userId === d.userId);
    if (pos) {
      pos.pendingDepositsPoisha = Math.max(0, (pos.pendingDepositsPoisha ?? 0) - d.amountPoisha!);
      pos.onHandPoisha = Math.max(0, (pos.onHandPoisha ?? 0) - d.amountPoisha!);
      pos.state = pos.onHandPoisha >= pos.limitPoisha! ? 'exceeded' : pos.onHandPoisha >= pos.limitPoisha! * 0.8 ? 'warning' : 'ok';
    }
    db.inbox.filter((i) => i.entityId === d.id).forEach((i) => (i.status = 'resolved'));
    db.addAudit({ actor: actor(ctx.user), action: 'deposit.verify', entity: 'deposit', entityId: d.id, before: { status: 'pending' }, after: { status: 'verified', amountPoisha: d.amountPoisha }, reason: '' });
    return HttpResponse.json({});
  })),
  http.post(`${BASE}/cash/deposits/:id/reject`, authed(async ({ request, params, ctx }) => {
    const deny = need(ctx, 'cash.deposit.verify');
    if (deny) return deny;
    const d = db.deposits.find((x) => x.id === params.id)!;
    if (d.status !== 'pending') return problem(409, 'ALREADY_DECIDED', 'Deposit already decided');
    const b = (await request.json()) as { reason: string };
    d.status = 'rejected';
    d.rejectReason = b.reason;
    d.verifiedBy = ctx.user.id;
    d.verifiedAt = new Date().toISOString();
    const pos = db.cashPositions.find((p) => p.userId === d.userId);
    if (pos) pos.pendingDepositsPoisha = Math.max(0, (pos.pendingDepositsPoisha ?? 0) - d.amountPoisha!);
    db.inbox.filter((i) => i.entityId === d.id).forEach((i) => (i.status = 'resolved'));
    db.addAudit({ actor: actor(ctx.user), action: 'deposit.reject', entity: 'deposit', entityId: d.id, before: { status: 'pending' }, after: { status: 'rejected' }, reason: b.reason });
    return HttpResponse.json({});
  })),

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
    const out: S['DashboardOverview'] = {
      date: db.today(),
      collected: { totalPoisha: sum(todayCol), cashPoisha: sum(todayCol.filter((c) => c.method === 'cash')), mobilePoisha: sum(todayCol.filter((c) => c.method !== 'cash')), count: todayCol.length, targetPoisha: staffIn.length * 2_500_000 },
      visits: { count: Math.round(todayCol.length * 1.8), uniqueCustomers: Math.round(todayCol.length * 1.5) },
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
  http.get(`${BASE}/reports/staff-performance`, authed(({ ctx, url }) => {
    const sc = scope(ctx, url);
    const startToday = db.now().startOf('day').toUTC().toISO()!;
    const rows: S['StaffPerformanceRow'][] = db.staff.filter((s) => s.active && sc.includes(s.branchIds?.[0] ?? '')).map((s) => {
      const mine = db.collections.filter((c) => c.collector?.id === s.id && c.recordedAt! >= startToday && c.status !== 'voided');
      const byMethod: Record<string, number> = {};
      mine.forEach((c) => (byMethod[c.method!] = (byMethod[c.method!] ?? 0) + c.amountPoisha!));
      const total = mine.reduce((a, c) => a + c.amountPoisha!, 0);
      return { userId: s.id, name: s.name?.en, period: db.today(), visits: Math.round(mine.length * 1.6), uniqueCustomers: mine.length, collectionsCount: mine.length, collectedPoisha: { total, ...byMethod }, targetPoisha: 2_500_000, promisesDue: 3, promisesKept: 2, promiseFulfilmentRate: 0.66, presentDays: 1, lateDays: 0, lateMin: 0, breakMin: 35, fieldMin: 320, distanceKm: 28.4 };
    });
    rows.sort((a, b) => (b.collectedPoisha?.total ?? 0) - (a.collectedPoisha?.total ?? 0));
    return HttpResponse.json(rows);
  })),
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
    const p = page(all, url);
    return HttpResponse.json({ items: p.items, nextCursor: p.nextCursor });
  })),
  http.get(`${BASE}/notifications`, authed(() => HttpResponse.json({ items: [], nextCursor: null }))),
];
