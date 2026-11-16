import type { AttendanceEvent, AttendanceDay } from '../api/attendance';

export type Status = NonNullable<AttendanceDay['status']>;

/** Counted as "came to work" for the day. */
const WORKED: Status[] = ['on_duty', 'on_break', 'off_duty', 'present', 'late'];

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + by;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** All business dates of a month, optionally cut at `until` (no future days). */
export function monthDays(month: string, until?: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const all = Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  return until ? all.filter((d) => d <= until) : all;
}

export function lastDay(month: string): string {
  return monthDays(month).at(-1)!;
}

/** userId → date → day */
export function index(days: AttendanceDay[] | undefined): Map<string, Map<string, AttendanceDay>> {
  const out = new Map<string, Map<string, AttendanceDay>>();
  for (const d of days ?? []) {
    if (!d.userId || !d.businessDate) continue;
    if (!out.has(d.userId)) out.set(d.userId, new Map());
    out.get(d.userId)!.set(d.businessDate, d);
  }
  return out;
}

export interface DayCounts {
  worked: number;
  late: number;
  absent: number;
  leave: number;
  onDuty: number;
  notStarted: number;
}

export function countDay(days: AttendanceDay[] | undefined): DayCounts {
  const c: DayCounts = { worked: 0, late: 0, absent: 0, leave: 0, onDuty: 0, notStarted: 0 };
  for (const d of days ?? []) {
    const s = d.status;
    if (!s) continue;
    if (WORKED.includes(s)) c.worked++;
    if (s === 'late' || (d.lateMin ?? 0) > 0) c.late++;
    if (s === 'absent') c.absent++;
    if (s === 'leave') c.leave++;
    if (s === 'on_duty' || s === 'on_break') c.onDuty++;
    if (s === 'not_started') c.notStarted++;
  }
  return c;
}

/** Sort for the day list: problems first (absent, not started, late), then on duty, then the rest. */
const RANK: Record<Status, number> = { absent: 0, not_started: 1, late: 2, on_break: 3, on_duty: 4, off_duty: 5, present: 5, leave: 6, weekly_off: 7, holiday: 7 };
export function sortDay<T extends { day?: AttendanceDay; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (RANK[a.day?.status ?? 'not_started'] ?? 9) - (RANK[b.day?.status ?? 'not_started'] ?? 9) || (b.day?.lateMin ?? 0) - (a.day?.lateMin ?? 0) || a.name.localeCompare(b.name));
}

/** Business date + wall-clock HH:mm in Dhaka (UTC+6, no DST) → ISO instant. */
export function dhakaIso(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+06:00`).toISOString();
}

export const CORRECTION_TYPES = ['work_in', 'break_start', 'break_end', 'work_out'] as const;
export const REASON_MIN = 10;

export interface CorrectionForm {
  type: (typeof CORRECTION_TYPES)[number];
  time: string;
  reason: string;
}

export function validateCorrection(v: CorrectionForm, date: string, now: Date = new Date()): Partial<Record<keyof CorrectionForm, string>> {
  const e: Partial<Record<keyof CorrectionForm, string>> = {};
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)) e.time = 'errors.time';
  else if (Date.parse(dhakaIso(date, v.time)) > now.getTime()) e.time = 'errors.future';
  if (v.reason.trim().length < REASON_MIN) e.reason = 'errors.reason';
  return e;
}

/** A day is flagged when at least one of its events came without the required photo. */
export function missingSelfie(d: Pick<AttendanceDay, 'flags'> | undefined): boolean {
  return !!d?.flags?.includes('no_selfie');
}

export const EVENT_FLAGS = ['no_selfie', 'no_location', 'mock_location', 'clock_skew', 'late_sync'] as const;
export type EventFlag = (typeof EVENT_FLAGS)[number];

/** Known flags of an event, in a fixed order; unknown ones are dropped so the UI never shows a raw key. */
export function eventFlags(e: Pick<AttendanceEvent, 'flags'>): EventFlag[] {
  return EVENT_FLAGS.filter((f) => e.flags?.includes(f));
}

export interface EventSummary {
  total: number;
  withPhoto: number;
  noPhoto: number;
}

/** Counts over the events that still count in the day (replaced ones are history). */
export function summariseEvents(events: AttendanceEvent[] | undefined): EventSummary {
  const live = (events ?? []).filter((e) => !e.replaced);
  return { total: live.length, withPhoto: live.filter((e) => !!e.selfieMediaId).length, noPhoto: live.filter((e) => e.flags?.includes('no_selfie')).length };
}
