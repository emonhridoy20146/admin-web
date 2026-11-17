import type { Holiday, HolidayCreate, LeaveRequest, LeaveStatus, Shift } from '../api/leave';

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const satisfies readonly LeaveStatus[];
export const LEAVE_TYPES = ['casual', 'sick', 'other'] as const;

/** Server weekday numbers: 0 = Sunday … 6 = Saturday (Friday = 5 is the usual weekly off). */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar days from..to, both included (the server sends `days` since 1.12.0; older rows are counted here). */
export function leaveDays(r: Pick<LeaveRequest, 'from' | 'to' | 'days'>): number {
  if (r.days != null) return r.days;
  if (!r.from || !r.to || r.to < r.from) return 0;
  return Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Pending first (oldest request first, it has waited longest), then the rest newest first. */
export function sortLeave(rows: LeaveRequest[]): LeaveRequest[] {
  return [...rows].sort((a, b) => {
    const pa = a.status === 'pending' ? 0 : 1;
    const pb = b.status === 'pending' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ca = a.createdAt ?? '';
    const cb = b.createdAt ?? '';
    return pa === 0 ? (ca < cb ? -1 : ca > cb ? 1 : 0) : ca < cb ? 1 : ca > cb ? -1 : 0;
  });
}

/** Whether a request covers a business date (for "on leave today"). */
export function covers(r: Pick<LeaveRequest, 'from' | 'to'>, date: string): boolean {
  return !!r.from && !!r.to && r.from <= date && date <= r.to;
}

/** Requests of the same person that block the same days as `r` (pending or approved), to warn before approving. */
export function overlapping(r: LeaveRequest, all: LeaveRequest[]): LeaveRequest[] {
  return all.filter((o) => o.id !== r.id && o.userId === r.userId && (o.status === 'pending' || o.status === 'approved') && o.from! <= r.to! && o.to! >= r.from!);
}

export interface HolidayForm {
  date: string;
  nameBn: string;
  nameEn: string;
  /** empty = national (every branch) */
  branchIds: string[];
}

/** Returns i18n keys (namespace attendance) per field. */
export function validateHoliday(v: HolidayForm, existing: Holiday[] = []): Partial<Record<keyof HolidayForm, string>> {
  const e: Partial<Record<keyof HolidayForm, string>> = {};
  if (!ISO.test(v.date)) e.date = 'calendar.errors.date';
  if (!v.nameBn.trim()) e.nameBn = 'calendar.errors.required';
  if (!e.date && existing.some((h) => h.date === v.date && (!h.branchIds?.length || !v.branchIds.length || h.branchIds.some((b) => v.branchIds.includes(b))))) e.date = 'calendar.errors.exists';
  return e;
}

export function toHolidayCreate(v: HolidayForm): HolidayCreate {
  const bn = v.nameBn.trim();
  return { date: v.date, name: { bn, en: v.nameEn.trim() || bn }, type: v.branchIds.length ? 'branch' : 'national', branchIds: v.branchIds };
}

export interface ShiftForm {
  name: string;
  start: string;
  end: string;
  weeklyOff: number[];
  lateGraceMin: string;
  maxBreakMin: string;
}

export const emptyShift = (): ShiftForm => ({ name: '', start: '09:00', end: '18:00', weeklyOff: [5], lateGraceMin: '15', maxBreakMin: '60' });

export function fromShift(s: Shift): ShiftForm {
  return { name: s.name ?? '', start: s.start ?? '09:00', end: s.end ?? '18:00', weeklyOff: [...(s.weeklyOff ?? [])], lateGraceMin: String(s.lateGraceMin ?? 15), maxBreakMin: String(s.maxBreakMin ?? 60) };
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const wholeMinutes = (s: string, max: number) => /^\d{1,3}$/.test(s.trim()) && Number(s) <= max;

export function validateShift(v: ShiftForm): Partial<Record<keyof ShiftForm, string>> {
  const e: Partial<Record<keyof ShiftForm, string>> = {};
  if (!v.name.trim()) e.name = 'calendar.errors.required';
  if (!HHMM.test(v.start)) e.start = 'calendar.errors.time';
  if (!HHMM.test(v.end)) e.end = 'calendar.errors.time';
  else if (!e.start && minutes(v.end) <= minutes(v.start)) e.end = 'calendar.errors.endBeforeStart';
  if (v.weeklyOff.length > 3) e.weeklyOff = 'calendar.errors.tooManyOff';
  if (!wholeMinutes(v.lateGraceMin, 120)) e.lateGraceMin = 'calendar.errors.minutes';
  if (!wholeMinutes(v.maxBreakMin, 240)) e.maxBreakMin = 'calendar.errors.minutes';
  return e;
}

export function toShift(v: ShiftForm): Shift {
  return { name: v.name.trim(), start: v.start, end: v.end, weeklyOff: [...v.weeklyOff].sort((a, b) => a - b), lateGraceMin: Number(v.lateGraceMin), maxBreakMin: Number(v.maxBreakMin) };
}

/** Duty length of a shift in minutes (end − start). */
export function shiftMinutes(s: Pick<Shift, 'start' | 'end'>): number {
  return s.start && s.end && HHMM.test(s.start) && HHMM.test(s.end) ? Math.max(0, minutes(s.end) - minutes(s.start)) : 0;
}
