/**
 * In-memory mock of field-api data for `pnpm dev:mock` and E2E (MSW). Deterministic (seeded) and shaped
 * strictly by the generated contract types. Not shipped in production builds (dynamic import behind
 * NEXT_PUBLIC_API_MOCK). All names and numbers are fictional.
 */
import type { components } from '@/shared/api/schema';
import catalogJson from '../../../contract/permission-catalog.json';
import { DateTime } from 'luxon';

type S = components['schemas'];
export type Role = S['Role'];

const ZONE = 'Asia/Dhaka';

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261115);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const int = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));
const chance = (p: number) => rnd() < p;
let idSeq = 0x6740a0;
export const oid = (prefix = '67') => prefix + (idSeq++).toString(16).padStart(22, '0');

export const now = () => DateTime.now().setZone(ZONE);
export const today = () => now().toISODate()!;
/** Dhaka business date of a UTC instant ('' for an empty value). */
export const dhakaDate = (iso: string) => (iso ? (DateTime.fromISO(iso, { zone: 'utc' }).setZone(ZONE).toISODate() ?? '') : '');
const isoAt = (d: DateTime) => d.toUTC().toISO()!;

export const catalog = catalogJson as {
  key: string; module: string; description: string; added: boolean; reserved: boolean;
  defaults: Record<Role, boolean | null>;
}[];

// ---------- branches ----------
export const branches: S['Branch'][] = [
  { id: oid('6731'), erpBranchId: '3', code: 'BRL01', name: { bn: 'বরিশাল সদর', en: 'Barishal Sadar' }, district: 'Barishal', address: 'Sadar Road, Barishal', lat: 22.7022, lng: 90.3696, active: true },
  { id: oid('6731'), erpBranchId: '5', code: 'PTK01', name: { bn: 'পটুয়াখালী', en: 'Patuakhali' }, district: 'Patuakhali', address: 'Sadar Road, Patuakhali', lat: 22.3596, lng: 90.3299, active: true },
  { id: oid('6731'), erpBranchId: '7', code: 'BHL01', name: { bn: 'ভোলা', en: 'Bhola' }, district: 'Bhola', address: 'Sadar Road, Bhola', lat: 22.6859, lng: 90.6482, active: true },
];

// ---------- people ----------
const FIRST = [
  ['মোঃ', 'Md'], ['আব্দুল', 'Abdul'], ['শফিকুল', 'Shafiqul'], ['রফিকুল', 'Rafiqul'], ['নাসির', 'Nasir'], ['কামরুল', 'Kamrul'],
  ['মাহমুদ', 'Mahmud'], ['জাহিদ', 'Zahid'], ['তানভীর', 'Tanvir'], ['সাইফুল', 'Saiful'], ['আরিফ', 'Arif'], ['হাসান', 'Hasan'],
  ['রাকিব', 'Rakib'], ['সোহেল', 'Sohel'], ['মিজানুর', 'Mizanur'], ['আনোয়ার', 'Anwar'], ['ফারুক', 'Faruk'], ['ইমরান', 'Imran'],
] as const;
const MIDDLE = [
  ['করিম', 'Karim'], ['রহমান', 'Rahman'], ['ইসলাম', 'Islam'], ['হোসেন', 'Hossain'], ['আলম', 'Alam'], ['উদ্দিন', 'Uddin'],
  ['মিয়া', 'Mia'], ['সরদার', 'Sardar'], ['খান', 'Khan'], ['তালুকদার', 'Talukder'], ['হাওলাদার', 'Howlader'], ['মৃধা', 'Mridha'],
  ['শিকদার', 'Shikder'], ['ফকির', 'Fakir'], ['চৌধুরী', 'Chowdhury'], ['মোল্লা', 'Molla'],
] as const;
const FEMALE = [
  ['রহিমা', 'Rahima'], ['নাসরিন', 'Nasrin'], ['শাহনাজ', 'Shahnaz'], ['ফাতেমা', 'Fatema'], ['রোকসানা', 'Roksana'], ['সালমা', 'Salma'],
  ['মরিয়ম', 'Moriom'], ['জেসমিন', 'Jesmin'], ['পারভীন', 'Parvin'], ['কুলসুম', 'Kulsum'],
] as const;
const HINDU = [
  ['সুমন দাস', 'Sumon Das'], ['প্রদীপ সাহা', 'Prodip Saha'], ['বিপ্লব মণ্ডল', 'Biplob Mondal'], ['অনিমা রায়', 'Onima Roy'], ['গৌতম শীল', 'Goutam Shil'],
] as const;

function personName(): { bn: string; en: string } {
  if (chance(0.06)) {
    const h = pick(HINDU);
    return { bn: h[0], en: h[1] };
  }
  if (chance(0.22)) {
    const f = pick(FEMALE);
    const m = pick(MIDDLE);
    return chance(0.5) ? { bn: `${f[0]} বেগম`, en: `${f[1]} Begum` } : { bn: `${f[0]} ${m[0]}`, en: `${f[1]} ${m[1]}` };
  }
  const f = pick(FIRST);
  const m = pick(MIDDLE);
  let m2: (typeof MIDDLE)[number] | null = chance(0.3) ? pick(MIDDLE) : null;
  if (m2 && m2[0] === m[0]) m2 = null;
  return { bn: [f[0], m[0], m2?.[0]].filter(Boolean).join(' '), en: [f[1], m[1], m2?.[1]].filter(Boolean).join(' ') };
}
const phone = () => `01${pick(['7', '8', '9', '3', '5', '6'])}${String(int(10000000, 99999999))}`;

export type MockUser = S['User'] & { password: string };

const B = branches.map((b) => b.id!);
export const users: MockUser[] = [];
function addUser(role: Role, branchIds: string[], name: { bn: string; en: string }, extra: Partial<MockUser> = {}) {
  const u: MockUser = {
    id: oid('6734'), name, phone: phone(), username: undefined, role, branchIds,
    employeeCode: `${role === 'field_staff' ? 'FS' : role === 'branch_manager' ? 'BM' : role === 'viewer' ? 'VW' : 'SA'}${String(users.length + 1).padStart(3, '0')}`,
    erpEmployeeId: `E-${2000 + users.length}`, shiftId: null, cashLimitPoisha: role === 'field_staff' ? 5_000_000 : null,
    active: true, mustChangePassword: false, locale: 'bn', lastLoginAt: isoAt(now().minus({ hours: int(1, 30) })), version: 1,
    password: 'Demo@2026', ...extra,
  };
  users.push(u);
  return u;
}
export const superAdmin = addUser('super_admin', B, { bn: 'রফিকুল ইসলাম হাওলাদার', en: 'Rafiqul Islam Howlader' }, { username: 'admin' });
addUser('super_admin', B, { bn: 'তানজিলা হাওলাদার', en: 'Tanzila Howlader' }, { username: 'tanzila' });
export const managers = [
  addUser('branch_manager', [B[0]!], { bn: 'মাহমুদুল হাসান', en: 'Mahmudul Hasan' }, { username: 'manager' }),
  addUser('branch_manager', [B[1]!], { bn: 'কামরুজ্জামান খান', en: 'Kamruzzaman Khan' }, { username: 'ptk.manager' }),
  addUser('branch_manager', [B[2]!], { bn: 'নুসরাত জাহান', en: 'Nusrat Jahan' }, { username: 'bhl.manager' }),
];
addUser('viewer', B, { bn: 'হিসাব বিভাগ', en: 'Accounts Desk' }, { username: 'viewer' });
// a user who must change password on first login (W-E1)
addUser('branch_manager', [B[0]!], { bn: 'নতুন ম্যানেজার', en: 'New Manager' }, { username: 'newmanager', mustChangePassword: true, lastLoginAt: null });

const staffPerBranch = [12, 9, 7];
export const staff: MockUser[] = [];
staffPerBranch.forEach((n, bi) => {
  for (let i = 0; i < n; i++) {
    const f = pick(FIRST);
    const m = pick(MIDDLE);
    const u = addUser('field_staff', [B[bi]!], { bn: `${f[0] === 'মোঃ' ? 'মোঃ ' + pick(MIDDLE)[0] : f[0]} ${m[0]}`, en: `${f[1] === 'Md' ? 'Md ' + pick(MIDDLE)[1] : f[1]} ${m[1]}` });
    if (i === 3 && bi === 0) u.active = false;
    staff.push(u);
  }
});
export const userById = (id?: string | null) => users.find((u) => u.id === id);
export const userName = (id?: string | null) => userById(id)?.name?.en ?? '';

// ---------- areas ----------
const AREAS: Record<number, [string, string][]> = {
  0: [['চরকাউয়া', 'Charkawa'], ['নথুল্লাবাদ', 'Nathullabad'], ['রূপাতলী', 'Rupatali'], ['কাশীপুর', 'Kashipur'], ['আমতলা', 'Amtala'], ['সাগরদী', 'Sagardi'], ['বাংলাবাজার', 'Banglabazar']],
  1: [['কলাতলা', 'Kalatala'], ['লাউকাঠী', 'Laukathi'], ['ইটবাড়িয়া', 'Itbaria'], ['বদরপুর', 'Badarpur'], ['মরিচবুনিয়া', 'Morichbunia']],
  2: [['বাংলাবাজার', 'Banglabazar'], ['ইলিশা', 'Ilisha'], ['ধনিয়া', 'Dhania'], ['ভেদুরিয়া', 'Bheduria']],
};
export const areas: S['Area'][] = [];
branches.forEach((b, bi) =>
  AREAS[bi]!.forEach(([bn, en], ai) =>
    areas.push({ id: oid('6738'), branchId: b.id, name: { bn, en }, code: `${b.code}-${en.slice(0, 3).toUpperCase()}`, kind: 'codes', erpAreaCodes: [`${en.slice(0, 3).toUpperCase()}${ai}`], color: `chart-${(ai % 8) + 1}`, customerCount: 0, assignees: [], active: true, version: 1 }),
  ),
);

// ---------- customers ----------
const PRODUCTS = [
  ['Refrigerator 252 L', 4_200_000, 7_500_000], ['LED TV 43"', 3_800_000, 5_200_000], ['LED TV 32"', 1_800_000, 2_600_000],
  ['Split AC 1.5 Ton', 6_000_000, 8_500_000], ['Washing machine 8 kg', 3_200_000, 4_800_000], ['Deep freezer 300 L', 4_500_000, 6_800_000],
  ['Smartphone', 1_500_000, 3_500_000], ['Laptop 15"', 5_500_000, 8_000_000], ['Ceiling fan ×3', 900_000, 1_400_000], ['Motorbike 110 cc', 13_000_000, 16_500_000],
  ['Microwave oven', 1_200_000, 1_900_000], ['Water purifier', 1_400_000, 2_200_000],
] as const;

export interface MockCustomer {
  item: S['CustomerListItem'];
  detail: S['CustomerDetail'];
  branchId: string;
  areaId: string;
  tagHistory: S['TagEvent'][];
}
export const customers: MockCustomer[] = [];
const T = today();
const dDate = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });

function buildPlan(): S['Plan'] {
  const [product, lo, hi] = pick(PRODUCTS);
  const count = pick([3, 4, 5, 6, 6, 8, 10, 12, 12, 18]);
  const total = Math.round(int(lo, hi) / 1000) * 1000;
  const down = Math.round((total * pick([0.1, 0.15, 0.2, 0.25, 0.3])) / 10000) * 10000;
  const per = Math.round((total - down) / count / 100) * 100;
  const startOffset = -int(10, count * 31 + 150);
  const start = now().plus({ days: startOffset }).startOf('day');
  const behaviour = rnd(); // 0..1: discipline
  const schedule: NonNullable<S['Plan']['schedule']> = [];
  let paid = down;
  for (let s = 1; s <= count; s++) {
    const due = start.plus({ months: s });
    const dueIso = due.toISODate()!;
    const amount = s === count ? total - down - per * (count - 1) : per;
    const past = dueIso < T;
    const isToday = dueIso === T;
    let p = 0;
    if (past) p = behaviour > 0.35 ? amount : behaviour > 0.18 ? (chance(0.6) ? amount : chance(0.5) ? Math.round(amount / 2 / 100) * 100 : 0) : chance(0.35) ? amount : 0;
    else if (isToday) p = chance(0.2) ? amount : 0;
    paid += p;
    schedule.push({ seq: s, dueDate: dueIso, amountPoisha: amount, paidPoisha: p, status: p >= amount ? 'paid' : p > 0 ? 'partial' : past ? 'overdue' : isToday ? 'due' : 'upcoming', estimated: false });
  }
  const finalDue = schedule[schedule.length - 1]!.dueDate!;
  const outstanding = total - paid;
  const status: S['Plan']['status'] = outstanding <= 0 ? 'completed' : 'active';
  return {
    erpPlanId: `P-${int(40000, 79999)}`, product, startDate: start.toISODate()!, finalDueDate: finalDue, installmentCount: count,
    totalPayablePoisha: total, downPaymentPoisha: down, paidPoisha: paid, outstandingPoisha: Math.max(0, outstanding), status,
    badSuggested: finalDue < T && outstanding > 0, schedule,
  };
}

const VILLAGES = ['Vill', 'Road', 'Para', 'Bazar'];
const fieldStaffOf = (bid: string) => staff.filter((s) => s.branchIds?.includes(bid) && s.active);

branches.forEach((b, bi) => {
  const n = [190, 120, 90][bi]!;
  const bAreas = areas.filter((a) => a.branchId === b.id);
  const bStaff = fieldStaffOf(b.id!);
  bAreas.forEach((a, i) => (a.assignees = [bStaff[i % bStaff.length]!.id!, ...(i + bAreas.length < bStaff.length ? [bStaff[i + bAreas.length]!.id!] : [])]));
  for (let i = 0; i < n; i++) {
    const area = pick(bAreas);
    const plans = [buildPlan(), ...(chance(0.2) ? [buildPlan()] : [])];
    const outstanding = plans.reduce((s, p) => s + (p.outstandingPoisha ?? 0), 0);
    const overdueSeq = plans.flatMap((p) => p.schedule ?? []).filter((s) => s.status === 'overdue' || (s.status === 'partial' && s.dueDate! < T));
    const oldest = overdueSeq.map((s) => s.dueDate!).sort()[0];
    const daysOverdue = oldest ? Math.round(dDate(T).diff(dDate(oldest), 'days').days) : 0;
    const nextDue = plans.flatMap((p) => p.schedule ?? []).filter((s) => s.dueDate! >= T && s.status !== 'paid').map((s) => s.dueDate!).sort()[0] ?? null;
    const name = personName();
    const missingLoc = chance(0.06);
    const lat = (b.lat ?? 22.7) + (rnd() - 0.5) * 0.09;
    const lng = (b.lng ?? 90.37) + (rnd() - 0.5) * 0.09;
    const badges: S['CustomerStatus'][] = [];
    const badSuggested = plans.some((p) => p.badSuggested);
    if (daysOverdue > 0) badges.push('overdue');
    if (nextDue === T) badges.push('due_today');
    if (outstanding <= 0) badges.push('paid_up');
    else if (!daysOverdue && nextDue !== T) badges.push('current');
    const tagged = badSuggested && chance(0.35);
    if (tagged) badges.unshift('tagged_bad');
    else if (badSuggested) badges.unshift('bad_suggested');
    const assignee = userById(pick(area.assignees ?? []))!;
    const promiseToday = daysOverdue > 0 && chance(0.12);
    const openPromise: S['Promise'] | null =
      daysOverdue > 0 && (promiseToday || chance(0.2))
        ? { id: oid('6760'), clientId: crypto.randomUUID(), customerId: '', promisedDate: promiseToday ? T : now().plus({ days: int(1, 12) }).toISODate()!, promisedAmountPoisha: Math.round(int(200000, 1500000) / 10000) * 10000, status: 'open', ownerId: assignee.id, paidTowardsPoisha: 0, createdAt: isoAt(now().minus({ days: int(1, 8) })) }
        : null;
    if (promiseToday) badges.splice(badges.indexOf('overdue') + 1, 0, 'promised_today');
    const id = oid('6740');
    if (openPromise) openPromise.customerId = id;
    const erpCustomerId = `C-${100000 + customers.length * 7 + int(0, 6)}`;
    const tag: S['Tag'] = tagged
      ? { state: 'tagged', severity: pick(['bad', 'bad', 'watch', 'legal'] as const), reasonCode: pick(['plan_ended_unpaid', 'repeated_broken_promise', 'refused_to_pay'] as const), reason: 'Plan ended, repeated broken promises, refuses to pay remaining balance.', setBy: pick(managers).id, setAt: isoAt(now().minus({ days: int(2, 40) })) }
      : { state: 'none' };
    const fetched = isoAt(now().minus({ minutes: int(2, 14) }));
    const item: S['CustomerListItem'] = {
      id, erpCustomerId, code: `${b.code}-${erpCustomerId.slice(2)}`, name, phone: phone(),
      address: `${pick(VILLAGES)}: ${area.name?.en}, ${b.name?.en}`,
      location: missingLoc ? { lat: null, lng: null, status: 'missing', source: 'erp' } : { lat, lng, status: 'ok', source: 'erp' },
      areaName: area.name, installmentPoisha: plans.length === 1 ? (plans[0]!.schedule?.[0]?.amountPoisha ?? null) : null,
      overduePoisha: overdueSeq.reduce((s, x) => s + Math.max(0, (x.amountPoisha ?? 0) - (x.paidPoisha ?? 0)), 0),
      distanceM: null, totalOutstandingPoisha: outstanding, nextDueDate: nextDue, daysOverdue, badges, tag, openPromise,
      lastVisitAt: chance(0.8) ? isoAt(now().minus({ hours: int(2, 24 * 25) })) : null, pendingFieldPoisha: 0,
      assignee: { id: assignee.id, name: assignee.name?.en }, branchId: b.id!, erpFetchedAt: fetched,
    };
    const payments: S['Payment'][] = plans.flatMap((p) =>
      (p.schedule ?? []).filter((s) => (s.paidPoisha ?? 0) > 0).map((s) => ({
        erpPaymentId: `PAY-${int(10000, 99999)}`, date: dDate(s.dueDate!).plus({ days: int(-3, 6) }).toISODate()!, amountPoisha: s.paidPoisha!,
        method: pick(['cash', 'cash', 'cash', 'bkash', 'nagad']), source: pick(['office', 'field', 'field'] as const), receiptNo: `R-${int(70000, 99999)}`, reversed: false,
      })),
    ).sort((a, b2) => (a.date! < b2.date! ? 1 : -1));
    const bad = plans.find((p) => p.badSuggested);
    const detail: S['CustomerDetail'] = {
      ...item,
      phones: [item.phone!, ...(chance(0.4) ? [phone()] : [])],
      guarantor: { name: personName().en, phone: phone() },
      plans, payments, pendingCollections: [],
      badSuggestion: bad ? { erpPlanId: bad.erpPlanId, finalDueDate: bad.finalDueDate, outstandingPoisha: bad.outstandingPoisha, text: { bn: `কিস্তির শেষ তারিখ পার হয়েছে, বকেয়া রয়েছে`, en: 'Final due date has passed with an outstanding balance' } } : null,
      recentNotes: [], lastVisit: null, version: 3,
    };
    const tagHistory: S['TagEvent'][] = tagged
      ? [{ id: oid('6770'), previous: { state: 'none' }, next: tag, reasonCode: tag.reasonCode, reason: tag.reason, actor: { id: tag.setBy, name: userName(tag.setBy), role: 'branch_manager' }, source: 'web', at: tag.setAt }]
      : [];
    customers.push({ item, detail, branchId: b.id!, areaId: area.id!, tagHistory });
    area.customerCount = (area.customerCount ?? 0) + 1;
  }
});
// a tagged customer who has since cleared the balance (FR-TAG-006 review prompt)
{
  const c = customers.find((x) => x.item.tag?.state === 'tagged')!;
  c.item.totalOutstandingPoisha = 0;
  c.item.badges = ['tagged_bad', 'paid_up'];
  c.item.daysOverdue = 0;
  c.item.overduePoisha = 0;
  c.detail.plans?.forEach((p) => {
    p.paidPoisha = p.totalPayablePoisha;
    p.outstandingPoisha = 0;
    p.status = 'completed';
    p.badSuggested = false;
    p.schedule?.forEach((s) => ((s.paidPoisha = s.amountPoisha), (s.status = 'paid')));
  });
  c.detail.badSuggestion = null;
  Object.assign(c.detail, { ...c.item, ...c.detail, totalOutstandingPoisha: 0, overduePoisha: 0, badges: c.item.badges, daysOverdue: 0 });
}
export const customerById = (id: string) => customers.find((c) => c.item.id === id);

// ---------- notes & visits ----------
const NOTE_TEXT = [
  ['ধান ওঠার পর বাকি টাকা দেবেন বলেছেন।', 'Will pay the rest after the rice harvest.'],
  ['বাড়িতে পাওয়া যায়নি, স্ত্রীর সাথে কথা হয়েছে।', 'Not at home, spoke with his wife.'],
  ['দোকান বন্ধ ছিল, বিকেলে আবার যেতে হবে।', 'Shop was closed, visit again in the afternoon.'],
  ['ছেলে বিদেশ থেকে টাকা পাঠালে পরিশোধ করবেন।', 'Will pay once his son sends money from abroad.'],
  ['ফ্রিজে সমস্যা, সার্ভিস সেন্টারে পাঠাতে বলেছেন।', 'Fridge has a fault; asked for a service centre visit.'],
];
customers.forEach((c) => {
  if (!chance(0.45)) return;
  const nNotes = int(1, 3);
  for (let i = 0; i < nNotes; i++) {
    const [bn, en] = pick(NOTE_TEXT);
    const a = userById(c.item.assignee?.id)!;
    c.detail.recentNotes!.push({ id: oid('6765'), clientId: crypto.randomUUID(), customerId: c.item.id, author: { id: a.id, name: a.name?.en }, category: pick(['payment', 'visit', 'product', 'family']), text: chance(0.6) ? bn : en, voiceMediaId: null, createdAt: isoAt(now().minus({ hours: int(3, 24 * 30) })), editableUntil: isoAt(now().minus({ hours: 1 })) });
  }
  c.detail.recentNotes!.sort((x, y) => (x.createdAt! < y.createdAt! ? 1 : -1));
});

// ---------- collections ----------
export const collections: S['Collection'][] = [];
const METHODS: S['PaymentMethod'][] = ['cash', 'cash', 'cash', 'cash', 'bkash', 'bkash', 'nagad', 'rocket', 'bank_transfer'];
let receiptSeq = 1;
for (let d = 7; d >= 0; d--) {
  const day = now().minus({ days: d }).startOf('day');
  for (const s of staff.filter((x) => x.active)) {
    // today: spread from 07:00 (early birds) to now so the demo never looks empty after 7 am
    const nCol = d === 0 ? (now().hour < 7 ? 0 : int(1, Math.max(2, Math.round((now().hour - 6) * 0.8)))) : int(4, 11);
    const mine = customers.filter((c) => c.item.assignee?.id === s.id && c.item.totalOutstandingPoisha! > 0);
    if (!mine.length) continue;
    for (let i = 0; i < nCol; i++) {
      const c = pick(mine);
      const at = d === 0 ? day.plus({ minutes: int(7 * 60, Math.max(7 * 60 + 5, now().hour * 60 + now().minute - 3)) }) : day.plus({ hours: int(9, 17), minutes: int(0, 59) });
      if (at > now()) continue;
      const method = pick(METHODS);
      const amount = Math.round(int(80000, 900000) / 5000) * 5000;
      const br = branches.find((b) => s.branchIds?.includes(b.id!))!;
      const status: S['CollectionStatus'] = d > 0 ? 'posted' : chance(0.75) ? 'posted' : chance(0.6) ? 'posting' : 'received';
      const flags: S['Collection']['flags'] = [];
      if (chance(0.04)) flags.push('far_from_pin');
      if (chance(0.01)) flags.push('mock_location');
      if (d > 0 && chance(0.03)) flags.push('late_sync');
      // 1.2.0: recorded without a GPS fix (derived from the running count so the seeded sequence is unchanged)
      if (!flags.length && collections.length % 41 === 17) flags.push('no_location');
      collections.push({
        id: oid('6750'), clientId: crypto.randomUUID(),
        customer: { id: c.item.id, name: c.item.name, code: c.item.code },
        erpPlanId: c.detail.plans?.[0]?.erpPlanId, collector: { id: s.id, name: s.name?.en },
        amountPoisha: amount, method, transactionRef: method === 'cash' ? null : `${method.slice(0, 2).toUpperCase()}${int(1e8, 9e8)}`,
        receiptNo: `${br.code}-${s.employeeCode}-${at.toFormat('yyMMdd')}-${String(receiptSeq++ % 10000).padStart(4, '0')}`,
        erpReceiptNo: status === 'posted' ? `R-${int(80000, 99999)}` : null, recordedAt: isoAt(at), receivedAt: isoAt(at.plus({ minutes: int(1, d > 0 && flags.includes('late_sync') ? 900 : 40) })),
        status, conflict: null, resolution: null, flags, distanceToPinM: flags.includes('no_location') ? (int(4, 180), null) : flags.includes('far_from_pin') ? int(320, 1400) : int(4, 180), cashOnHand: undefined,
      });
    }
  }
}
// conflicts & failures (the interesting part for managers)
// Codes and texts as field-api sends them for the real ERP's rules (contract 1.13.0, ADR-033).
const CONFLICTS = [
  ['DUPLICATE_SAME_DAY', 'ইআরপিতে এই ইনভয়েসে ওই দিনে আগেই একটি পেমেন্ট আছে', 'ERP already has a payment for this invoice on that day'],
  ['PLAN_CLOSED', 'এই ইনভয়েস ইআরপিতে বন্ধ (ফেরত বা বাতিল)', 'This invoice is closed in ERP (returned or cancelled)'],
  ['AMOUNT_EXCEEDS_OUTSTANDING', 'টাকার পরিমাণ বাকির চেয়ে বেশি', 'Amount is more than the outstanding balance'],
  ['COLLECTOR_NOT_LINKED', 'আদায়কারী ইআরপির কোনো কর্মীর সাথে যুক্ত নন', 'Collector is not linked to an ERP employee'],
  ['METHOD_NOT_AVAILABLE', 'এই পেমেন্ট মাধ্যম ইআরপিতে শাখার জন্য চালু নেই', 'This payment method is not set up for the branch in ERP'],
] as const;
collections.filter((c) => c.recordedAt! > isoAt(now().minus({ days: 3 }))).slice(0, 400).filter((_, i) => i % 61 === 7).slice(0, 5).forEach((c, i) => {
  const [code, bn, en] = CONFLICTS[i % CONFLICTS.length]!;
  c.status = 'conflict';
  c.erpReceiptNo = null;
  c.conflict = { code, message: { bn, en }, raisedAt: c.receivedAt };
  if (code === 'METHOD_NOT_AVAILABLE') {
    c.method = 'bkash';
    c.transactionRef = 'BK7G3K2Q9P';
  }
});
collections.filter((c) => c.status === 'posting').slice(0, 2).forEach((c) => (c.status = 'posting_failed'));
collections.filter((c) => c.status === 'posted' && c.recordedAt! < isoAt(now().minus({ days: 2 }))).slice(3, 5).forEach((c, i) => {
  c.status = 'voided';
  // contract 1.33.0: the first is voided by the office, the second is a cash collection the collector withdrew
  c.voided = i === 0
    ? { by: managers[0]!.id, byName: managers[0]!.name?.en ?? '', at: c.receivedAt, reason: 'Entered twice by mistake; physical receipt cancelled.', kind: 'admin' }
    : { by: c.collector!.id, byName: c.collector!.name ?? '', at: c.receivedAt, reason: 'Wrong customer', kind: 'withdrawn' };
});
// contract 1.33.0: a few unsent cash collections the collector corrected (amount shown is the new one)
[...collections].filter((c) => c.status === 'posted' && c.method === 'cash').sort((a, b) => (a.recordedAt! < b.recordedAt! ? 1 : -1)).slice(0, 3).forEach((c, i) => {
  c.status = 'received'; // an edit is only possible before the ERP has the collection
  c.erpReceiptNo = null;
  c.edited = { count: i + 1, at: c.receivedAt, by: c.collector!.id, byName: c.collector!.name ?? '', previousAmountPoisha: c.amountPoisha! + 50_000 };
});
// pending field money on customers
for (const col of collections) {
  if (['received', 'posting', 'posting_failed', 'conflict'].includes(col.status!)) {
    const c = customerById(col.customer!.id!);
    if (c) {
      c.item.pendingFieldPoisha = (c.item.pendingFieldPoisha ?? 0) + col.amountPoisha!;
      c.detail.pendingFieldPoisha = c.item.pendingFieldPoisha;
      c.detail.pendingCollections!.push(col);
    }
  }
}
export const collectionBranch = (c: S['Collection']) => userById(c.collector?.id)?.branchIds?.[0];

// ---------- cash ----------
export const deposits: (S['Deposit'] & { userName?: string })[] = [];
export const cashPositions: S['CashPosition'][] = staff.filter((s) => s.active).map((s) => {
  const todayCash = collections.filter((c) => c.collector?.id === s.id && c.method === 'cash' && c.recordedAt! >= isoAt(now().startOf('day')) && c.status !== 'voided').reduce((a, c) => a + c.amountPoisha!, 0);
  const todayMobile = collections.filter((c) => c.collector?.id === s.id && c.method !== 'cash' && c.recordedAt! >= isoAt(now().startOf('day'))).reduce((a, c) => a + c.amountPoisha!, 0);
  const carried = chance(0.12) ? Math.round(int(300000, 3500000) / 10000) * 10000 : 0;
  const onHand = todayCash + carried;
  const limit = s.cashLimitPoisha ?? 5_000_000;
  return {
    userId: s.id, userName: s.name?.en, onHandPoisha: onHand, limitPoisha: limit,
    state: onHand >= limit ? 'exceeded' : onHand >= limit * 0.8 ? 'warning' : 'ok',
    oldestUndepositedAt: onHand ? isoAt(carried ? now().minus({ days: 1, hours: int(1, 6) }) : now().startOf('day').plus({ hours: 10 })) : null,
    pendingDepositsPoisha: 0, todayCashPoisha: todayCash, todayMobilePoisha: todayMobile,
  };
});
// make one or two exceed for realism
cashPositions.slice(1, 2).forEach((p) => ((p.onHandPoisha = 5_840_000), (p.state = 'exceeded')));
cashPositions.slice(5, 6).forEach((p) => ((p.onHandPoisha = 4_250_000), (p.state = 'warning')));
staff.filter((s) => s.active).forEach((s, i) => {
  if (i % 3 !== 0) return;
  for (let d = 0; d < 3; d++) {
    // contract 1.35.0: today's deposits are `submitted` (final, they list the collections they took); the older ones are
    // deposits from before 1.35.0 that a manager verified or rejected
    const status: S['Deposit']['status'] = d === 0 ? 'submitted' : d === 1 && i === 6 ? 'rejected' : 'verified';
    const amt = Math.round(int(1500000, 4500000) / 10000) * 10000;
    deposits.push({
      id: oid('6755'), clientId: crypto.randomUUID(), userId: s.id, userName: s.name?.en, amountPoisha: amt,
      destination: pick(['branch_cashier', 'branch_cashier', 'bank'] as const), reference: d === 0 ? `SLIP-${int(1000, 9999)}` : `BC-${int(1000, 9999)}`,
      depositedAt: isoAt(now().minus({ days: d }).startOf('day').plus({ hours: 17, minutes: int(0, 50) }).minus({ days: d === 0 && now().hour < 17 ? 0 : 0 })),
      status, verifiedBy: status !== 'submitted' ? managers[0]!.id : undefined, verifiedAt: status !== 'submitted' ? isoAt(now().minus({ days: d, hours: -1 })) : undefined,
      rejectReason: status === 'rejected' ? 'Slip amount does not match the cash counted at the counter.' : undefined,
    });
  }
});
deposits.forEach((d) => {
  if (d.depositedAt! > isoAt(now())) d.depositedAt = isoAt(now().minus({ minutes: int(20, 90) }));
  if (d.verifiedAt) {
    const v = DateTime.fromISO(d.depositedAt!).plus({ minutes: int(15, 90) });
    d.verifiedAt = isoAt(v > now() ? now().minus({ minutes: 5 }) : v);
  }
});
cashPositions.forEach((p) => {
  if (p.oldestUndepositedAt && p.oldestUndepositedAt > isoAt(now())) p.oldestUndepositedAt = isoAt(now().minus({ minutes: int(60, 180) }));
});
// FR-CASH-010 (1.35.0): a submitted deposit takes every collection the person held when it was made (cash and the
// rest, each whole) since yesterday (so the demo has some before 7 am); its amount is the cash, the rest is
// `nonCashPoisha`. No random draws here, so the seed stays put.
const GONE = ['voided', 'resolved_voided', 'resolved_refund'];
for (const d of deposits.filter((x) => x.status === 'submitted')) {
  const taken = collections.filter((c) => c.collector?.id === d.userId && !c.depositId && !GONE.includes(c.status!) && c.recordedAt! >= isoAt(now().minus({ days: 1 }).startOf('day')) && c.recordedAt! < d.depositedAt!);
  taken.forEach((c) => ((c.depositId = d.id!), (c.depositedAt = d.depositedAt!)));
  const cash = taken.filter((c) => c.method === 'cash');
  d.amountPoisha = cash.reduce((n, c) => n + c.amountPoisha!, 0);
  d.nonCashPoisha = taken.reduce((n, c) => n + c.amountPoisha!, 0) - d.amountPoisha;
  d.nonCashCount = taken.length - cash.length;
  d.collectionCount = taken.length;
  const pos = cashPositions.find((p) => p.userId === d.userId);
  if (pos) {
    pos.onHandPoisha = Math.max(0, (pos.onHandPoisha ?? 0) - d.amountPoisha);
    pos.state = pos.onHandPoisha >= pos.limitPoisha! ? 'exceeded' : pos.onHandPoisha >= pos.limitPoisha! * 0.8 ? 'warning' : 'ok';
    if (!pos.onHandPoisha) pos.oldestUndepositedAt = null;
  }
}
// a deposit of nothing is refused by the server (NOTHING_TO_DEPOSIT), so the mock keeps none
for (let k = deposits.length - 1; k >= 0; k--) if (deposits[k]!.status === 'submitted' && !deposits[k]!.collectionCount) deposits.splice(k, 1);

// ---------- inbox ----------
export const inbox: S['InboxItem'][] = [];
const addInbox = (type: string, severity: S['InboxItem']['severity'], branchId: string | undefined, entity: string, entityId: string, bn: string, en: string, link: string, minsAgo: number) =>
  inbox.push({ id: oid('6790'), type, severity, branchId, entity, entityId, summary: { bn, en }, status: 'open', createdAt: isoAt(now().minus({ minutes: minsAgo })), link });
collections.filter((c) => c.status === 'conflict').forEach((c) => {
  const nm = c.customer?.name;
  addInbox('collection.conflict', 'critical', collectionBranch(c), 'collection', c.id!, `কনফ্লিক্ট: ${nm?.bn} — ${c.conflict?.message?.bn}`, `Conflict: ${nm?.en} — ${c.conflict?.message?.en}`, `/collections/conflicts/?id=${c.id}`, int(15, 600));
});
collections.filter((c) => c.status === 'posting_failed').forEach((c) => addInbox('collection.posting_failed', 'high', collectionBranch(c), 'collection', c.id!, `ERP-তে পোস্টিং ব্যর্থ: ${c.customer?.name?.bn}`, `ERP posting failed: ${c.customer?.name?.en}`, `/collections/?drawer=collection:${c.id}`, int(20, 200)));
cashPositions.filter((p) => p.state === 'exceeded').forEach((p) => {
  const u = userById(p.userId)!;
  addInbox('cash.limit_exceeded', 'high', u.branchIds?.[0], 'user', u.id!, `${u.name?.bn}-এর হাতে নগদ সীমা ছাড়িয়েছে`, `${u.name?.en} is over the cash-on-hand limit`, '/cash/', int(10, 120));
});
{
  const cleared = customers.find((c) => c.item.tag?.state === 'tagged' && c.item.totalOutstandingPoisha === 0)!;
  addInbox('tag.balance_cleared', 'medium', cleared.branchId, 'customer', cleared.item.id!, `${cleared.item.name?.bn} বকেয়া পরিশোধ করেছেন — ট্যাগ পর্যালোচনা করুন`, `${cleared.item.name?.en} cleared the balance — review the tag`, `/customers/${cleared.item.id}/`, 240);
}
// a reminder raised before 1.35.0 for a deposit that nobody verified; the server raises none any more (ADR-049)
{
  const old = deposits.find((d) => d.status === 'verified')!;
  const u = userById(old.userId)!;
  addInbox('cash.deposit.pending', 'medium', u.branchIds?.[0], 'deposit', old.id!, 'জমা ২৪ ঘণ্টার বেশি যাচাই হয়নি', 'Deposit unverified for more than 24 hours', '/cash/deposits?status=pending', 1500);
}
collections.filter((c) => c.flags?.includes('mock_location')).slice(0, 2).forEach((c) => addInbox('fraud.mock_location', 'high', collectionBranch(c), 'collection', c.id!, `মক লোকেশন সন্দেহ: ${userById(c.collector?.id)?.name?.bn}`, `Mock location suspected: ${c.collector?.name}`, `/collections/?drawer=collection:${c.id}`, int(40, 500)));
addInbox('device.pending_approval', 'medium', branches[1]!.id, 'device', 'dev-1', `${staff[14]!.name?.bn} নতুন ফোন থেকে লগইন করতে চান`, `${staff[14]!.name?.en} wants to sign in from a new phone`, '/admin/devices/', 95);
addInbox('location.proposal', 'low', branches[0]!.id, 'customer', customers[4]!.item.id!, `পিন সংশোধনের প্রস্তাব: ${customers[4]!.item.name?.bn}`, `Pin correction proposed: ${customers[4]!.item.name?.en}`, `/customers/${customers[4]!.item.id}/`, 300);
addInbox('promise.broken', 'low', branches[0]!.id, 'customer', customers[9]!.item.id!, `প্রতিশ্রুতি ভঙ্গ: ${customers[9]!.item.name?.bn}`, `Promise broken: ${customers[9]!.item.name?.en}`, `/customers/${customers[9]!.item.id}/`, 700);
inbox.sort((a, b) => (a.createdAt! < b.createdAt! ? 1 : -1));

// ---------- flags ----------
const FLAG_DEFS: [string, string, boolean][] = [
  ['module.dashboard', 'Overview dashboard and KPIs', true], ['module.inbox', 'Needs-attention exceptions inbox', true],
  ['module.customers', 'Customers list, detail and map', true], ['module.tags', 'Bad-customer suggestion and tagging', true],
  ['module.collections', 'Field collections and conflicts', true], ['module.cash', 'Cash on hand and deposits', true],
  ['module.assignments', 'Areas and assignments', true], ['module.handovers', 'Handovers between staff', true],
  ['module.visits', 'Visits and photos', true], ['module.notes', 'Customer notes', true], ['module.promises', 'Promise-to-pay', true],
  ['module.attendance', 'Attendance and breaks', true], ['module.location', 'Duty-hour location tracking', true],
  ['module.stops', 'Stop and visit suggestions', false], ['module.reports', 'Reports and exports', true],
  ['module.notifications', 'Push notifications and broadcasts', true], ['module.devices', 'Device binding and approvals', true],
  ['module.search', 'Global search', true], ['module.cowork', 'Co-work: staff working together', true], ['module.targets', 'Daily targets per staff', true], ['module.tasks', 'Admin tasks for staff', true], ['module.places', 'Map places (text markers on the map)', true], ['module.activity', 'Staff activity feed', true], ['module.sync', 'Offline sync endpoints', true],
  ['module.sms', 'SMS receipts to customers (OD-06, proposed)', false], ['module.microfinance', 'RESERVED — blocked until legal review', false],
];
export const flags: S['FeatureFlag'][] = FLAG_DEFS.map(([key, description, on]) => ({
  key, defaultEnabled: on, branchOverrides: key === 'module.location' ? [{ branchId: branches[2]!.id!, enabled: false }] : [],
  description, owner: key === 'module.microfinance' ? 'Legal' : 'Ops', reviewBy: '2027-03-31', lockedReason: key === 'module.microfinance' ? 'Reserved until MF-001 legal review is complete' : undefined,
}));

// ---------- permissions / overrides ----------
export const branchOverrides: Record<string, Partial<Record<Role, Record<string, 'allow' | 'deny'>>>> = {};
export const userOverrides: Record<string, Record<string, 'allow' | 'deny'>> = {};
userOverrides[staff[2]!.id!] = { 'tag.set': 'deny' };
branchOverrides[branches[2]!.id!] = { branch_manager: { 'cash.limit.manage': 'allow' } };

export function effective(u: MockUser) {
  return catalog.map((p) => {
    if (p.reserved) return { key: p.key, allowed: false, source: 'reserved' as const };
    if (u.role === 'super_admin') return { key: p.key, allowed: true, source: 'super_admin' as const };
    const uo = userOverrides[u.id!]?.[p.key];
    if (uo) return { key: p.key, allowed: uo === 'allow', source: 'user' as const };
    for (const b of u.branchIds ?? []) {
      const bo = branchOverrides[b]?.[u.role!]?.[p.key];
      if (bo) return { key: p.key, allowed: bo === 'allow', source: 'branch' as const };
    }
    return { key: p.key, allowed: !!p.defaults[u.role!], source: 'role' as const };
  });
}

// ---------- settings ----------
/** The keys field-api defines (its module manifests). `PATCH /settings` answers 400 for any other key, as the server does. */
export const settings: Record<string, unknown> = {
  'attendance.defaultShift': { start: '09:00', end: '18:00', weeklyOff: [5], lateGraceMin: 15, maxBreakMin: 60, breakWindows: [] },
  'attendance.overtimeAfterMin': 30, 'attendance.lateDaysPerAbsent': 2,
  'cash.limitPoisha': 5_000_000, 'cash.limitMode': 'warn',
  'location.trackingProvider': 'free', 'location.providerConfig': {}, 'location.retentionDays': 90, 'location.trackDuringBreak': false, 'location.maxAccuracyM': 50,
  'location.sampling': { fastSec: 15, slowSec: 45, stillSec: 180, distanceFilterM: 25, maxAccuracyM: 50 }, 'location.gapMin': 10, 'location.lostAfterMin': 30,
  'collections.geofenceM': 300, 'collections.photoRequiredAbovePoisha': 0, 'tags.requireApproval': false,
  'promises.graceDays': 1, 'attendance.selfieRequired': true, 'attendance.selfieEvents': ['work_in', 'break_start', 'break_end', 'work_out'], 'cowork.visitCredit': 1, 'cowork.maxMembers': 5, 'app.minVersion': '1.0.0',
  'reports.leaderboardVisibleToStaff': false, 'reports.leaderboardScope': 'all', 'reports.leaderboardMinPresentDays': 1, 'reports.dataQualityMaxBranchKm': 30,
  'customers.staffVisibility': 'branch', 'customers.staffPinApproval': 'when_missing',
};
/** Values a branch has of its own (branchId → key → value); everything else falls back to `settings`. */
export const settingOverrides: Record<string, Record<string, unknown>> = {};
/** Settings a branch may override (`branchOverridable` in field-api). */
export const BRANCH_SETTINGS = new Set(['attendance.defaultShift', 'attendance.overtimeAfterMin', 'attendance.selfieRequired', 'attendance.selfieEvents', 'cash.limitPoisha', 'cash.limitMode', 'collections.geofenceM', 'collections.photoRequiredAbovePoisha', 'customers.staffVisibility', 'customers.staffPinApproval', 'tags.requireApproval', 'promises.graceDays', 'location.sampling', 'location.trackDuringBreak', 'cowork.visitCredit', 'cowork.maxMembers', 'reports.leaderboardVisibleToStaff', 'reports.leaderboardMinPresentDays', 'reports.dataQualityMaxBranchKm']);
// ---------- audit ----------
export const audit: S['AuditEntry'][] = [];
export function addAudit(e: Omit<S['AuditEntry'], 'id' | 'at' | 'requestId'> & { at?: string }) {
  audit.unshift({ id: oid('6799'), at: e.at ?? isoAt(now()), requestId: `req_${Math.random().toString(36).slice(2, 10)}`, ip: '103.48.16.22', ...e });
}
const seedAudit: [string, string, Record<string, unknown>, Record<string, unknown>, string][] = [
  ['rbac.override.set', 'user', { 'tag.set': 'inherit' }, { 'tag.set': 'deny' }, 'Repeated wrong tags last month; manager will tag for now.'],
  ['flag.set', 'feature_flag', { enabled: false }, { enabled: true, branch: 'BRL01' }, 'Pilot of location tracking in Barishal Sadar.'],
  ['collection.void', 'collection', { status: 'posted' }, { status: 'voided' }, 'Entered twice by mistake; physical receipt cancelled.'],
  ['tag.set', 'customer', { state: 'none' }, { state: 'tagged', severity: 'bad' }, 'Plan ended four months ago, refuses to pay.'],
  ['deposit.verify', 'deposit', { status: 'pending' }, { status: 'verified' }, 'Counted at branch counter.'],
  ['settings.update', 'settings', { 'cash.limitPoisha': 4_000_000 }, { 'cash.limitPoisha': 5_000_000 }, 'Higher limit for festival season collections.'],
  ['handover.create', 'handover', {}, { from: 'FS004', to: 'FS007', customers: 34 }, 'Staff on leave for two weeks.'],
  ['user.create', 'user', {}, { role: 'field_staff', branch: 'PTK01' }, 'New joiner.'],
  ['auth.login', 'session', {}, { client: 'web' }, ''],
  ['location.proposal.approve', 'customer', { lat: 22.7011, lng: 90.3654 }, { lat: 22.7032, lng: 90.3671 }, 'Verified on site by manager.'],
];
for (let i = 0; i < 70; i++) {
  const [action, entity, before, after, reason] = seedAudit[i % seedAudit.length]!;
  const actor = i % 4 === 0 ? superAdmin : pick(managers);
  addAudit({ at: isoAt(now().minus({ minutes: 25 + i * int(40, 170) })), actor: { id: actor.id, name: actor.name?.en, role: actor.role }, action, entity, entityId: oid('6740'), branchId: actor.branchIds?.[0], before, after, reason });
}
audit.sort((a, b) => (a.at! < b.at! ? 1 : -1));

export const erpStatus: S['ErpStatus'] = { mode: 'live', lastSuccessAt: isoAt(now().minus({ minutes: 3 })), lagSec: 180, consecutiveFailures: 0, circuit: 'closed', outboxPending: collections.filter((c) => c.status === 'posting' || c.status === 'received').length, outboxFailed: collections.filter((c) => c.status === 'posting_failed').length };

// ---------- handovers (seeded without the RNG so earlier data stays identical) ----------
export const handovers: S['Handover'][] = [];
export function handoverSummary(areaIds: string[]): NonNullable<S['Handover']['summary']> {
  const list = customers.filter((c) => areaIds.includes(c.areaId));
  return {
    customers: list.length,
    outstandingPoisha: list.reduce((s, c) => s + (c.item.totalOutstandingPoisha ?? 0), 0),
    overdue: list.filter((c) => (c.item.daysOverdue ?? 0) > 0).length,
    openPromises: list.filter((c) => c.item.openPromise).length,
    openConflicts: collections.filter((c) => c.status === 'conflict' && list.some((x) => x.item.id === c.customer?.id)).length,
  };
}
branches.forEach((b, bi) => {
  const bStaff = staff.filter((s) => s.branchIds?.[0] === b.id && s.active);
  const held = (u: MockUser) => areas.filter((a) => a.assignees?.includes(u.id!)).map((a) => a.id!);
  const mgr = managers[bi]!;
  const mk = (from: MockUser, to: MockUser, status: S['HandoverStatus'], hoursAgo: number, reason: string, extra: Partial<S['Handover']> = {}) => {
    const areaIds = held(from).slice(0, 1);
    if (!areaIds.length) return;
    const created = now().minus({ hours: hoursAgo });
    handovers.push({
      id: oid('6770'), fromUserId: from.id!, toUserId: to.id!, areaIds, customerIds: [], reason, effectiveDate: created.toISODate()!, status,
      createdBy: mgr.id, createdAt: isoAt(created), expiresAt: isoAt(created.plus({ hours: 72 })), summary: handoverSummary(areaIds), ...extra,
    });
  };
  mk(bStaff[0]!, bStaff[1]!, 'pending_acceptance', 5, 'দুই সপ্তাহের ছুটি, এই সময়ে এলাকা দেখবেন।', { endDate: now().plus({ days: 14 }).toISODate()! });
  mk(bStaff[2]!, bStaff[4]!, 'pending_acceptance', 55, 'Moved to a nearer area after relocation.');
  mk(bStaff[3]!, bStaff[5]!, 'accepted', 24 * 6, 'Workload balancing after new joiner.');
  mk(bStaff[1]!, bStaff[2]!, 'rejected', 24 * 12, 'Cover during training week.');
  mk(bStaff[4]!, bStaff[0]!, 'expired', 24 * 20, 'Temporary cover for sick leave.');
});

// ---------- promises & visits (own small generator so the main seeded sequence is untouched) ----------
let lcg = 20261115;
const r2 = () => ((lcg = (lcg * 1664525 + 1013904223) >>> 0), lcg / 4294967296);
const i2 = (a: number, b: number) => a + Math.floor(r2() * (b - a + 1));
const p2 = <T,>(arr: readonly T[]): T => arr[Math.floor(r2() * arr.length)]!;

export interface MockPromise { row: S['PromiseListItem']; branchId: string }
export const promises: MockPromise[] = [];
const NOTES = ['বেতন পেলে দেবেন', 'ধান বিক্রির পর দেবেন', 'Will pay after remittance arrives', 'ছেলে টাকা পাঠালে দেবেন', ''];
for (const c of customers) {
  const ref = { id: c.item.id, name: c.item.name, code: c.item.code };
  const owner = { id: c.item.assignee?.id, name: c.item.assignee?.name };
  if (c.item.openPromise) promises.push({ branchId: c.branchId, row: { ...c.item.openPromise, note: p2(NOTES) || undefined, customer: ref, owner } });
  if ((c.item.daysOverdue ?? 0) > 0 && r2() < 0.45) {
    const n = i2(1, 2);
    for (let k = 0; k < n; k++) {
      const daysAgo = i2(1, 30);
      const amount = Math.round(i2(200000, 1200000) / 10000) * 10000;
      const status = p2(['kept', 'kept', 'partially_kept', 'broken', 'broken', 'superseded', 'cancelled'] as const);
      const date = now().minus({ days: daysAgo });
      promises.push({
        branchId: c.branchId,
        row: {
          id: oid('6760'), clientId: crypto.randomUUID(), customerId: c.item.id!, erpPlanId: c.detail.plans?.[0]?.erpPlanId, promisedDate: date.toISODate()!, promisedAmountPoisha: amount,
          note: p2(NOTES) || undefined, status, ownerId: owner.id, paidTowardsPoisha: status === 'kept' ? amount : status === 'partially_kept' ? Math.round((amount * i2(20, 70)) / 100 / 5000) * 5000 : 0,
          createdAt: isoAt(date.minus({ days: i2(2, 9) })), customer: ref, owner,
        },
      });
    }
  }
}
// a few open promises already past their date (within grace) so "late" shows up
promises.filter((p) => p.row.status === 'open' && p.row.promisedDate > T).slice(0, 6).forEach((p, i) => (p.row.promisedDate = now().minus({ days: 1 + (i % 2) }).toISODate()!));

export interface MockVisit { row: S['VisitListItem']; branchId: string }
export const visits: MockVisit[] = [];
const OUTCOMES = ['paid', 'paid', 'partial_paid', 'promised', 'promised', 'not_home', 'not_home', 'refused', 'shifted_address', 'other', 'product_returned_request'] as const;
for (let d = 0; d < 30; d++) {
  for (const s of staff.filter((x) => x.active)) {
    const mine = customers.filter((c) => c.item.assignee?.id === s.id);
    if (!mine.length) continue;
    const n = d === 0 ? i2(3, 7) : i2(2, 6);
    for (let k = 0; k < n; k++) {
      const c = p2(mine);
      const at = now().startOf('day').minus({ days: d }).plus({ hours: 9, minutes: i2(0, 8 * 60) });
      if (at > now()) continue;
      const mock = r2() < 0.012;
      const noGeo = !mock && r2() < 0.03;
      const far = !mock && !noGeo && r2() < 0.05;
      const dist = far ? i2(320, 1500) : i2(3, 160);
      const ongoing = d === 0 && k === 0 && at > now().minus({ minutes: 25 });
      visits.push({
        branchId: c.branchId,
        row: {
          id: oid('6765'), clientId: crypto.randomUUID(), customerId: c.item.id!, userId: s.id, checkInAt: isoAt(at), checkOutAt: ongoing ? null : isoAt(at.plus({ minutes: i2(2, 22) })),
          outcome: p2(OUTCOMES), geo: noGeo ? null : { lat: (c.item.location?.lat ?? 22.7) + dist / 111_000, lng: c.item.location?.lng ?? 90.36, accuracyM: i2(4, 38), mock, fixAt: isoAt(at) },
          geoUnavailableReason: noGeo ? p2(['permission_denied', 'location_off', 'timeout', 'no_fix'] as const) : undefined,
          photoMediaIds: r2() < 0.35 ? Array.from({ length: i2(1, 3) }, () => oid('6768')) : [], source: r2() < 0.3 ? 'suggested' : 'manual',
          distanceToPinM: noGeo || c.item.location?.status !== 'ok' ? null : dist, flags: [...(mock ? ['mock_location'] : []), ...(far ? ['far_from_pin'] : [])],
          customer: { id: c.item.id, name: c.item.name, code: c.item.code }, user: { id: s.id, name: s.name?.en },
        },
      });
    }
  }
}
visits.sort((a, b) => (a.row.checkInAt < b.row.checkInAt ? 1 : -1));

// ---------- co-work (FR-CW, contract 1.9.0): own generator so the sequences above stay as they were ----------
let lcg3 = 20261116;
const r3 = () => ((lcg3 = (lcg3 * 1664525 + 1013904223) >>> 0), lcg3 / 4294967296);
const i3 = (a: number, b: number) => a + Math.floor(r3() * (b - a + 1));
export const coworkSessions: S['CoworkSession'][] = [];
for (const b of branches) {
  const team = fieldStaffOf(b.id!);
  for (let d = 0; d < 21; d++) {
    const used = new Set<string>();
    const groups = d === 0 ? 2 : i3(0, 2);
    for (let g = 0; g < groups; g++) {
      const free = team.filter((x) => !used.has(x.id!));
      if (free.length < 2) break;
      const size = Math.min(free.length, r3() < 0.7 ? 2 : 3);
      const picked = [...free].sort(() => r3() - 0.5).slice(0, size);
      picked.forEach((x) => used.add(x.id!));
      const start = now().startOf('day').minus({ days: d }).plus({ hours: 9, minutes: 30 + i3(0, 90) });
      if (start > now()) continue;
      const creator = picked[0]!;
      const members: S['CoworkMember'][] = [{ userId: creator.id, name: creator.name?.en, status: 'accepted', invitedBy: creator.id, invitedAt: isoAt(start), respondedAt: isoAt(start), leftAt: null }];
      for (const x of picked.slice(1)) {
        const at = start.plus({ minutes: i3(1, 12) });
        const answered = at <= now();
        members.push({ userId: x.id, name: x.name?.en, status: answered ? 'accepted' : 'invited', invitedBy: creator.id, invitedAt: isoAt(start), respondedAt: answered ? isoAt(at) : null, leftAt: null });
      }
      const extra = team.find((x) => !used.has(x.id!));
      if (extra && r3() < 0.35) {
        used.add(extra.id!);
        members.push({ userId: extra.id, name: extra.name?.en, status: 'rejected', invitedBy: creator.id, invitedAt: isoAt(start), respondedAt: isoAt(start.plus({ minutes: i3(2, 20) })), leftAt: null });
      }
      const midnight = now().startOf('day').minus({ days: d - 1 });
      let endedAt: string | null = d === 0 ? null : isoAt(midnight);
      const leaver = members.filter((m) => m.status === 'accepted' && m.userId !== creator.id).at(-1);
      if (leaver && d > 0 && r3() < 0.3) {
        leaver.status = 'left';
        leaver.leftAt = isoAt(start.plus({ minutes: i3(90, 240) }));
        // a pair breaks up when one leaves: the group ends then
        if (members.filter((m) => m.status === 'accepted').length < 2) endedAt = leaver.leftAt;
      }
      coworkSessions.push({
        id: oid('6790'), businessDate: start.toISODate()!, branchId: b.id, status: d === 0 ? 'open' : 'ended', createdBy: creator.id,
        note: r3() < 0.3 ? 'বড় বকেয়া এলাকায় একসাথে' : null, members, createdAt: isoAt(start), endedAt,
      });
    }
  }
}
// FR-CW-003: a member's visits while in the group are joint, with the others in the group at check-in as partners
const inGroup = (m: S['CoworkMember'], at: string, end: string | null) => (m.status === 'accepted' || m.status === 'left') && !!m.respondedAt && m.respondedAt <= at && (!m.leftAt || at < m.leftAt) && (!end || at < end);
for (const cs of coworkSessions) {
  for (const v of visits) {
    const m = cs.members.find((x) => x.userId === v.row.userId);
    if (!m || !inGroup(m, v.row.checkInAt, cs.endedAt ?? null)) continue;
    const partners = cs.members.filter((x) => x.userId !== m.userId && inGroup(x, v.row.checkInAt, cs.endedAt ?? null));
    if (!partners.length) continue;
    v.row.coWorkSessionId = cs.id;
    v.row.coWork = { sessionId: cs.id, participantIds: partners.map((x) => x.userId!), participants: partners.map((x) => ({ id: x.userId, name: x.name })) };
  }
}
// two visits that claimed co-work the server could not confirm (kept as single, flagged)
for (const d of [0, 1]) {
  const day = now().startOf('day').minus({ days: d }).toISODate()!;
  const v = visits.find((x) => !x.row.coWork && DateTime.fromISO(x.row.checkInAt).setZone(ZONE).toISODate() === day);
  if (v) v.row.flags = [...(v.row.flags ?? []), 'cowork_invalid'];
}
// FR-VIS-006 (contract 1.41.0): a few finished visits where the customer had absconded (outcome `runaway`)
for (const v of visits.filter((x) => x.row.checkOutAt && x.row.outcome === 'other').slice(0, 3)) v.row.outcome = 'runaway';

// ---------- attendance (pure function of user + date, plus manager corrections) ----------
export const attendanceCorrections = new Map<string, { type: string; at: string }[]>();
/** FR-MED-004: days whose photos an admin deleted, `${userId}:${date}` → who and when. */
export const deletedSelfies = new Map<string, { at: string; by: string; byName: string }>();
function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
export function attendanceDay(u: MockUser, date: string): S['AttendanceDay'] {
  const d = DateTime.fromISO(date, { zone: 'Asia/Dhaka' });
  const base = { userId: u.id, businessDate: date, lateMin: 0, breakMin: 0, dutyMin: 0, overBreakMin: 0, overtimeMin: 0, breaks: [], autoClosed: false, corrected: false, flags: [] };
  if (d.weekday === 5) return { ...base, status: 'weekly_off', firstIn: null, lastOut: null };
  const h = hash(`${u.id}:${date}`);
  const isToday = date === T;
  const corr = attendanceCorrections.get(`${u.id}:${date}`);
  const roll = h % 100;
  let status: S['AttendanceDay']['status'] = roll < 4 ? 'absent' : roll < 7 ? 'leave' : roll < 20 ? 'late' : 'present';
  if (corr?.some((c) => c.type === 'work_in') && (status === 'absent' || status === 'leave')) status = 'present';
  if (status === 'absent' || status === 'leave') return { ...base, status: isToday && status === 'absent' ? 'not_started' : status, firstIn: null, lastOut: null };
  const lateMin = status === 'late' ? 16 + ((h >> 8) % 70) : 0;
  let inAt = d.set({ hour: 9, minute: 0 }).plus({ minutes: status === 'late' ? lateMin : -((h >> 4) % 14) });
  let outAt = d.set({ hour: 18, minute: 0 }).plus({ minutes: (h >> 12) % 35 });
  const cin = corr?.findLast((c) => c.type === 'work_in');
  const cout = corr?.findLast((c) => c.type === 'work_out');
  if (cin) inAt = DateTime.fromISO(cin.at, { zone: 'Asia/Dhaka' });
  if (cout) outAt = DateTime.fromISO(cout.at, { zone: 'Asia/Dhaka' });
  const late = Math.max(0, Math.round(inAt.diff(d.set({ hour: 9, minute: 15 }), 'minutes').minutes)) > 0 ? Math.max(0, Math.round(inAt.diff(d.set({ hour: 9, minute: 0 }), 'minutes').minutes)) : 0;
  const breakMin = 25 + ((h >> 16) % 50);
  const bStart = d.set({ hour: 13, minute: (h >> 20) % 30 });
  if (isToday) {
    const n = now();
    if (inAt > n) return { ...base, status: 'not_started', firstIn: null, lastOut: null, corrected: !!corr };
    const onBreak = n > bStart && n < bStart.plus({ minutes: breakMin });
    const done = n > outAt;
    const br = n > bStart ? [{ start: isoAt(bStart), end: onBreak ? null : isoAt(bStart.plus({ minutes: breakMin })) }] : [];
    const worked = Math.round((done ? outAt : n).diff(inAt, 'minutes').minutes);
    const brk = n > bStart ? Math.min(breakMin, Math.round(n.diff(bStart, 'minutes').minutes)) : 0;
    return { ...base, status: done ? 'off_duty' : onBreak ? 'on_break' : 'on_duty', firstIn: isoAt(inAt), lastOut: done ? isoAt(outAt) : null, lateMin: late, breakMin: brk, dutyMin: Math.max(0, worked - brk), breaks: br, corrected: !!corr };
  }
  const autoClosed = !cout && h % 37 === 0;
  // as field-api 1.25.0: duty after 18:00 is overtime from 30 minutes, never on a day the system closed
  const after = Math.round(outAt.diff(d.set({ hour: 18, minute: 0 }), 'minutes').minutes);
  const overtimeMin = !autoClosed && after >= Number(settings['attendance.overtimeAfterMin'] ?? 30) ? after : 0;
  return {
    ...base, status: late > 0 ? 'late' : 'present', firstIn: isoAt(inAt), lastOut: isoAt(outAt), lateMin: late, breakMin, overBreakMin: Math.max(0, breakMin - 60), overtimeMin,
    dutyMin: Math.max(0, Math.round(outAt.diff(inAt, 'minutes').minutes) - breakMin), breaks: [{ start: isoAt(bStart), end: isoAt(bStart.plus({ minutes: breakMin })) }],
    autoClosed, corrected: !!corr, flags: [...(breakMin > 60 ? ['over_break'] : []), ...(overtimeMin > 0 ? ['overtime'] : []), ...(noSelfieAt(u.id!, date).length ? ['no_selfie'] : [])],
  };
}
/** Event types of a day that came without a photo (about one day in nine misses one). */
function noSelfieAt(userId: string, date: string): string[] {
  const h = hash(`selfie:${userId}:${date}`);
  return h % 9 === 0 ? [(['work_in', 'break_start', 'break_end', 'work_out'] as const)[(h >> 5) % 4]!] : [];
}
export function attendanceEvents(u: MockUser, date: string): S['AttendanceEvent'][] {
  const d = attendanceDay(u, date);
  const b = branches.find((x) => x.id === u.branchIds?.[0]);
  const missing = noSelfieAt(u.id!, date);
  const h = hash(`ev:${u.id}:${date}`);
  const corr = attendanceCorrections.get(`${u.id}:${date}`) ?? [];
  const raw: { type: S['AttendanceEvent']['type']; at: string }[] = [];
  if (d.firstIn) raw.push({ type: 'work_in', at: d.firstIn });
  for (const br of d.breaks ?? []) {
    if (br.start) raw.push({ type: 'break_start', at: br.start });
    if (br.end) raw.push({ type: 'break_end', at: br.end });
  }
  if (d.lastOut && !d.autoClosed) raw.push({ type: 'work_out', at: d.lastOut });
  return raw.map((e, i) => {
    const corrected = corr.some((c) => c.type === e.type);
    const none = !corrected && missing.includes(e.type);
    return {
      id: `${u.id}-${date}-${e.type}-${i}`, type: e.type, at: e.at, source: corrected ? ('correction' as const) : ('app' as const), replaced: false,
      geo: corrected ? null : { lat: (b?.lat ?? 22.7) + (((h >> (i * 3)) % 60) - 30) / 10_000, lng: (b?.lng ?? 90.36) + (((h >> (i * 2 + 1)) % 60) - 30) / 10_000, accuracyM: 6 + ((h >> i) % 30), mock: false },
      selfieMediaId: corrected || none || deletedSelfies.has(`${u.id}:${date}`) ? null : `selfie-${u.id}-${date}-${e.type}`,
      selfieDeleted: !corrected && !none ? (deletedSelfies.get(`${u.id}:${date}`) ?? null) : null,
      flags: [...(none ? ['no_selfie'] : []), ...(corrected ? ['no_location'] : [])],
    };
  });
}

// ---------- photo storage (FR-MED-003): photos of the three months before this one ----------
export interface PhotoMonth { month: string; photos: number; proofs: number }
let photoStock: PhotoMonth[] | null = null;
export function photoMonths(): PhotoMonth[] {
  if (!photoStock) {
    const m = now().startOf('month');
    photoStock = [
      { month: m.minus({ months: 3 }).toFormat('yyyy-MM'), photos: 95, proofs: 4 },
      { month: m.minus({ months: 2 }).toFormat('yyyy-MM'), photos: 388, proofs: 11 },
      { month: m.minus({ months: 1 }).toFormat('yyyy-MM'), photos: 412, proofs: 13 },
    ];
  }
  return photoStock;
}
export const PHOTO_BYTES = 240 * 1024;

// ---------- pin proposals ----------
export interface MockProposal { row: S['LocationProposal']; branchId: string }
export const proposals: MockProposal[] = [];
{
  const PNOTES = ['বাড়ি মসজিদের পাশের গলিতে', 'ERP pin was at the market, home is behind the school', 'নতুন বাড়িতে উঠেছেন', null];
  const withPin = customers.filter((c) => c.item.location?.status === 'ok');
  const noPin = customers.filter((c) => c.item.location?.status !== 'ok');
  const pickN = (arr: MockCustomer[], n: number) => Array.from({ length: Math.min(n, arr.length) }, (_, i) => arr[(i * 37 + 11) % arr.length]!);
  [...pickN(withPin, 7), ...pickN(noPin, 3)].forEach((c, i) => {
    const cur = c.item.location?.status === 'ok' ? { lat: c.item.location.lat!, lng: c.item.location.lng! } : null;
    const b = branches.find((x) => x.id === c.branchId)!;
    const far = i % 4 === 3;
    const base = cur ?? { lat: (b.lat ?? 22.7) + (r2() - 0.5) * 0.05, lng: (b.lng ?? 90.36) + (r2() - 0.5) * 0.05 };
    const off = (far ? i2(600, 1400) : i2(25, 220)) / 111_000;
    const status = i < 6 ? 'pending' : i % 2 ? 'approved' : 'rejected';
    proposals.push({
      branchId: c.branchId,
      row: {
        id: oid('6772'), customer: { id: c.item.id, name: c.item.name, code: c.item.code, current: cur as never }, lat: base.lat + off * (i % 2 ? 1 : -0.6), lng: base.lng + off * (i % 3 ? 0.8 : -1),
        accuracyM: far ? i2(40, 90) : i2(5, 24), photoMediaId: null, note: PNOTES[i % PNOTES.length], proposedBy: c.item.assignee?.id, proposer: { id: c.item.assignee?.id, name: c.item.assignee?.name },
        status, createdAt: isoAt(now().minus({ hours: 3 + i * 7 })),
        // 1.11.0: pins for customers without one were picked on the map; an approved one was applied at once
        ...(cur ? { method: 'gps' as const } : { method: 'map' as const, accuracyM: 0, deviceDistanceM: far ? i2(700, 1500) : i2(10, 120), deviceMock: false, autoApplied: status === 'approved', decidedAt: status === 'pending' ? null : isoAt(now().minus({ hours: 3 + i * 7 })) }),
      },
    });
  });
}

// ---------- activity (FR-ACT-001, contract 1.28.0) ----------
/** The staff activity feed, derived from the mock records the way field-api writes it from events; newest first. */
export const activity: S['ActivityItem'][] = [];
/** Per user: when they last marked the feed as seen. */
export const activitySeen = new Map<string, string>();
{
  const person = (id?: string | null) => {
    const u = userById(id);
    return u ? { id: u.id!, name: { bn: u.name?.bn ?? '', en: u.name?.en ?? '' }, employeeCode: u.employeeCode ?? '' } : null;
  };
  const cust = (id?: string | null) => {
    const c = customers.find((x) => x.item.id === id);
    return c ? { id: c.item.id!, name: { bn: c.item.name?.bn ?? '', en: c.item.name?.en ?? '' }, code: c.item.code ?? '' } : null;
  };
  const since = now().minus({ days: 3 });
  const recent = (iso?: string | null) => !!iso && DateTime.fromISO(iso) >= since && DateTime.fromISO(iso) <= now();
  const push = (x: Omit<S['ActivityItem'], 'id' | 'unseen'>) => activity.push({ ...x, id: oid('67a0'), unseen: true });
  for (const c of collections)
    if (recent(c.recordedAt) && c.status !== 'voided')
      push({ type: 'collection', at: c.recordedAt!, branchId: collectionBranch(c) ?? null, actor: person(c.collector?.id), customer: cust(c.customer?.id), entity: 'collection', entityId: c.id!, data: { amountPoisha: c.amountPoisha, method: c.method, ...(c.flags?.length ? { flags: [...c.flags] } : {}) } });
  for (const v of visits)
    if (recent(v.row.checkInAt))
      push({ type: 'visit', at: v.row.checkInAt!, branchId: v.branchId, actor: person(v.row.userId), customer: cust(v.row.customerId), entity: 'visit', entityId: v.row.id!, data: { ...(v.row.outcome ? { outcome: v.row.outcome } : {}) } });
  for (const p of promises)
    if (recent(p.row.createdAt))
      push({ type: 'promise', at: p.row.createdAt!, branchId: p.branchId, actor: person(p.row.owner?.id), customer: cust(p.row.customer?.id), entity: 'promise', entityId: p.row.id!, data: { ...(p.row.promisedDate ? { promisedDate: p.row.promisedDate } : {}) } });
  for (const p of proposals)
    if (recent(p.row.createdAt))
      push({ type: 'pin', at: p.row.createdAt!, branchId: p.branchId, actor: person(p.row.proposedBy), customer: cust(p.row.customer?.id), entity: 'customer', entityId: p.row.customer?.id ?? '', data: { applied: !!p.row.autoApplied } });
  // contract 1.33.0: withdrawn and edited collections and deleted deposits, as the server writes them from events
  for (const c of collections) {
    if (c.voided?.kind === 'withdrawn' && recent(c.voided.at))
      push({ type: 'collection_withdrawn', at: c.voided.at!, branchId: collectionBranch(c) ?? null, actor: person(c.collector?.id), customer: cust(c.customer?.id), entity: 'collection', entityId: c.id!, data: { amountPoisha: c.amountPoisha, method: c.method } });
    if (c.edited && recent(c.edited.at))
      push({ type: 'collection_edited', at: c.edited.at!, branchId: collectionBranch(c) ?? null, actor: person(c.collector?.id), customer: cust(c.customer?.id), entity: 'collection', entityId: c.id!, data: { amountPoisha: c.amountPoisha, previousAmountPoisha: c.edited.previousAmountPoisha, editCount: c.edited.count } });
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1));
}


// ---------- location (pure functions of user + date, built on the mock visits) ----------
function encodePolyline(points: { lat: number; lng: number }[]): string {
  let out = '';
  let pLat = 0;
  let pLng = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    enc(lat - pLat);
    enc(lng - pLng);
    pLat = lat;
    pLng = lng;
  }
  return out;
}
const dayOf = (iso: string) => DateTime.fromISO(iso, { zone: ZONE }).toISODate()!;
const visitsOn = (userId: string, date: string) => visits.filter((v) => v.row.userId === userId && dayOf(v.row.checkInAt) === date).sort((a, b) => (a.row.checkInAt < b.row.checkInAt ? -1 : 1));

export function latestLocations(branchIds: string[]): S['LatestLocation'][] {
  return staff.filter((s) => s.active && branchIds.includes(s.branchIds?.[0] ?? '')).map((s) => {
    const h = hash(`loc:${s.id}`);
    const b = branches.find((x) => x.id === s.branchIds?.[0])!;
    const mine = visitsOn(s.id!, T);
    const last = mine.findLast((v) => v.row.geo)?.row.geo;
    const roll = h % 100;
    const ageMin = roll < 62 ? (h >> 8) % 4 : roll < 84 ? 6 + ((h >> 8) % 20) : 40 + ((h >> 8) % 150);
    const collected = collections.filter((c) => c.collector?.id === s.id && c.status !== 'voided' && dayOf(c.recordedAt!) === T).reduce((a, c) => a + c.amountPoisha!, 0);
    return {
      userId: s.id, name: s.name?.en, lat: (last?.lat ?? b.lat! + (((h >> 4) % 400) - 200) / 10_000) + ((h >> 10) % 9) / 100_000, lng: (last?.lng ?? b.lng! + (((h >> 14) % 400) - 200) / 10_000) + ((h >> 6) % 9) / 100_000,
      accuracyM: 5 + ((h >> 3) % 40), recordedAt: isoAt(now().minus({ minutes: ageMin })), freshness: ageMin < 5 ? 'fresh' : ageMin <= 30 ? 'stale' : 'lost',
      battery: roll % 7 === 0 ? 0.08 + ((h >> 5) % 10) / 100 : 0.3 + ((h >> 5) % 70) / 100, onBreak: roll % 11 === 0, mock: roll % 13 === 5,
      activity: (['still', 'walking', 'on_bicycle', 'in_vehicle'] as const)[(h >> 9) % 4], todayVisits: mine.length, todayCollectedPoisha: collected,
      trackingProvider: settings['location.trackingProvider'] === 'paid' ? 'paid' : 'free', trackingProviderFallback: settings['location.trackingProvider'] === 'paid' && roll % 9 === 0,
    };
  });
}

export function routeHistory(userId: string, date: string) {
  const u = userById(userId);
  const b = branches.find((x) => x.id === u?.branchIds?.[0]);
  const mine = visitsOn(userId, date).filter((v) => v.row.geo);
  const none = { polyline: '', segments: [], stops: [], events: [], summary: { distanceKm: 0, movingMin: 0, stoppedMin: 0, stopsCount: 0, customerStops: 0, gapsMin: 0, mockPoints: 0 } };
  if (!u || !b || !mine.length) return none;
  const h = hash(`route:${userId}:${date}`);
  const office = { lat: b.lat!, lng: b.lng! };
  const pts: { lat: number; lng: number }[] = [office];
  const stops: S['Stop'][] = [];
  const events: S['TimelineItem'][] = [];
  let prev = office;
  mine.forEach((v, i) => {
    const g = { lat: v.row.geo!.lat!, lng: v.row.geo!.lng! };
    // two bends between places so the track looks like streets rather than a straight line
    const k = hash(`${v.row.id}`);
    pts.push({ lat: prev.lat + (g.lat - prev.lat) * 0.35 + ((k % 9) - 4) / 20_000, lng: prev.lng + (g.lng - prev.lng) * 0.2 + (((k >> 4) % 9) - 4) / 20_000 });
    pts.push({ lat: prev.lat + (g.lat - prev.lat) * 0.7 + (((k >> 8) % 9) - 4) / 20_000, lng: prev.lng + (g.lng - prev.lng) * 0.85 + (((k >> 12) % 9) - 4) / 20_000 });
    pts.push(g);
    const start = DateTime.fromISO(v.row.checkInAt, { zone: ZONE });
    const end = v.row.checkOutAt ? DateTime.fromISO(v.row.checkOutAt, { zone: ZONE }) : start.plus({ minutes: 6 });
    stops.push({ start: isoAt(start), end: isoAt(end), dwellMin: Math.max(1, Math.round(end.diff(start, 'minutes').minutes)), lat: g.lat, lng: g.lng, customerId: v.row.customerId, customerName: v.row.customer?.name?.bn ?? null, distanceToPinM: v.row.distanceToPinM ?? null, visitId: null });
    events.push({ kind: 'visit', at: v.row.checkInAt, refId: v.row.id, actor: { id: u.id, name: u.name?.en }, summary: { bn: `${v.row.customer?.name?.bn ?? ''}: ভিজিট`, en: `Visit: ${v.row.customer?.name?.en ?? ''}` }, data: { customerId: v.row.customerId, lat: g.lat, lng: g.lng } });
    if (i === 1) {
      // a tea stall: a stop that is not at any customer
      const tea = { lat: g.lat + 0.0021, lng: g.lng - 0.0017 };
      pts.push(tea);
      stops.push({ start: isoAt(end.plus({ minutes: 4 })), end: isoAt(end.plus({ minutes: 4 + 9 + (h % 14) })), dwellMin: 9 + (h % 14), lat: tea.lat, lng: tea.lng, customerId: null, customerName: null, distanceToPinM: null, visitId: null });
      prev = tea;
    } else prev = g;
  });
  for (const c of collections) {
    if (c.collector?.id !== userId || c.status === 'voided' || dayOf(c.recordedAt!) !== date) continue;
    const loc = customerById(c.customer?.id ?? '')?.item.location;
    events.push({ kind: 'collection', at: c.recordedAt!, refId: c.id, actor: { id: u.id, name: u.name?.en }, summary: { bn: `${c.customer?.name?.bn ?? ''}: আদায়`, en: `Collection: ${c.customer?.name?.en ?? ''}` }, data: { customerId: c.customer?.id, ...(loc?.lat != null && loc?.lng != null ? { lat: loc.lat + 0.0002, lng: loc.lng + 0.0002 } : {}), amountPoisha: c.amountPoisha, method: c.method, receiptNo: c.receiptNo } });
  }
  const first = DateTime.fromISO(mine[0]!.row.checkInAt, { zone: ZONE });
  const lastAt = DateTime.fromISO(stops.at(-1)!.end!, { zone: ZONE });
  const gapMin = h % 3 === 0 ? 0 : 12 + (h % 40);
  const gapFrom = first.plus({ minutes: 35 });
  const segments = gapMin && gapFrom.plus({ minutes: gapMin }) < lastAt
    ? [{ from: isoAt(first.minus({ minutes: 20 })), to: isoAt(gapFrom), kind: 'moving' as const }, { from: isoAt(gapFrom), to: isoAt(gapFrom.plus({ minutes: gapMin })), kind: 'gap' as const }, { from: isoAt(gapFrom.plus({ minutes: gapMin })), to: isoAt(lastAt), kind: 'moving' as const }]
    : [{ from: isoAt(first.minus({ minutes: 20 })), to: isoAt(lastAt), kind: 'moving' as const }];
  const gapsMin = segments.filter((s) => s.kind === 'gap').reduce((a, s) => a + Math.round((Date.parse(s.to) - Date.parse(s.from)) / 60_000), 0);
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += Math.hypot((pts[i]!.lat - pts[i - 1]!.lat) * 111_000, (pts[i]!.lng - pts[i - 1]!.lng) * 102_000);
  const stoppedMin = stops.reduce((a, s) => a + (s.dwellMin ?? 0), 0);
  const total = Math.round(lastAt.diff(first.minus({ minutes: 20 }), 'minutes').minutes);
  return {
    polyline: encodePolyline(pts), segments, stops, events,
    summary: { distanceKm: Math.round(m / 100) / 10, movingMin: Math.max(0, total - stoppedMin - gapsMin), stoppedMin, stopsCount: stops.length, customerStops: stops.filter((s) => s.customerId).length, gapsMin, mockPoints: mine.filter((v) => v.row.geo?.mock).length },
  };
}

// ---------- devices & sync health ----------
const PHONES = [['Samsung Galaxy A15', '14'], ['Xiaomi Redmi 13C', '13'], ['Realme C55', '13'], ['Vivo Y17s', '13'], ['Samsung Galaxy M14', '14'], ['Infinix Hot 40i', '13'], ['Tecno Spark 20', '13']] as const;
export const devices: S['Device'][] = [];
staff.forEach((s, i) => {
  const h = hash(`dev:${s.id}`);
  const ph = PHONES[h % PHONES.length]!;
  const idle = !s.active ? 40 : h % 17 === 0 ? 9 : 0;
  devices.push({
    id: oid('6770'), deviceId: `and-${(h >>> 0).toString(16).padStart(8, '0')}`, userId: s.id, model: ph[0], androidVersion: ph[1], appVersion: h % 5 === 0 ? '1.0.1' : '1.0.3',
    boundAt: isoAt(now().minus({ days: 20 + (h % 200) })), lastSeenAt: isoAt(now().minus({ days: idle, minutes: 2 + (h % 55) })), rooted: i === 5, emulator: false, status: s.active ? 'active' : 'unbound',
  });
  // a few staff changed phones: the new one waits for a manager
  if (s.active && (i === 1 || i === 7 || i === 14)) {
    const np = PHONES[(h + 3) % PHONES.length]!;
    devices.push({ id: oid('6770'), deviceId: `and-${((h ^ 0x5bd1e995) >>> 0).toString(16).padStart(8, '0')}`, userId: s.id, model: np[0], androidVersion: np[1], appVersion: '1.0.3', boundAt: isoAt(now().minus({ hours: 3 + i })), lastSeenAt: isoAt(now().minus({ minutes: 12 + i })), rooted: i === 7, emulator: false, status: 'pending_approval' });
  }
});
export const deviceBranch = (d: S['Device']) => userById(d.userId)?.branchIds?.[0] ?? '';
export function syncHealth(branchIds: string[]): S['DeviceSyncState'][] {
  return devices.filter((d) => d.status === 'active' && branchIds.includes(deviceBranch(d))).map((d) => {
    const h = hash(`sync:${d.id}`);
    const stuck = h % 9 === 0;
    const err = h % 14 === 0;
    return {
      userId: d.userId, userName: userName(d.userId), deviceId: d.deviceId, appVersion: d.appVersion,
      lastPullAt: isoAt(now().minus({ minutes: stuck ? 190 + (h % 300) : 1 + (h % 12) })), lastPushAt: isoAt(now().minus({ minutes: stuck ? 200 + (h % 300) : 2 + (h % 25) })),
      pendingReported: stuck ? 3 + (h % 9) : err ? 1 : 0, ...(err ? { lastError: 'IDEMPOTENCY_MISMATCH: collection 7f3a… rejected' } : {}),
    };
  });
}

// ---------- daily targets (FR-COL-015, contract 1.10.0) ----------
/** One change of a personal target (userId) or a branch default (userId null), as field-api stores them: dated, never edited. */
export interface TargetEntry {
  id: string;
  userId: string | null;
  branchId: string;
  kind: 'set' | 'cleared';
  amountPoisha: number | null;
  visits: number | null;
  effectiveFrom: string;
  reason: string;
  setBy: { id: string; name: string };
  setAt: string;
}
export const targetChanges: TargetEntry[] = [];
export function addTarget(e: Omit<TargetEntry, 'id' | 'setAt'> & { setAt?: string }): TargetEntry {
  const row = { id: oid('6790'), setAt: e.setAt ?? isoAt(now()), ...e };
  targetChanges.push(row);
  return row;
}
{
  const by = (u: MockUser) => ({ id: u.id!, name: u.name?.en ?? '' });
  const ago = (d: number) => now().minus({ days: d }).toISODate()!;
  const at = (d: number) => isoAt(now().minus({ days: d, hours: 2 }));
  // branch 3 has no default yet, so its page shows the empty state
  addTarget({ userId: null, branchId: B[0]!, kind: 'set', amountPoisha: 2_000_000, visits: 8, effectiveFrom: ago(90), reason: 'Opening target for the branch.', setBy: by(managers[0]!), setAt: at(90) });
  addTarget({ userId: null, branchId: B[0]!, kind: 'set', amountPoisha: 2_500_000, visits: 8, effectiveFrom: ago(40), reason: 'Raised after the Eid sales.', setBy: by(managers[0]!), setAt: at(41) });
  addTarget({ userId: null, branchId: B[1]!, kind: 'set', amountPoisha: 2_000_000, visits: 6, effectiveFrom: ago(60), reason: 'Opening target for the branch.', setBy: by(managers[1]!), setAt: at(60) });
  const b0 = staff.filter((u) => u.active && u.branchIds?.[0] === B[0]);
  addTarget({ userId: b0[0]!.id!, branchId: B[0]!, kind: 'set', amountPoisha: 3_000_000, visits: 10, effectiveFrom: ago(20), reason: 'Senior collector with the largest area.', setBy: by(managers[0]!), setAt: at(21) });
  addTarget({ userId: b0[1]!.id!, branchId: B[0]!, kind: 'set', amountPoisha: 1_500_000, visits: 5, effectiveFrom: ago(30), reason: 'New joiner, first month.', setBy: by(managers[0]!), setAt: at(31) });
  addTarget({ userId: b0[1]!.id!, branchId: B[0]!, kind: 'set', amountPoisha: 2_000_000, visits: 6, effectiveFrom: ago(4), reason: 'Second month, closer to the branch target.', setBy: by(managers[0]!), setAt: at(5) });
  addTarget({ userId: b0[2]!.id!, branchId: B[0]!, kind: 'set', amountPoisha: 1_000_000, visits: 4, effectiveFrom: ago(25), reason: 'Light duty after illness.', setBy: by(managers[0]!), setAt: at(26) });
  addTarget({ userId: b0[2]!.id!, branchId: B[0]!, kind: 'cleared', amountPoisha: null, visits: null, effectiveFrom: ago(10), reason: 'Back to full duty.', setBy: by(managers[0]!), setAt: at(11) });
}
const latest = (rows: TargetEntry[], date: string) =>
  rows.filter((r) => r.effectiveFrom <= date).sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? a.setAt.localeCompare(b.setAt) : a.effectiveFrom.localeCompare(b.effectiveFrom))).at(-1);
export function branchDefault(branchId: string, date: string): S['TargetValue'] {
  const r = latest(targetChanges.filter((x) => x.userId === null && x.branchId === branchId), date);
  return r ? { amountPoisha: r.amountPoisha ?? 0, visits: r.visits ?? 0, effectiveFrom: r.effectiveFrom, reason: r.reason, setBy: r.setBy, setAt: r.setAt } : { amountPoisha: 0, visits: 0, effectiveFrom: null, reason: null, setBy: null, setAt: null };
}
/** No target on the weekly off, a holiday or approved leave. */
export function isWorkingDay(u: MockUser, date: string): boolean {
  const own = u.branchIds?.[0] ? settingOverrides[u.branchIds[0]]?.['attendance.defaultShift'] : undefined;
  const off = ((own ?? settings['attendance.defaultShift']) as { weeklyOff?: number[] }).weeklyOff ?? [5];
  // luxon: Monday = 1 … Sunday = 7; the setting: Sunday = 0 … Saturday = 6
  if (off.includes(DateTime.fromISO(date, { zone: ZONE }).weekday % 7)) return false;
  return attendanceDay(u, date).status !== 'leave';
}
export function staffTarget(u: MockUser, date: string): S['StaffTarget'] {
  const branchId = u.branchIds?.[0] ?? '';
  const own = latest(targetChanges.filter((x) => x.userId === u.id), date);
  const base = { userId: u.id!, name: u.name?.en, employeeCode: u.employeeCode };
  const v: S['TargetValue'] & { source: 'personal' | 'branch' } =
    own?.kind === 'set'
      ? { amountPoisha: own.amountPoisha ?? 0, visits: own.visits ?? 0, effectiveFrom: own.effectiveFrom, reason: own.reason, setBy: own.setBy, setAt: own.setAt, source: 'personal' }
      : { ...branchDefault(branchId, date), source: 'branch' };
  return isWorkingDay(u, date) ? { ...base, ...v, workingDay: true } : { ...base, ...v, amountPoisha: 0, visits: 0, workingDay: false };
}

// ---------- data quality (FR-CUS-009, contract 1.10.0) ----------
// A few customers per branch get the problems field-api reports, so every issue has rows. Picked from the end of each
// branch's list, away from the customers the journeys open.
branches.forEach((b, bi) => {
  const mine = customers.filter((c) => c.branchId === b.id).reverse();
  const at = (i: number) => mine[i + bi]!;
  const setLoc = (c: MockCustomer, loc: S['CustomerListItem']['location']) => {
    c.item.location = loc;
    c.detail.location = loc;
  };
  setLoc(at(0), { lat: 0, lng: 0, status: 'invalid', source: 'erp' });
  setLoc(at(1), { lat: null, lng: null, status: 'suspect_swapped', source: 'erp' });
  if (bi === 0) setLoc(at(2), { lat: (b.lat ?? 22.7) + 0.42, lng: (b.lng ?? 90.37) + 0.05, status: 'ok', source: 'erp' });
  const setPhone = (c: MockCustomer, p: string | undefined) => {
    c.item.phone = p;
    c.detail.phone = p;
    c.detail.phones = p ? [p] : [];
  };
  setPhone(at(3), undefined);
  setPhone(at(4), undefined);
  setPhone(at(5), '01712-345');
  setPhone(at(6), at(8).item.phone);
  setPhone(at(7), at(8).item.phone);
  const plan = at(9).detail.plans?.[0];
  if (plan) Object.assign(plan, { schedule: [], status: 'active', outstandingPoisha: Math.max(plan.outstandingPoisha ?? 0, 1_200_000) });
  for (const i of [10, 11, 12]) {
    at(i).item.assignee = undefined;
    at(i).detail.assignee = undefined;
  }
});
// ---------- real ERP shape (contract 1.13.0) ----------
// Derived from what is already generated, without random draws, so the seeded data above stays the same.
branches.forEach((b) => (b.kind = 'branch'));
const METHOD_LABEL: Record<string, string> = { cash: 'Cash-01', bkash: 'bKash merchant', nagad: 'Nagad merchant' };
const receiptOf = (date: string, n: number) => `PAY-${date.replace(/-/g, '')}-${String(n).padStart(5, '0')}`;
let payNo = 1200;
customers.forEach((c, ci) => {
  const d = c.detail;
  d.plans?.forEach((p, pi) => {
    const no = (p.erpPlanId ?? '').replace(/\D/g, '');
    Object.assign(p, {
      kind: 'installment', invoiceNo: `INV-${no}`, saleDate: p.startDate, frequency: 'monthly',
      items: [{ name: p.product, model: null, qty: 1, serials: ci % 3 === 0 ? [`SN${no}${pi}A`] : [] }],
      ...(pi === 0 && d.guarantor?.name ? { guarantor: { name: d.guarantor.name, phone: d.guarantor.phone, phones: [d.guarantor.phone!] } } : {}),
    } satisfies Partial<S['Plan']>);
    const lines = p.schedule ?? [];
    const overdue = lines.filter((x) => x.status === 'overdue');
    // a late fee the ERP added (already inside the line amount)
    if (ci % 7 === 3 && overdue[0]) overdue[0].lateFeePoisha = Math.min(5_000, overdue[0].amountPoisha ?? 0);
    // the ERP rolled an unpaid line forward: its balance moved to the next (also overdue) line, the old line is 0
    if (ci % 11 === 5 && overdue.length >= 2 && !overdue[0]!.lateFeePoisha) {
      const [a, next] = [overdue[0]!, overdue[1]!];
      next.amountPoisha = (next.amountPoisha ?? 0) + (a.amountPoisha ?? 0) - (a.paidPoisha ?? 0);
      Object.assign(a, { amountPoisha: a.paidPoisha ?? 0, status: 'paid', rolled: (a.paidPoisha ?? 0) === 0 });
    }
  });
  // a paid-up credit sale (one due date) with a small write-off, and a returned invoice that is not collectable
  if (ci % 25 === 12) {
    const sale = now().minus({ days: 75 }).toISODate()!;
    const due = now().minus({ days: 45 }).toISODate()!;
    d.plans?.push({
      erpPlanId: `P-${90000 + ci}`, kind: 'credit', invoiceNo: `INV-C${90000 + ci}`, product: 'Rice cooker 2.8 L', saleDate: sale, startDate: sale, finalDueDate: due,
      installmentCount: 1, totalPayablePoisha: 450_000, downPaymentPoisha: 0, paidPoisha: 450_000, writtenOffPoisha: 20_000, outstandingPoisha: 0, status: 'completed', badSuggested: false,
      items: [{ name: 'Rice cooker', model: '2.8 L', qty: 1, serials: [] }],
      schedule: [{ seq: 1, dueDate: due, amountPoisha: 450_000, paidPoisha: 450_000, status: 'paid', estimated: false }],
    });
  }
  if (ci % 25 === 18) {
    const sale = now().minus({ days: 120 }).toISODate()!;
    d.plans?.push({
      erpPlanId: `P-${91000 + ci}`, kind: 'installment', invoiceNo: `INV-${91000 + ci}`, product: 'LED TV 32"', saleDate: sale, startDate: sale, finalDueDate: now().plus({ days: 60 }).toISODate()!,
      installmentCount: 6, totalPayablePoisha: 2_400_000, downPaymentPoisha: 400_000, paidPoisha: 800_000, outstandingPoisha: 1_600_000, status: 'closed', badSuggested: false, frequency: 'monthly',
      items: [{ name: 'LED TV', model: '32"', qty: 1, serials: [`SN${91000 + ci}R`] }], schedule: [],
    });
  }
  d.payments?.forEach((pay) => {
    payNo += 1;
    Object.assign(pay, {
      erpPaymentId: String(payNo), receiptNo: receiptOf(pay.date!, payNo), erpPlanId: d.plans?.[0]?.erpPlanId, methodLabel: METHOD_LABEL[pay.method ?? ''] ?? pay.method,
      ...(pay.source === 'field' ? { collectorName: c.item.assignee?.name } : {}),
    });
  });
  // the office removed a payment in the ERP: field-api shows it as reversed (not in the totals)
  if (ci % 20 === 6 && d.payments?.[0]) {
    payNo += 1;
    const first = d.payments[0];
    d.payments.splice(1, 0, { ...first, erpPaymentId: `removed-${payNo}`, receiptNo: receiptOf(first.date!, payNo), reversed: true, source: 'office', collectorName: undefined });
  }
  if (ci % 9 === 2) {
    d.detailedAddress = `${c.item.address}, ${['north of the mosque', 'east para', 'near the primary school'][ci % 3]}`;
    d.directions = ['বাজারের পাশে, লাল গেটের বাড়ি', 'Second house after the bridge, blue door', 'মসজিদের পেছনে, টিনের ঘর'][ci % 3];
  }
  if (ci % 8 === 1) {
    const grade = ['B', 'C', 'D', 'E'][ci % 4]!;
    d.erpRisk = { grade, level: grade === 'E' || grade === 'D' ? 'High' : grade === 'C' ? 'Medium' : 'Low', classification: grade === 'E' ? 'trend' : 'isolated', overdueCount: (ci % 5) + 1, maxDaysLate: 10 + (ci % 40), computedAt: isoAt(now().minus({ days: 1 })) };
  }
});

// ---------- pay state and invoice viewer fields (contract 1.14.0, field-api ADR-035) ----------
// Derived from the data above without random draws. Mirrors field-api `customers/domain/status.ts`.
type PayState = S['PayState'];
const PAY_ORDER: PayState[] = ['bad', 'missed_many', 'missed_one', 'due_today', 'on_track', 'paid_off'];
const dayDiff = (a: string, b: string) => Math.round(dDate(a).diff(dDate(b), 'days').days);
const collectable = (p: S['Plan']) => p.status !== 'closed' && p.status !== 'cancelled';
/** fills line extras, plan pay state and the plan money fields of one plan */
export function derivePlan(p: S['Plan'], branchId: string | undefined, today = T) {
  const lines = p.schedule ?? [];
  lines.forEach((l, i) => {
    const left = Math.max(0, (l.amountPoisha ?? 0) - (l.paidPoisha ?? 0));
    l.outstandingPoisha = left;
    // a rolled line (amount 0) is missed while the line that took its balance is still unpaid
    const carrier = l.rolled ? lines.slice(i + 1).find((x) => !x.rolled) : undefined;
    const carrierLeft = carrier ? Math.max(0, (carrier.amountPoisha ?? 0) - (carrier.paidPoisha ?? 0)) : 0;
    l.missed = collectable(p) && l.dueDate! < today && (left > 0 || (!!l.rolled && carrierLeft > 0 && carrier!.dueDate! <= today));
    const last = l.payments?.length ? l.payments[l.payments.length - 1]!.date : undefined;
    if (left === 0 && (l.paidPoisha ?? 0) > 0 && last) l.paidOn = last;
    else delete l.paidOn;
    l.daysLate = l.paidOn ? Math.max(0, dayDiff(l.paidOn, l.dueDate!)) : left > 0 && l.dueDate! < today ? dayDiff(today, l.dueDate!) : 0;
  });
  const missed = lines.filter((l) => l.missed);
  const open = collectable(p) && (p.outstandingPoisha ?? 0) > 0;
  const next = lines.filter((l) => l.dueDate! >= today && (l.outstandingPoisha ?? 0) > 0).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
  p.missedCount = missed.length;
  p.daysOverdue = missed.length ? dayDiff(today, missed.map((l) => l.dueDate!).sort()[0]!) : 0;
  if (next) Object.assign(p, { nextDueDate: next.dueDate, nextDuePoisha: next.outstandingPoisha });
  p.payState = !open ? 'paid_off' : p.badSuggested ? 'bad' : missed.length >= 2 ? 'missed_many' : missed.length === 1 ? 'missed_one' : lines.some((l) => l.dueDate === today && (l.outstandingPoisha ?? 0) > 0) ? 'due_today' : 'on_track';
  const total = p.totalPayablePoisha ?? 0;
  const discount = Math.round(total * 0.02 / 100) * 100;
  Object.assign(p, {
    branchId,
    subtotalPoisha: total + discount,
    discountPoisha: discount,
    taxPoisha: 0,
    settlementDiscountPoisha: 0,
    refundedPoisha: p.status === 'closed' ? 200_000 : 0,
    invoiceStatus: p.status === 'closed' ? 'returned' : p.status === 'cancelled' ? 'cancelled' : 'posted',
    paymentStatus: (p.outstandingPoisha ?? 0) <= 0 ? 'paid' : (p.paidPoisha ?? 0) > 0 ? 'partial' : 'unpaid',
    ...(p.kind === 'credit' ? { creditDueDate: p.finalDueDate } : { financedPoisha: total - (p.downPaymentPoisha ?? 0), penalty: { enabled: true, rate: '0.0200' } }),
  } satisfies Partial<S['Plan']>);
  p.items?.forEach((it) => {
    const qty = it.qty ?? 1;
    Object.assign(it, { unitPricePoisha: Math.round((total + discount) / qty), discountPoisha: discount, serviceChargePoisha: 0, lineTotalPoisha: total });
  });
}
export function deriveCustomer(c: MockCustomer, today = T) {
  const d = c.detail;
  d.plans?.forEach((p) => derivePlan(p, c.branchId, today));
  const open = (d.plans ?? []).filter((p) => collectable(p) && (p.outstandingPoisha ?? 0) > 0);
  const missedCount = open.reduce((s, p) => s + (p.missedCount ?? 0), 0);
  const tagBad = c.item.tag?.state === 'tagged' && c.item.tag.severity !== 'watch';
  const worst = PAY_ORDER.find((s) => open.some((p) => p.payState === s));
  const payState: PayState = tagBad ? 'bad' : (c.item.totalOutstandingPoisha ?? 0) <= 0 || !worst ? 'paid_off' : worst;
  const openInvoices = { installment: open.filter((p) => p.kind !== 'credit').length, credit: open.filter((p) => p.kind === 'credit').length };
  for (const x of [c.item, d]) Object.assign(x, { payState, missedCount, openInvoices });
}
customers.forEach((c, ci) => {
  const d = c.detail;
  // link each paid line to the ERP payment that paid it (same amount, near the due date), as the ERP allocations do
  const unused = (d.payments ?? []).filter((p) => !p.reversed);
  (d.plans ?? []).forEach((p) => {
    (p.schedule ?? []).forEach((l) => {
      if (!(l.paidPoisha ?? 0)) return;
      const i = unused.findIndex((pay) => pay.amountPoisha === l.paidPoisha && Math.abs(dayDiff(pay.date!, l.dueDate!)) <= 7);
      if (i === -1) return;
      const [pay] = unused.splice(i, 1);
      pay!.erpPlanId = p.erpPlanId;
      l.payments = [{ erpPaymentId: pay!.erpPaymentId, date: pay!.date, amountPoisha: pay!.amountPoisha, receiptNo: pay!.receiptNo }];
    });
  });
  // open credit sales (pay later, one due date): one not due yet, one overdue
  if (ci % 17 === 4 || ci % 29 === 9) {
    const late = ci % 29 === 9;
    const sale = now().minus({ days: late ? 60 : 20 }).toISODate()!;
    const due = now().plus({ days: late ? -25 : 12 }).toISODate()!;
    const amount = late ? 780_000 : 1_250_000;
    const paid = late ? 200_000 : 0;
    d.plans?.push({
      erpPlanId: `P-${92000 + ci}`, kind: 'credit', invoiceNo: `INV-C${92000 + ci}`, product: late ? 'Blender 1.5 L' : 'Air cooler 40 L', saleDate: sale, startDate: sale, finalDueDate: due,
      installmentCount: 1, totalPayablePoisha: amount, downPaymentPoisha: 0, paidPoisha: paid, outstandingPoisha: amount - paid, status: 'active', badSuggested: false,
      items: [{ name: late ? 'Blender' : 'Air cooler', model: late ? '1.5 L' : '40 L', qty: 1, serials: [] }],
      schedule: [{ seq: 1, dueDate: due, amountPoisha: amount, paidPoisha: paid, status: late ? 'overdue' : 'upcoming', estimated: false }],
    });
    for (const x of [c.item, d]) {
      x.totalOutstandingPoisha = (x.totalOutstandingPoisha ?? 0) + amount - paid;
      if (late) {
        x.overduePoisha = (x.overduePoisha ?? 0) + amount - paid;
        x.daysOverdue = Math.max(x.daysOverdue ?? 0, 25);
      }
      x.badges = (x.badges ?? []).filter((b) => b !== 'paid_up' && (!late || b !== 'current'));
      if (late && !x.badges.includes('overdue')) x.badges.push('overdue');
      if (!late && !x.badges.length) x.badges.push('current');
    }
  }
  deriveCustomer(c);
});

// ERP employees: the ERP needs a collector employee on every payment. Staff and managers are linked (numeric ids, as
// in the ERP); one ERP employee is not linked to anybody yet and one has left. The collector of the
// COLLECTOR_NOT_LINKED conflict is not linked, so that conflict is what it says.
export const erpEmployees: S['ErpEmployee'][] = [];
users.forEach((u) => {
  if (u.role !== 'field_staff' && u.role !== 'branch_manager') {
    u.erpEmployeeId = null;
    return;
  }
  const id = String(7 + erpEmployees.length);
  const b = branches.find((x) => x.id === u.branchIds?.[0]);
  u.erpEmployeeId = id;
  erpEmployees.push({ erpEmployeeId: id, code: `EMP-${id.padStart(5, '0')}`, name: u.name?.en, erpBranchIds: b ? [b.erpBranchId!] : [], active: u.active !== false });
});
erpEmployees.push(
  { erpEmployeeId: '90', code: 'EMP-00090', name: 'Jamal Uddin', erpBranchIds: [branches[0]!.erpBranchId!], active: true },
  { erpEmployeeId: '91', code: 'EMP-00091', name: 'Habib Khan', erpBranchIds: [branches[1]!.erpBranchId!], active: false },
);
const unlinked = userById(collections.find((c) => c.conflict?.code === 'COLLECTOR_NOT_LINKED')?.collector?.id ?? '');
if (unlinked) unlinked.erpEmployeeId = null;

export const DQ_ISSUES = ['no_location', 'invalid_location', 'suspect_swapped', 'far_from_branch', 'missing_phone', 'invalid_phone', 'shared_phone', 'plan_without_schedule', 'unassigned'] as const;
const bdMobile = (raw: string) => {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('880')) d = d.slice(2);
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
};
const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
/** Every issue of one customer with the server's English detail, the way field-api's quality rules word it. */
export function qualityFindings(c: MockCustomer): { issue: (typeof DQ_ISSUES)[number]; detail: string }[] {
  const out: { issue: (typeof DQ_ISSUES)[number]; detail: string }[] = [];
  const loc = c.item.location;
  const b = branches.find((x) => x.id === c.branchId);
  if (loc?.status === 'missing') out.push({ issue: 'no_location', detail: 'No coordinates' });
  else if (loc?.status === 'invalid') out.push({ issue: 'invalid_location', detail: `Coordinates ${loc.lat},${loc.lng} are 0,0 or outside Bangladesh` });
  else if (loc?.status === 'suspect_swapped') out.push({ issue: 'suspect_swapped', detail: 'Latitude and longitude look swapped' });
  if (loc?.lat != null && loc.lng != null && b?.lat != null && b.lng != null && (loc.status === 'ok' || loc.status === 'overridden')) {
    const km = kmBetween({ lat: loc.lat, lng: loc.lng }, { lat: b.lat, lng: b.lng });
    if (km > Number(settings['reports.dataQualityMaxBranchKm'] ?? 30)) out.push({ issue: 'far_from_branch', detail: `${Math.round(km * 10) / 10} km from the branch` });
  }
  const phones = (c.detail.phones ?? []).filter(Boolean) as string[];
  if (!phones.length) out.push({ issue: 'missing_phone', detail: 'No phone number' });
  const bad = phones.filter((p) => !bdMobile(p));
  if (bad.length) out.push({ issue: 'invalid_phone', detail: `Not a Bangladesh mobile number: ${bad.join(', ')}` });
  const shared = customers.filter((o) => o !== c && o.branchId === c.branchId && (o.detail.phones ?? []).some((p) => p && bdMobile(p) && phones.map(bdMobile).includes(bdMobile(p))));
  if (shared.length) out.push({ issue: 'shared_phone', detail: `Same number as ${shared.slice(0, 3).map((o) => o.item.code).join(', ')}` });
  const noSchedule = (c.detail.plans ?? []).filter((p) => p.status === 'active' && (p.outstandingPoisha ?? 0) > 0 && !(p.schedule ?? []).length);
  if (noSchedule.length) out.push({ issue: 'plan_without_schedule', detail: `Open plan without installment schedule: ${noSchedule.map((p) => p.erpPlanId).join(', ')}` });
  if (!c.item.assignee?.id) out.push({ issue: 'unassigned', detail: 'No field staff assigned' });
  return out;
}


// ---------- leave, holidays, shifts, notices (contract 1.12.0) ----------
// Deterministic: no rnd() here, so the data above stays as it was.
const dayOff = (n: number) => now().plus({ days: n }).toISODate()!;
const dayCount = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

export const shifts: S['Shift'][] = [
  { id: 'sh-day', name: 'Day shift', start: '09:00', end: '18:00', weeklyOff: [5], lateGraceMin: 15, maxBreakMin: 60 },
  { id: 'sh-market', name: 'Market day shift', start: '10:00', end: '19:00', weeklyOff: [5, 6], lateGraceMin: 20, maxBreakMin: 45 },
];
// a few staff work the market-day shift; the rest use the day shift or the branch default
staff.forEach((u, i) => {
  u.shiftId = i % 5 === 2 ? 'sh-market' : i % 3 === 0 ? 'sh-day' : null;
});

const year = Number(today().slice(0, 4));
export const holidays: S['Holiday'][] = [
  { id: oid('6741'), date: `${year}-02-21`, name: { bn: 'শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস', en: 'Language Martyrs Day' }, branchIds: [], type: 'national' },
  { id: oid('6741'), date: `${year}-03-26`, name: { bn: 'স্বাধীনতা দিবস', en: 'Independence Day' }, branchIds: [], type: 'national' },
  { id: oid('6741'), date: `${year}-05-01`, name: { bn: 'মে দিবস', en: 'May Day' }, branchIds: [], type: 'national' },
  { id: oid('6741'), date: dayOff(9), name: { bn: 'শাখার বার্ষিক সভা', en: 'Branch annual meeting' }, branchIds: [B[0]!], type: 'branch' },
  { id: oid('6741'), date: `${year}-12-16`, name: { bn: 'বিজয় দিবস', en: 'Victory Day' }, branchIds: [], type: 'national' },
  { id: oid('6741'), date: `${year}-12-25`, name: { bn: 'বড়দিন', en: 'Christmas Day' }, branchIds: [], type: 'national' },
];

export type MockLeave = S['LeaveRequest'];
export const leaveRequests: MockLeave[] = [];
function addLeave(u: MockUser, type: MockLeave['type'], fromIn: number, days: number, reason: string, status: MockLeave['status'], createdHoursAgo: number, decisionReason?: string) {
  const from = dayOff(fromIn);
  const to = dayOff(fromIn + days - 1);
  const createdAt = isoAt(now().minus({ hours: createdHoursAgo }));
  const decided = status === 'approved' || status === 'rejected';
  const mgr = managers.find((m) => m.branchIds?.[0] === u.branchIds?.[0]);
  leaveRequests.push({
    id: oid('6742'), userId: u.id, userName: u.name?.en, branchId: u.branchIds?.[0] ?? null, type, from, to, days: dayCount(from, to), reason, status,
    ...(decided ? { decidedBy: mgr?.id, decidedAt: isoAt(now().minus({ hours: Math.max(1, createdHoursAgo - 3) })) } : {}),
    ...(decisionReason ? { decisionReason } : {}),
    ...(status === 'cancelled' ? { cancelledAt: isoAt(now().minus({ hours: createdHoursAgo - 1 })) } : {}),
    createdAt,
  });
}
{
  const s = staff.filter((u) => u.active);
  const b0 = s.filter((u) => u.branchIds?.[0] === B[0]);
  const b1 = s.filter((u) => u.branchIds?.[0] === B[1]);
  addLeave(b0[0]!, 'sick', 1, 2, 'জ্বর, ডাক্তার বিশ্রাম নিতে বলেছেন', 'pending', 3);
  addLeave(b0[1]!, 'casual', 6, 3, 'বোনের বিয়ে', 'pending', 20);
  addLeave(b0[2]!, 'casual', 3, 1, 'জমির কাগজের কাজে উপজেলা অফিসে যেতে হবে', 'pending', 26);
  addLeave(b0[4]!, 'other', -5, 2, 'পরিবারের অসুস্থতা', 'approved', 140);
  addLeave(b0[5]!, 'casual', 2, 4, 'গ্রামের বাড়ি যাব', 'rejected', 50, 'সাপ্তাহিক কালেকশন ড্রাইভ চলছে, পরের সপ্তাহে নিন');
  addLeave(b0[6]!, 'sick', 12, 1, '', 'cancelled', 30);
  addLeave(b1[0]!, 'sick', 0, 1, 'পেটের সমস্যা', 'pending', 2);
  addLeave(b1[1]!, 'casual', 15, 2, 'ঈদের পরে বাড়ি যাওয়া', 'approved', 70);
}

/** `recipientIds` is fixed when the notice is sent, as on the server (people added later do not get old notices). */
export interface MockBroadcast { row: S['Broadcast']; recipientIds: string[]; acks: Map<string, string> }
export const broadcasts: MockBroadcast[] = [];
/** Active users a broadcast reaches: its branches (none = all) and roles (none = field staff), never the sender. */
export function broadcastRecipients(branchIds: string[], roles: Role[], senderId?: string): MockUser[] {
  const rs = roles.length ? roles : (['field_staff'] as Role[]);
  return users.filter((u) => u.active && u.id !== senderId && rs.includes(u.role!) && (!branchIds.length || (u.branchIds ?? []).some((x) => branchIds.includes(x))));
}
export function addBroadcast(row: Omit<S['Broadcast'], 'id' | 'recipientCount' | 'ackCount'>, ackShare = 0, ackMinutesAfter = 30): MockBroadcast {
  const roles = (row.roles?.length ? row.roles : ['field_staff']) as Role[];
  const rec = broadcastRecipients(row.branchIds ?? [], roles, row.createdBy?.id);
  const b: MockBroadcast = { row: { id: oid('6743'), ...row, roles }, recipientIds: rec.map((u) => u.id!), acks: new Map() };
  rec.slice(0, Math.floor(rec.length * ackShare)).forEach((u, i) => b.acks.set(u.id!, isoAt(DateTime.fromISO(row.createdAt!).plus({ minutes: ackMinutesAfter + i * 7 }))));
  broadcasts.unshift(b);
  return b;
}
addBroadcast({ title: { bn: 'ঈদের ছুটির সময়সূচি', en: 'Eid holiday schedule' }, body: { bn: 'ঈদের আগের দুই দিন অফিস দুপুর ২টা পর্যন্ত খোলা থাকবে।', en: 'The office is open until 2 PM on the two days before Eid.' }, branchIds: [], roles: [], requireAck: false, createdBy: { id: superAdmin.id, name: superAdmin.name?.en }, createdAt: isoAt(now().minus({ days: 6 })) }, 0.9);
addBroadcast({ title: { bn: 'নতুন নিয়ম: রসিদ ছাড়া টাকা নয়', en: 'New rule: no money without a receipt' }, body: { bn: 'আজ থেকে কোনো কিস্তির টাকা নিলে সাথে সাথে অ্যাপে রসিদ দিন। রসিদ ছাড়া টাকা নিলে তা গ্রহণযোগ্য হবে না।', en: 'From today, give a receipt in the app as soon as you take an installment. Money taken without a receipt is not accepted.' }, branchIds: [B[0]!], roles: ['field_staff'], requireAck: true, createdBy: { id: managers[0]!.id, name: managers[0]!.name?.en }, createdAt: isoAt(now().minus({ hours: 20 })) }, 0.6, 12);

// ---------- tasks (contract 1.16.0) ----------
export type MockTask = S['Task'];
export const tasks: MockTask[] = [];
const who = (u: MockUser) => ({ id: u.id!, name: u.name?.en ?? '' });
export function taskView(t: MockTask): MockTask {
  const today = now().toISODate()!;
  const active = t.status === 'open' || t.status === 'resolve_requested';
  return { ...t, overdue: !!t.dueDate && active && t.dueDate < today };
}
/** Seeds and handlers share this. `ago` = hours since it was given; no random draws, so other seeds do not move. */
export function addTask(by: MockUser, assignee: MockUser, title: string, note: string | null, dueDate: string | null, ago = 2, branchId = assignee.branchIds?.[0] ?? ''): MockTask {
  const at = isoAt(now().minus({ hours: ago }));
  const t: MockTask = {
    id: oid('6745'),
    branchId,
    assignee: { id: assignee.id!, name: assignee.name?.en ?? '', employeeCode: assignee.employeeCode ?? '' },
    createdBy: who(by),
    title,
    note,
    dueDate,
    status: 'open',
    overdue: false,
    resolveNote: null,
    resolveRequestedAt: null,
    decisionNote: null,
    decidedBy: null,
    decidedAt: null,
    events: [{ type: 'created', by: who(by), at, note: null }],
    createdAt: at,
    updatedAt: at,
  };
  tasks.unshift(t);
  return t;
}
export function taskStep(t: MockTask, by: MockUser, type: 'resolve_requested' | 'verified' | 'rejected' | 'cancelled' | 'edited', note: string | null, ago = 0) {
  const at = isoAt(now().minus({ hours: ago }));
  t.events.push({ type, by: who(by), at, note });
  t.updatedAt = at;
  if (type === 'resolve_requested') Object.assign(t, { status: 'resolve_requested', resolveNote: note, resolveRequestedAt: at });
  if (type === 'verified') Object.assign(t, { status: 'resolved', decisionNote: note, decidedBy: who(by), decidedAt: at });
  if (type === 'rejected') Object.assign(t, { status: 'open', decisionNote: note, decidedBy: who(by), decidedAt: at, resolveNote: null, resolveRequestedAt: null });
  if (type === 'cancelled') Object.assign(t, { status: 'cancelled', decisionNote: note, decidedBy: who(by), decidedAt: at });
}
{
  const m0 = managers[0]!;
  const m1 = managers[1]!;
  const b0 = staff.filter((u) => u.active && u.branchIds?.[0] === B[0]);
  const b1 = staff.filter((u) => u.active && u.branchIds?.[0] === B[1]);
  addTask(m0, b0[0]!, 'করিমের কাছ থেকে দোকানের চাবি নিয়ে আসুন', 'বাজারের চায়ের দোকানে জিজ্ঞাসা করবেন। নিয়ে অফিসে জমা দিন, শেষ হলে আমাকে জানাবেন।', dayOff(2), 5);
  const waiting = addTask(m0, b0[1]!, 'নতুন বাজারের তিনটি দোকানে নোটিশ দিয়ে আসুন', 'কিস্তির তারিখ বদলের নোটিশ। প্রতিটি দোকানের সামনে ছবি তোলার দরকার নেই, শুধু বলে আসুন।', dayOff(0), 30);
  taskStep(waiting, b0[1]!, 'resolve_requested', 'তিনটি দোকানেই বলে এসেছি। আলামিন স্টোর মালিক বলেছেন শনিবার অফিসে আসবেন।', 1);
  const waiting2 = addTask(m0, b0[2]!, 'মাসিক রিপোর্টের কাগজ হেড অফিসে পৌঁছে দিন', null, dayOff(-1), 52);
  taskStep(waiting2, b0[2]!, 'resolve_requested', null, 3);
  addTask(m0, b0[3]!, 'ক্যাশ কাউন্টারের হিসাব মিলিয়ে দেখুন', 'গত সপ্তাহের জমার স্লিপগুলো আমার টেবিলে আছে।', dayOff(-2), 70);
  const done = addTask(m0, b0[4]!, 'ভাঙা রসিদ বইটি বদলে নিন', null, dayOff(-3), 120);
  taskStep(done, b0[4]!, 'resolve_requested', 'নতুন বই নিয়েছি, পুরোনোটা জমা দিয়েছি।', 100);
  taskStep(done, m0, 'verified', 'ঠিক আছে, ধন্যবাদ।', 98);
  const sentBack = addTask(m0, b0[5]!, 'রহিম স্টোরের মালিকের সাথে দেখা করুন', 'বকেয়া নিয়ে কথা বলবেন, কোনো টাকা নেবেন না।', dayOff(1), 80);
  taskStep(sentBack, b0[5]!, 'resolve_requested', 'দেখা করেছি।', 60);
  taskStep(sentBack, m0, 'rejected', 'কী কথা হলো সেটা লিখে জানান, শুধু "দেখা করেছি" যথেষ্ট নয়।', 50);
  const cancelled = addTask(m0, b0[6]!, 'গুদাম থেকে ফ্যানের বাক্স আনুন', null, null, 200);
  taskStep(cancelled, m0, 'cancelled', 'প্রয়োজন নেই, অফিস থেকেই পাঠানো হয়েছে।', 190);
  addTask(m1, b1[0]!, 'নতুন শাখার ঠিকানা কাস্টমারদের জানিয়ে দিন', 'ফোনে জানালেই হবে।', dayOff(3), 8);
  const w3 = addTask(m1, b1[1]!, 'বন্ধ হওয়া দোকানের তালিকা বানান', 'যে দোকানগুলো এখন আর খোলে না।', dayOff(0), 26);
  taskStep(w3, b1[1]!, 'resolve_requested', 'আটটি দোকানের তালিকা বানিয়েছি।', 2);
}

// ---------- map places (contract 1.38.0) ----------
export type MockPlace = S['Place'] & { pendingClientId?: string };
export const places: MockPlace[] = [];
const R = 6371008.8;
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}
export function addPlace(by: MockUser, name: string, icon: S['PlaceIcon'], note: string | null, location: { lat: number; lng: number }, branchId: string, ago = 24): MockPlace {
  const at = isoAt(now().minus({ hours: ago }));
  const p: MockPlace = {
    id: oid('6752'), clientId: null, branchId, name, icon, note, location, status: 'active', version: 1, pendingMove: null, lastMoveDecision: null,
    createdBy: who(by), updatedBy: who(by), createdAt: at, updatedAt: at, deletedAt: null, deleteReason: null,
    events: [{ type: 'created', by: who(by), at, note: null, from: null, to: location }],
  };
  places.unshift(p);
  return p;
}
/** Seeds and handlers share this: one history step, version + 1. */
export function placeStep(p: MockPlace, by: MockUser, type: S['PlaceEvent']['type'], extra: { note?: string | null; from?: { lat: number; lng: number } | null; to?: { lat: number; lng: number } | null } = {}, ago = 0) {
  const at = isoAt(now().minus({ hours: ago }));
  p.events.push({ type, by: who(by), at, note: extra.note ?? null, from: extra.from ?? null, to: extra.to ?? null });
  p.version += 1;
  p.updatedBy = who(by);
  p.updatedAt = at;
}
export function requestPlaceMove(p: MockPlace, by: MockUser, to: { lat: number; lng: number }, reason: string | null, ago = 0, clientId = crypto.randomUUID()) {
  placeStep(p, by, 'move_requested', { note: reason, from: p.location, to }, ago);
  p.pendingMove = { location: to, requestedBy: who(by), requestedAt: p.updatedAt, reason, distanceM: distanceM(p.location, to) };
  p.pendingClientId = clientId;
}
{
  const b0 = staff.filter((u) => u.active && u.branchIds?.[0] === B[0]);
  const b1 = staff.filter((u) => u.active && u.branchIds?.[0] === B[1]);
  addPlace(b0[0]!, 'করিম স্টোর', 'shop', 'নীল গেট, চায়ের দোকানের পাশে', { lat: 22.7031, lng: 90.3702 }, B[0]!, 50);
  addPlace(b0[1]!, 'বাইতুল আমান জামে মসজিদ', 'mosque', null, { lat: 22.7008, lng: 90.3684 }, B[0]!, 40);
  const bazar = addPlace(b0[2]!, 'নতুন বাজার', 'market', 'সকালে ভিড় থাকে', { lat: 22.7045, lng: 90.3725 }, B[0]!, 30);
  requestPlaceMove(bazar, b0[3]!, { lat: 22.7052, lng: 90.3731 }, 'বাজারের মূল গেট রাস্তার ওপারে', 2);
  const bank = addPlace(managers[0]!, 'সোনালী ব্যাংক', 'bank', null, { lat: 22.7015, lng: 90.3668 }, B[0]!, 20);
  requestPlaceMove(bank, b0[1]!, { lat: 22.7019, lng: 90.3675 }, null, 1);
  addPlace(b1[0]!, 'পটুয়াখালী বাস স্ট্যান্ড', 'bus_stop', null, { lat: 22.3607, lng: 90.3312 }, B[1]!, 10);
}
