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
      assignee: { id: assignee.id, name: assignee.name?.en }, erpFetchedAt: fetched,
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
const CONFLICTS = [
  ['ALREADY_PAID_IN_OFFICE', 'এই কিস্তি অফিসে ইতিমধ্যে জমা হয়েছে (রসিদ R-88214)।', 'This installment was already paid at the office (receipt R-88214).'],
  ['PLAN_CLOSED', 'কিস্তি পরিকল্পনাটি ERP-তে বন্ধ করা হয়েছে।', 'The installment plan is closed in the ERP.'],
  ['AMOUNT_EXCEEDS_BALANCE', 'জমার পরিমাণ বকেয়ার চেয়ে বেশি।', 'Amount exceeds the outstanding balance.'],
  ['CUSTOMER_TRANSFERRED', 'গ্রাহক অন্য শাখায় স্থানান্তরিত হয়েছেন।', 'Customer was transferred to another branch.'],
  ['DUPLICATE_TXN_REF', 'একই bKash লেনদেন নম্বর আগে ব্যবহার হয়েছে।', 'The same bKash transaction ID was used before.'],
] as const;
collections.filter((c) => c.recordedAt! > isoAt(now().minus({ days: 3 }))).slice(0, 400).filter((_, i) => i % 61 === 7).slice(0, 5).forEach((c, i) => {
  const [code, bn, en] = CONFLICTS[i % CONFLICTS.length]!;
  c.status = 'conflict';
  c.erpReceiptNo = null;
  c.conflict = { code, message: { bn, en }, raisedAt: c.receivedAt };
  if (code === 'DUPLICATE_TXN_REF') {
    c.method = 'bkash';
    c.transactionRef = 'BK7G3K2Q9P';
    c.flags = ['duplicate_txn_ref'];
  }
});
collections.filter((c) => c.status === 'posting').slice(0, 2).forEach((c) => (c.status = 'posting_failed'));
collections.filter((c) => c.status === 'posted' && c.recordedAt! < isoAt(now().minus({ days: 2 }))).slice(3, 5).forEach((c) => {
  c.status = 'voided';
  c.resolution = { action: 'void', by: managers[0]!.id, at: c.receivedAt, reason: 'Entered twice by mistake; physical receipt cancelled.' };
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
    const status: S['Deposit']['status'] = d === 0 ? (i % 2 ? 'pending' : 'verified') : d === 1 && i === 6 ? 'rejected' : 'verified';
    const amt = Math.round(int(1500000, 4500000) / 10000) * 10000;
    deposits.push({
      id: oid('6755'), clientId: crypto.randomUUID(), userId: s.id, userName: s.name?.en, amountPoisha: amt,
      destination: pick(['branch_cashier', 'branch_cashier', 'bank'] as const), reference: d === 0 ? `SLIP-${int(1000, 9999)}` : `BC-${int(1000, 9999)}`,
      depositedAt: isoAt(now().minus({ days: d }).startOf('day').plus({ hours: 17, minutes: int(0, 50) }).minus({ days: d === 0 && now().hour < 17 ? 0 : 0 })),
      status, verifiedBy: status !== 'pending' ? managers[0]!.id : undefined, verifiedAt: status !== 'pending' ? isoAt(now().minus({ days: d, hours: -1 })) : undefined,
      rejectReason: status === 'rejected' ? 'Slip amount does not match the cash counted at the counter.' : undefined,
    });
    if (status === 'pending') {
      const pos = cashPositions.find((p) => p.userId === s.id);
      if (pos) {
        // cash stays on hand until the deposit is verified
        pos.pendingDepositsPoisha = (pos.pendingDepositsPoisha ?? 0) + amt;
        pos.onHandPoisha = (pos.onHandPoisha ?? 0) + amt;
        pos.oldestUndepositedAt ??= deposits[deposits.length - 1]!.depositedAt;
        pos.state = pos.onHandPoisha >= pos.limitPoisha! ? 'exceeded' : pos.onHandPoisha >= pos.limitPoisha! * 0.8 ? 'warning' : 'ok';
      }
    }
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
deposits.filter((d) => d.status === 'pending').forEach((d) => {
  const u = userById(d.userId)!;
  addInbox('cash.deposit_pending', 'medium', u.branchIds?.[0], 'deposit', d.id!, `জমা যাচাই বাকি: ${u.name?.bn}`, `Deposit awaiting verification: ${u.name?.en}`, `/cash/?drawer=deposit:${d.id}`, int(30, 400));
});
{
  const cleared = customers.find((c) => c.item.tag?.state === 'tagged' && c.item.totalOutstandingPoisha === 0)!;
  addInbox('tag.balance_cleared', 'medium', cleared.branchId, 'customer', cleared.item.id!, `${cleared.item.name?.bn} বকেয়া পরিশোধ করেছেন — ট্যাগ পর্যালোচনা করুন`, `${cleared.item.name?.en} cleared the balance — review the tag`, `/customers/${cleared.item.id}/`, 240);
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
  ['module.search', 'Global search', true], ['module.sync', 'Offline sync endpoints', true],
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
export const settings: Record<string, unknown> = {
  'duty.shiftStart': '09:00', 'duty.shiftEnd': '18:00', 'duty.weeklyOff': [5], 'duty.lateGraceMin': 15, 'duty.maxBreakMin': 60,
  'cash.limitPoisha': 5_000_000, 'cash.limitMode': 'warn', 'cash.warnAtRatio': 0.8,
  'location.trackingProvider': 'free', 'location.providerConfig': {}, 'location.retentionDays': 90, 'location.trackDuringBreak': false, 'location.maxAccuracyM': 50, 'location.fastSec': 15, 'location.slowSec': 45, 'location.stillSec': 180,
  'collections.farFromPinM': 300, 'collections.photoRequiredAbovePoisha': 0, 'tags.approvalMode': false, 'tags.staffCanSet': true,
  'promises.maxHorizonDays': 60, 'promises.graceDays': 1, 'attendance.selfieAtWorkIn': false, 'app.minVersion': '1.0.0',
  'map.tileProvider': 'protomaps-bd',
};

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

// ---------- attendance (pure function of user + date, plus manager corrections) ----------
export const attendanceCorrections = new Map<string, { type: string; at: string }[]>();
function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
export function attendanceDay(u: MockUser, date: string): S['AttendanceDay'] {
  const d = DateTime.fromISO(date, { zone: 'Asia/Dhaka' });
  const base = { userId: u.id, businessDate: date, lateMin: 0, breakMin: 0, dutyMin: 0, breaks: [], autoClosed: false, corrected: false, flags: [] };
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
  return {
    ...base, status: late > 0 ? 'late' : 'present', firstIn: isoAt(inAt), lastOut: isoAt(outAt), lateMin: late, breakMin,
    dutyMin: Math.max(0, Math.round(outAt.diff(inAt, 'minutes').minutes) - breakMin), breaks: [{ start: isoAt(bStart), end: isoAt(bStart.plus({ minutes: breakMin })) }],
    autoClosed, corrected: !!corr, flags: breakMin > 60 ? ['over_break'] : [],
  };
}

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
      },
    });
  });
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
    events.push({ kind: 'visit', at: v.row.checkInAt, actor: { id: u.id, name: u.name?.en }, summary: { bn: `${v.row.customer?.name?.bn ?? ''}: ভিজিট`, en: `Visit: ${v.row.customer?.name?.en ?? ''}` } });
    if (i === 1) {
      // a tea stall: a stop that is not at any customer
      const tea = { lat: g.lat + 0.0021, lng: g.lng - 0.0017 };
      pts.push(tea);
      stops.push({ start: isoAt(end.plus({ minutes: 4 })), end: isoAt(end.plus({ minutes: 4 + 9 + (h % 14) })), dwellMin: 9 + (h % 14), lat: tea.lat, lng: tea.lng, customerId: null, customerName: null, distanceToPinM: null, visitId: null });
      prev = tea;
    } else prev = g;
  });
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
