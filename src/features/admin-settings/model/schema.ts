/**
 * Typed form schema for the settings key/value store (FR-SET-001). The server owns the keys; this file only
 * decides how known keys are edited. Unknown keys are shown read-only so nothing is hidden.
 *
 * Every `key` (or `src.key`) below must be a setting field-api defines: the server answers 400 for a key it does
 * not know. Some server settings are one JSON value (`attendance.defaultShift`, `location.sampling`); their parts
 * are edited as separate fields that name the value with `src`.
 */
type Kind =
  | { type: 'time' }
  | { type: 'int'; min: number; max: number; unit?: 'min' | 'sec' | 'days' | 'm' | 'km' | 'people' }
  | { type: 'money' }
  /** a share shown as whole percent; `min` defaults to 1 % (0 % allowed only where the setting means "nothing") */
  | { type: 'ratio'; min?: number }
  | { type: 'bool' }
  /** `labels` names the i18n key (`enum.<key>`) of an option whose plain name means something else in another setting */
  | { type: 'enum'; options: string[]; labels?: Record<string, string> }
  | { type: 'weekdays' }
  /** any subset of fixed options, stored as a JSON array in the options' order */
  | { type: 'multi'; options: string[] }
  | { type: 'version' }
  /** weekly break windows `[{ weekday, start, end }]` (field-api FR-ATT-010) */
  | { type: 'windows' };

export type FieldDef = Kind & {
  /** Form id and i18n key. The server key too, unless `src` is given. */
  key: string;
  /** This field is one property of a JSON setting: read and saved as `src.key[src.prop]`. */
  src?: { key: string; prop: string };
  /** The server lets a branch have its own value (`branchOverridable`). */
  branch?: boolean;
};

export interface BreakWindow {
  weekday: number;
  start: string;
  end: string;
}

export interface SectionDef {
  id: string;
  fields: FieldDef[];
}

const shift = (prop: string) => ({ src: { key: 'attendance.defaultShift', prop }, branch: true });
const sampling = (prop: string) => ({ src: { key: 'location.sampling', prop }, branch: true });

export const SECTIONS: SectionDef[] = [
  {
    // Duty hours of everyone without a named shift, org-wide or per branch (`attendance.defaultShift`).
    id: 'duty',
    fields: [
      { key: 'duty.shiftStart', type: 'time', ...shift('start') },
      { key: 'duty.shiftEnd', type: 'time', ...shift('end') },
      { key: 'duty.weeklyOff', type: 'weekdays', ...shift('weeklyOff') },
      { key: 'duty.lateGraceMin', type: 'int', min: 0, max: 240, unit: 'min', ...shift('lateGraceMin') },
      { key: 'duty.maxBreakMin', type: 'int', min: 0, max: 480, unit: 'min', ...shift('maxBreakMin') },
      { key: 'duty.breakWindows', type: 'windows', ...shift('breakWindows') },
      { key: 'attendance.overtimeAfterMin', type: 'int', min: 0, max: 240, unit: 'min', branch: true },
      { key: 'attendance.lateDaysPerAbsent', type: 'int', min: 0, max: 10, unit: 'days' },
    ],
  },
  {
    id: 'cash',
    fields: [
      { key: 'cash.limitPoisha', type: 'money', branch: true },
      { key: 'cash.limitMode', type: 'enum', options: ['warn', 'block'], branch: true },
    ],
  },
  {
    id: 'collections',
    fields: [
      { key: 'collections.geofenceM', type: 'int', min: 50, max: 5000, unit: 'm', branch: true },
      { key: 'collections.photoRequiredAbovePoisha', type: 'money', branch: true },
    ],
  },
  {
    id: 'customers',
    fields: [
      // FR-CUS-015 (contract 1.19.0): field staff see the whole branch, or only customers assigned to them
      { key: 'customers.staffVisibility', type: 'enum', options: ['branch', 'assigned'], branch: true },
      // FR-CUS-011: a staff pin for a customer without one applies at once, or always waits for a manager
      { key: 'customers.staffPinApproval', type: 'enum', options: ['when_missing', 'always'], branch: true },
    ],
  },
  { id: 'tags', fields: [{ key: 'tags.requireApproval', type: 'bool', branch: true }] },
  { id: 'promises', fields: [{ key: 'promises.graceDays', type: 'int', min: 0, max: 14, unit: 'days', branch: true }] },
  {
    id: 'location',
    fields: [
      { key: 'location.trackingProvider', type: 'enum', options: ['free', 'paid'] },
      { key: 'location.retentionDays', type: 'int', min: 7, max: 365, unit: 'days' },
      { key: 'location.trackDuringBreak', type: 'bool', branch: true },
      { key: 'location.maxAccuracyM', type: 'int', min: 10, max: 500, unit: 'm' },
      { key: 'location.fastSec', type: 'int', min: 5, max: 300, unit: 'sec', ...sampling('fastSec') },
      { key: 'location.slowSec', type: 'int', min: 5, max: 600, unit: 'sec', ...sampling('slowSec') },
      { key: 'location.stillSec', type: 'int', min: 30, max: 1800, unit: 'sec', ...sampling('stillSec') },
      { key: 'location.gapMin', type: 'int', min: 1, max: 120, unit: 'min' },
      { key: 'location.lostAfterMin', type: 'int', min: 5, max: 240, unit: 'min' },
    ],
  },
  {
    id: 'attendance',
    fields: [
      { key: 'attendance.selfieRequired', type: 'bool', branch: true },
      { key: 'attendance.selfieEvents', type: 'multi', options: ['work_in', 'break_start', 'break_end', 'work_out'], branch: true },
    ],
  },
  {
    id: 'cowork',
    fields: [
      // FR-CW-005: what one joint visit counts for each participant in visit targets (100 % = full credit)
      { key: 'cowork.visitCredit', type: 'ratio', min: 0, branch: true },
      { key: 'cowork.maxMembers', type: 'int', min: 2, max: 10, unit: 'people', branch: true },
    ],
  },
  {
    id: 'reports',
    fields: [
      // FR-REP-005 / OD-15: managers always see the leaderboard; field staff only when this is on
      { key: 'reports.leaderboardVisibleToStaff', type: 'bool', branch: true },
      // FR-REP-007: the collection board covers every branch, or only the viewer's own
      { key: 'reports.leaderboardScope', type: 'enum', options: ['all', 'branch'], labels: { all: 'boardAll', branch: 'boardBranch' } },
      { key: 'reports.leaderboardMinPresentDays', type: 'int', min: 0, max: 31, unit: 'days', branch: true },
      // FR-CUS-009: a pin further than this from its branch is reported as far_from_branch
      { key: 'reports.dataQualityMaxBranchKm', type: 'int', min: 1, max: 500, unit: 'km', branch: true },
    ],
  },
  { id: 'app', fields: [{ key: 'app.minVersion', type: 'version' }] },
];

export const FIELDS: FieldDef[] = SECTIONS.flatMap((s) => s.fields);

/** The server key a field is stored under. */
export const serverKey = (f: FieldDef) => f.src?.key ?? f.key;

/** Server keys this form edits; every other key the server sends is listed read-only. */
export const KNOWN = new Set(FIELDS.map(serverKey));

/** Draft values are what the inputs hold (strings for numbers, so partial typing works). */
export type Draft = Record<string, unknown>;

const BN = '০১২৩৪৫৬৭৮৯';
const ascii = (s: string) => s.replace(/[০-৯]/g, (c) => String(BN.indexOf(c))).replace(/,/g, '').trim();

export function toDraft(f: FieldDef, v: unknown): unknown {
  switch (f.type) {
    case 'int':
      return v == null ? '' : String(v);
    case 'money':
      return v == null ? '' : String(Math.round(Number(v) / 100));
    case 'ratio':
      return v == null ? '' : String(Math.round(Number(v) * 100));
    case 'weekdays':
    case 'multi':
      return Array.isArray(v) ? [...v] : [];
    case 'windows':
      return Array.isArray(v) ? v.map((w) => ({ ...(w as BreakWindow) })) : [];
    default:
      return v ?? '';
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The stored value of a field in the settings the server sent. */
export function read(f: FieldDef, current: Record<string, unknown>): unknown {
  if (!f.src) return current[f.key];
  const parent = current[f.src.key];
  return isObj(parent) ? parent[f.src.prop] : undefined;
}

/** Parse a draft back to the stored value; returns { error } with an i18n key on bad input. */
export function parse(f: FieldDef, d: unknown): { value?: unknown; error?: string } {
  switch (f.type) {
    case 'int': {
      const s = ascii(String(d ?? ''));
      if (!/^\d+$/.test(s)) return { error: 'errors.int' };
      const n = Number(s);
      if (n < f.min || n > f.max) return { error: 'errors.range' };
      return { value: n };
    }
    case 'money': {
      const s = ascii(String(d ?? ''));
      if (!/^\d+$/.test(s)) return { error: 'errors.money' };
      return { value: Number(s) * 100 };
    }
    case 'ratio': {
      const s = ascii(String(d ?? ''));
      if (!/^\d+$/.test(s) || Number(s) < (f.min ?? 1) || Number(s) > 100) return { error: (f.min ?? 1) === 0 ? 'errors.ratio0' : 'errors.ratio' };
      return { value: Number(s) / 100 };
    }
    case 'time':
      return TIME.test(String(d)) ? { value: String(d) } : { error: 'errors.time' };
    case 'windows': {
      const rows = Array.isArray(d) ? (d as BreakWindow[]) : [];
      if (rows.length > 14) return { error: 'errors.windowsMax' };
      for (const w of rows) {
        if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6 || !TIME.test(String(w.start)) || !TIME.test(String(w.end))) return { error: 'errors.time' };
        if (w.start >= w.end) return { error: 'errors.windowOrder' };
      }
      const sorted = rows.map((w) => ({ weekday: w.weekday, start: w.start, end: w.end })).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
      // two windows of one day may not overlap: the same break time would be allowed twice
      if (sorted.some((w, i) => i > 0 && sorted[i - 1]!.weekday === w.weekday && w.start < sorted[i - 1]!.end)) return { error: 'errors.windowOverlap' };
      return { value: sorted };
    }
    case 'version':
      return /^\d+\.\d+\.\d+$/.test(String(d)) ? { value: String(d) } : { error: 'errors.version' };
    case 'weekdays':
      return { value: [...((d as number[]) ?? [])].sort((a, b) => a - b) };
    case 'multi': {
      const picked = Array.isArray(d) ? d.map(String) : [];
      return { value: f.options.filter((o) => picked.includes(o)) };
    }
    case 'bool':
      return { value: !!d };
    case 'enum':
      return f.options.includes(String(d)) ? { value: String(d) } : { error: 'errors.required' };
  }
}

/** Cross-field rules. */
export function crossErrors(values: Record<string, unknown>): Record<string, string> {
  const e: Record<string, string> = {};
  const s = values['duty.shiftStart'];
  const en = values['duty.shiftEnd'];
  if (typeof s === 'string' && typeof en === 'string' && s >= en) e['duty.shiftEnd'] = 'errors.shiftOrder';
  const fast = values['location.fastSec'];
  const slow = values['location.slowSec'];
  if (typeof fast === 'number' && typeof slow === 'number' && fast > slow) e['location.slowSec'] = 'errors.slowFast';
  const ev = values['attendance.selfieEvents'];
  if (values['attendance.selfieRequired'] === true && Array.isArray(ev) && ev.length === 0) e['attendance.selfieEvents'] = 'errors.selfieEvents';
  return e;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Validate a draft against the settings the server sent. `changes` is the minimal body for `PATCH /settings`
 * (server keys; a JSON setting is sent whole with its edited parts replaced), `fieldChanges` the same edits by
 * form field, for the review list. With `branchOnly`, fields a branch cannot override are left out.
 */
export function diff(
  current: Record<string, unknown>,
  draft: Draft,
  opts: { branchOnly?: boolean } = {},
): { changes: Record<string, unknown>; errors: Record<string, string>; fieldChanges: Record<string, unknown> } {
  const changes: Record<string, unknown> = {};
  const fieldChanges: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const fields = FIELDS.filter((f) => !opts.branchOnly || f.branch);
  const parsed: Record<string, unknown> = Object.fromEntries(fields.map((f) => [f.key, read(f, current)]));
  for (const f of fields) {
    if (!(f.key in draft)) continue;
    const r = parse(f, draft[f.key]);
    if (r.error) errors[f.key] = r.error;
    else {
      parsed[f.key] = r.value;
      if (!same(r.value, read(f, current))) fieldChanges[f.key] = r.value;
    }
  }
  for (const f of fields) {
    if (!(f.key in fieldChanges)) continue;
    if (!f.src) changes[f.key] = fieldChanges[f.key];
    else {
      const base = isObj(changes[f.src.key]) ? (changes[f.src.key] as Record<string, unknown>) : isObj(current[f.src.key]) ? (current[f.src.key] as Record<string, unknown>) : {};
      changes[f.src.key] = { ...base, [f.src.prop]: fieldChanges[f.key] };
    }
  }
  Object.assign(errors, Object.fromEntries(Object.entries(crossErrors(parsed)).filter(([k]) => !errors[k])));
  return { changes, errors, fieldChanges };
}
