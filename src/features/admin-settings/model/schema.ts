/**
 * Typed form schema for the org settings key/value store (FR-SET-001). The server owns the keys; this file only
 * decides how known keys are edited. Unknown keys are shown read-only so nothing is hidden.
 */
export type FieldDef =
  | { key: string; type: 'time' }
  | { key: string; type: 'int'; min: number; max: number; unit?: 'min' | 'sec' | 'days' | 'm' | 'people' }
  | { key: string; type: 'money' }
  /** a share shown as whole percent; `min` defaults to 1 % (0 % allowed only where the setting means "nothing") */
  | { key: string; type: 'ratio'; min?: number }
  | { key: string; type: 'bool' }
  | { key: string; type: 'enum'; options: string[] }
  | { key: string; type: 'weekdays' }
  /** any subset of fixed options, stored as a JSON array in the options' order */
  | { key: string; type: 'multi'; options: string[] }
  | { key: string; type: 'version' };

export interface SectionDef {
  id: string;
  fields: FieldDef[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'duty',
    fields: [
      { key: 'duty.shiftStart', type: 'time' },
      { key: 'duty.shiftEnd', type: 'time' },
      { key: 'duty.weeklyOff', type: 'weekdays' },
      { key: 'duty.lateGraceMin', type: 'int', min: 0, max: 120, unit: 'min' },
      { key: 'duty.maxBreakMin', type: 'int', min: 0, max: 240, unit: 'min' },
    ],
  },
  {
    id: 'cash',
    fields: [
      { key: 'cash.limitPoisha', type: 'money' },
      { key: 'cash.limitMode', type: 'enum', options: ['warn', 'block'] },
      { key: 'cash.warnAtRatio', type: 'ratio' },
    ],
  },
  {
    id: 'collections',
    fields: [
      { key: 'collections.farFromPinM', type: 'int', min: 50, max: 5000, unit: 'm' },
      { key: 'collections.photoRequiredAbovePoisha', type: 'money' },
    ],
  },
  { id: 'tags', fields: [{ key: 'tags.staffCanSet', type: 'bool' }, { key: 'tags.approvalMode', type: 'bool' }] },
  { id: 'promises', fields: [{ key: 'promises.maxHorizonDays', type: 'int', min: 1, max: 180, unit: 'days' }, { key: 'promises.graceDays', type: 'int', min: 0, max: 14, unit: 'days' }] },
  {
    id: 'location',
    fields: [
      { key: 'location.trackingProvider', type: 'enum', options: ['free', 'paid'] },
      { key: 'location.retentionDays', type: 'int', min: 7, max: 365, unit: 'days' },
      { key: 'location.trackDuringBreak', type: 'bool' },
      { key: 'location.maxAccuracyM', type: 'int', min: 10, max: 500, unit: 'm' },
      { key: 'location.fastSec', type: 'int', min: 5, max: 300, unit: 'sec' },
      { key: 'location.slowSec', type: 'int', min: 5, max: 600, unit: 'sec' },
      { key: 'location.stillSec', type: 'int', min: 30, max: 1800, unit: 'sec' },
    ],
  },
  {
    id: 'attendance',
    fields: [
      { key: 'attendance.selfieRequired', type: 'bool' },
      { key: 'attendance.selfieEvents', type: 'multi', options: ['work_in', 'break_start', 'break_end', 'work_out'] },
    ],
  },
  {
    id: 'cowork',
    fields: [
      // FR-CW-005: what one joint visit counts for each participant in visit targets (100 % = full credit)
      { key: 'cowork.visitCredit', type: 'ratio', min: 0 },
      { key: 'cowork.maxMembers', type: 'int', min: 2, max: 10, unit: 'people' },
    ],
  },
  { id: 'app', fields: [{ key: 'app.minVersion', type: 'version' }] },
];

export const KNOWN = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));

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
    default:
      return v ?? '';
  }
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
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(d)) ? { value: String(d) } : { error: 'errors.time' };
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

/** Validate a draft against current settings: returns field errors and the minimal change set. */
export function diff(current: Record<string, unknown>, draft: Draft): { changes: Record<string, unknown>; errors: Record<string, string> } {
  const changes: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const parsed: Record<string, unknown> = { ...current };
  for (const sec of SECTIONS)
    for (const f of sec.fields) {
      if (!(f.key in draft)) continue;
      const r = parse(f, draft[f.key]);
      if (r.error) errors[f.key] = r.error;
      else {
        parsed[f.key] = r.value;
        if (!same(r.value, current[f.key])) changes[f.key] = r.value;
      }
    }
  Object.assign(errors, Object.fromEntries(Object.entries(crossErrors(parsed)).filter(([k]) => !errors[k])));
  return { changes, errors };
}
