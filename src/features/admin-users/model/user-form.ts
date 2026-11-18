import type { ErpEmployee, Role, User, UserCreate, UserUpdate } from '../api/users';

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
  /** work shift (FR-SET-003); empty = the branch's duty hours */
  shiftId: string;
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
  shiftId: '',
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
    shiftId: u.shiftId ?? '',
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
    ...(v.shiftId ? { shiftId: v.shiftId } : {}),
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
  // 1.13.0: link or unlink the ERP employee (the ERP records a collector on every payment)
  const erp = v.erpEmployeeId.trim();
  if (erp !== (before.erpEmployeeId ?? '')) out.erpEmployeeId = erp || null;
  // a shift can be changed to another one; going back to the branch hours is not in the contract
  if (v.shiftId && v.shiftId !== (before.shiftId ?? '')) out.shiftId = v.shiftId;
  return out;
}

export function changedKeys(u: UserUpdate): string[] {
  return Object.keys(u).filter((k) => k !== 'reason');
}

/**
 * ERP employees for the picker: those of the user's branches first (by the branches' ERP ids), then the rest;
 * active before inactive, then by name. `branchErpIds` are the ERP ids of the branches ticked in the form.
 */
export function orderErpEmployees(list: ErpEmployee[], branchErpIds: string[]): { mine: ErpEmployee[]; others: ErpEmployee[] } {
  const set = new Set(branchErpIds);
  const sort = (a: ErpEmployee, b: ErpEmployee) => Number(b.active ?? true) - Number(a.active ?? true) || (a.name ?? '').localeCompare(b.name ?? '');
  const mine = list.filter((e) => (e.erpBranchIds ?? []).some((b) => set.has(b))).sort(sort);
  const others = list.filter((e) => !mine.includes(e)).sort(sort);
  return { mine, others };
}

/** "EMP-00007 · Rakib Hasan" (+ " · inactive" label added by the caller). */
export const erpEmployeeLabel = (e: ErpEmployee) => [e.code, e.name].filter(Boolean).join(' · ');
