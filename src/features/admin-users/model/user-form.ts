import type { ErpEmployee, Role, User, UserCreate, UserUpdate } from '../api/users';

export const ROLES = [
  'super_admin',
  'area_manager',
  'branch_manager',
  'field_staff',
  'viewer',
] as const satisfies readonly Role[];

/** Contract 1.48.0 (ADR-065): only a super admin gives or takes away these roles; the server answers 403 otherwise. */
export const SA_ONLY_ROLES: readonly Role[] = ['super_admin', 'area_manager', 'branch_manager'];

/**
 * The roles the signed-in user may pick in the user form: a super admin all; anyone else (a manager with a user.manage
 * override) only roles outside SA_ONLY_ROLES, plus the user's current role so an edit can keep it.
 */
export function pickableRoles(myRole: Role | undefined, current?: Role): Role[] {
  if (myRole === 'super_admin') return [...ROLES];
  return ROLES.filter((r) => !SA_ONLY_ROLES.includes(r) || r === current);
}

/** Roles that collect money and so should carry an ERP employee (the form asks for it for these). */
export const COLLECTING_ROLES: readonly Role[] = ['field_staff', 'branch_manager'];

/**
 * Contract 1.35.0 (ADR-049): a collector with no ERP employee is still posted to the ERP, by name only (no referrer
 * employee). The panel warns so the office links them.
 */
export function needsErpLink(u: Pick<User, 'role' | 'erpEmployeeId' | 'active'>): boolean {
  return u.active !== false && COLLECTING_ROLES.includes(u.role!) && !u.erpEmployeeId;
}

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
  // order matters: the first branch is the home branch (contract 1.19.0)
  if (v.branchIds.join() !== (before.branchIds ?? []).join()) out.branchIds = v.branchIds;
  const limit = toPoisha(v.cashLimitTaka);
  if (limit != null && !Number.isNaN(limit) && limit !== before.cashLimitPoisha) out.cashLimitPoisha = limit;
  // 1.13.0: link or unlink the ERP employee (the ERP records a collector on every payment)
  const erp = v.erpEmployeeId.trim();
  if (erp !== (before.erpEmployeeId ?? '')) out.erpEmployeeId = erp || null;
  // a shift can be changed to another one; going back to the branch hours is not in the contract
  if (v.shiftId && v.shiftId !== (before.shiftId ?? '')) out.shiftId = v.shiftId;
  return out;
}

/**
 * Since contract 1.19.0 a field staff member (like a manager) may hold several branches. The first one is the home
 * branch: attendance, cash, targets and app settings follow it; the others widen whose customers they see.
 */
export function makeHome(branchIds: string[], id: string): string[] {
  return branchIds.includes(id) ? [id, ...branchIds.filter((b) => b !== id)] : branchIds;
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
