import { describe, expect, it } from 'vitest';
import { diff, parse, SECTIONS, toDraft, type FieldDef } from '../model/schema';

const field = (key: string) => SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key) as FieldDef;
const current = { 'duty.shiftStart': '09:00', 'duty.shiftEnd': '18:00', 'cash.limitPoisha': 5_000_000, 'cash.warnAtRatio': 0.8, 'duty.weeklyOff': [5], 'location.fastSec': 15, 'location.slowSec': 45 };

describe('settings schema', () => {
  it('round-trips money, ratio and ints through the draft', () => {
    expect(toDraft(field('cash.limitPoisha'), 5_000_000)).toBe('50000');
    expect(parse(field('cash.limitPoisha'), '৫০,০০০')).toEqual({ value: 5_000_000 });
    expect(toDraft(field('cash.warnAtRatio'), 0.8)).toBe('80');
    expect(parse(field('cash.warnAtRatio'), '85')).toEqual({ value: 0.85 });
    expect(parse(field('duty.lateGraceMin'), '500')).toEqual({ error: 'errors.range' });
    expect(parse(field('duty.lateGraceMin'), '1.5')).toEqual({ error: 'errors.int' });
  });

  it('validates time and version formats', () => {
    expect(parse(field('duty.shiftStart'), '9:00')).toEqual({ error: 'errors.time' });
    expect(parse(field('app.minVersion'), '1.2')).toEqual({ error: 'errors.version' });
    expect(parse(field('app.minVersion'), '1.2.0')).toEqual({ value: '1.2.0' });
  });

  it('returns only changed keys', () => {
    expect(diff(current, { 'cash.limitPoisha': '50000', 'duty.weeklyOff': [5] }).changes).toEqual({});
    expect(diff(current, { 'cash.limitPoisha': '60000', 'duty.weeklyOff': [6, 5] }).changes).toEqual({ 'cash.limitPoisha': 6_000_000, 'duty.weeklyOff': [5, 6] });
  });

  it('applies cross-field rules', () => {
    expect(diff(current, { 'duty.shiftEnd': '08:00' }).errors).toEqual({ 'duty.shiftEnd': 'errors.shiftOrder' });
    expect(diff(current, { 'location.fastSec': '60' }).errors).toEqual({ 'location.slowSec': 'errors.slowFast' });
  });
});
