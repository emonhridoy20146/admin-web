import type { Role, User, UserCreate, UserUpdate } from '../api/users';

export const ROLES = [
  'super_admin',
  'branch_manager',
  'field_staff',
  'viewer',
] as const satisfies readonly Role[];

export interface UserFormValues {
  nameBn: string;
  nameEn: string;
  phone: string;
  username: string;
  role: Role;
  branchIds: string[];
  employeeCode: string;
  erpEmployeeId: string;
  /** whole taka as typed; empty = use the default limit */
  cashLimitTaka: string;
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

export const emptyForm = (branchId?: string): UserFormValues => ({
  nameBn: '',
  nameEn: '',
  phone: '',
  username: '',
  role: 'field_staff',
  branchIds: branchId ? [branchId] : [],
  employeeCode: '',
  erpEmployeeId: '',
  cashLimitTaka: '',
});

export function fromUser(u: User): UserFormValues {
  return {
    nameBn: u.name?.bn ?? '',
    nameEn: u.name?.en ?? '',
    phone: u.phone ?? '',
    username: u.username ?? '',
    role: u.role ?? 'field_staff',
    branchIds: u.branchIds ?? [],
    employeeCode: u.employeeCode ?? '',
    erpEmployeeId: u.erpEmployeeId ?? '',
    cashLimitTaka: u.cashLimitPoisha != null ? String(Math.round(u.cashLimitPoisha / 100)) : '',
  };
}

/** Normalises Bangla digits and separators the user may type (০১৭… / 01712-345678 / +8801…). */
export function normalizePhone(raw: string): string {
  const ascii = raw.replace(/[০-৯]/g, (c) => String('০১২৩৪৫৬৭৮৯'.indexOf(c))).replace(/[\s-]/g, '');
  return ascii.startsWith('+880')
    ? `0${ascii.slice(4)}`
    : ascii.startsWith('880')
      ? `0${ascii.slice(3)}`
      : ascii;
}

export const BD_MOBILE = /^01[3-9]\d{8}$/;

export function toPoisha(taka: string): number | null {
  const s = taka
    .replace(/[০-৯]/g, (c) => String('০১২৩৪৫৬৭৮৯'.indexOf(c)))
    .replace(/,/g, '')
    .trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return NaN;
  return Number(s) * 100;
}

/** Returns i18n keys (namespace admin-users) per field. */
export function validate(v: UserFormValues): UserFormErrors {
  const e: UserFormErrors = {};
  if (!v.nameBn.trim()) e.nameBn = 'errors.required';
  if (!v.nameEn.trim()) e.nameEn = 'errors.required';
  if (!BD_MOBILE.test(normalizePhone(v.phone))) e.phone = 'errors.phone';
  if (!v.employeeCode.trim()) e.employeeCode = 'errors.required';
  if (v.role !== 'super_admin' && v.branchIds.length === 0) e.branchIds = 'errors.branch';
  if (v.role === 'field_staff' && v.branchIds.length > 1) e.branchIds = 'errors.oneBranch';
  const p = toPoisha(v.cashLimitTaka);
  if (Number.isNaN(p)) e.cashLimitTaka = 'errors.amount';
  if (v.username && !/^[a-z0-9._-]{3,32}$/.test(v.username)) e.username = 'errors.username';
  return e;
}

export function toCreate(v: UserFormValues): UserCreate {
  const limit = toPoisha(v.cashLimitTaka);
  return {
    name: { bn: v.nameBn.trim(), en: v.nameEn.trim() },
    phone: normalizePhone(v.phone),
    role: v.role,
    branchIds: v.branchIds,
    employeeCode: v.employeeCode.trim(),
    ...(v.username ? { username: v.username } : {}),
    ...(v.erpEmployeeId.trim() ? { erpEmployeeId: v.erpEmployeeId.trim() } : {}),
    ...(limit != null && !Number.isNaN(limit) ? { cashLimitPoisha: limit } : {}),
  };
}

/** Only changed fields are sent (smaller audit diff). */
export function toUpdate(before: User, v: UserFormValues, reason: string): UserUpdate {
  const out: UserUpdate = { reason };
  if (v.nameBn.trim() !== (before.name?.bn ?? '') || v.nameEn.trim() !== (before.name?.en ?? ''))
    out.name = { bn: v.nameBn.trim(), en: v.nameEn.trim() };
  if (normalizePhone(v.phone) !== before.phone) out.phone = normalizePhone(v.phone);
  if (v.role !== before.role) out.role = v.role;
  if ([...v.branchIds].sort().join() !== [...(before.branchIds ?? [])].sort().join())
    out.branchIds = v.branchIds;
  const limit = toPoisha(v.cashLimitTaka);
  if (limit != null && !Number.isNaN(limit) && limit !== before.cashLimitPoisha) out.cashLimitPoisha = limit;
  return out;
}

export function changedKeys(u: UserUpdate): string[] {
  return Object.keys(u).filter((k) => k !== 'reason');
}
