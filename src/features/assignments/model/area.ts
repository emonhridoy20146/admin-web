import type { Area, Assignment } from '../api/assignments';

export interface AreaForm {
  nameBn: string;
  nameEn: string;
  code: string;
  erpCodes: string;
  active: boolean;
}

export function emptyForm(): AreaForm {
  return { nameBn: '', nameEn: '', code: '', erpCodes: '', active: true };
}

export function fromArea(a: Area): AreaForm {
  return { nameBn: a.name?.bn ?? '', nameEn: a.name?.en ?? '', code: a.code ?? '', erpCodes: (a.erpAreaCodes ?? []).join(', '), active: a.active !== false };
}

/** "RUP1, rup2 ,," → ["RUP1", "RUP2"] (upper-case, unique, order kept). */
export function parseCodes(s: string): string[] {
  return [...new Set(s.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
}

export type AreaErrors = Partial<Record<keyof AreaForm, string>>;

export function validate(v: AreaForm, others: Area[], selfId?: string): AreaErrors {
  const e: AreaErrors = {};
  if (!v.nameBn.trim()) e.nameBn = 'errors.required';
  if (!v.nameEn.trim()) e.nameEn = 'errors.required';
  const code = v.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(code)) e.code = 'errors.code';
  else if (others.some((a) => a.id !== selfId && a.code?.toUpperCase() === code)) e.code = 'errors.codeTaken';
  if (!parseCodes(v.erpCodes).length) e.erpCodes = 'errors.erpCodes';
  return e;
}

export function toBody(v: AreaForm, branchId: string, base?: Area): Area {
  return { ...(base ? { color: base.color } : {}), branchId, name: { bn: v.nameBn.trim(), en: v.nameEn.trim() }, code: v.code.trim().toUpperCase(), kind: 'codes', erpAreaCodes: parseCodes(v.erpCodes), active: v.active };
}

/** The active area assignment of one staff member for one area (to end it). */
export function assignmentFor(list: Assignment[] | undefined, areaId: string, userId: string): Assignment | undefined {
  return (list ?? []).find((a) => a.type === 'area' && a.areaId === areaId && a.userId === userId && !a.effectiveTo);
}

export interface Coverage {
  areas: number;
  uncovered: number;
  customers: number;
  uncoveredCustomers: number;
}

/** How much of the branch has nobody responsible (FR-ASG-005). */
export function coverage(areas: Area[] | undefined): Coverage {
  const live = (areas ?? []).filter((a) => a.active !== false);
  const bare = live.filter((a) => !a.assignees?.length);
  return { areas: live.length, uncovered: bare.length, customers: live.reduce((s, a) => s + (a.customerCount ?? 0), 0), uncoveredCustomers: bare.reduce((s, a) => s + (a.customerCount ?? 0), 0) };
}

/** Areas without anyone first, then by customers. */
export function sortAreas(areas: Area[]): Area[] {
  return [...areas].sort((a, b) => Number(a.active === false) - Number(b.active === false) || Number(!!a.assignees?.length) - Number(!!b.assignees?.length) || (b.customerCount ?? 0) - (a.customerCount ?? 0));
}
