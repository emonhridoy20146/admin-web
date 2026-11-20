import { describe, expect, it } from 'vitest';
import { diff, FIELDS, KNOWN, parse, read, SECTIONS, toDraft, type FieldDef } from '../model/schema';

const field = (key: string) => SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key) as FieldDef;
/** A share that may not be 0 % (no such setting today; the rule stays). */
const share: FieldDef = { key: 'test.share', type: 'ratio' };
// The settings as field-api sends them: duty hours and sampling are one JSON value each.
const shiftNow = { start: '09:00', end: '18:00', weeklyOff: [5], lateGraceMin: 15, maxBreakMin: 60, breakWindows: [] };
const current = { 'attendance.defaultShift': shiftNow, 'cash.limitPoisha': 5_000_000, 'location.sampling': { fastSec: 15, slowSec: 45, stillSec: 180, distanceFilterM: 25, maxAccuracyM: 50 } };

describe('settings schema', () => {
  it('round-trips money, ratio and ints through the draft', () => {
    expect(toDraft(field('cash.limitPoisha'), 5_000_000)).toBe('50000');
    expect(parse(field('cash.limitPoisha'), '৫০,০০০')).toEqual({ value: 5_000_000 });
    expect(toDraft(share, 0.8)).toBe('80');
    expect(parse(share, '85')).toEqual({ value: 0.85 });
    expect(parse(field('duty.lateGraceMin'), '500')).toEqual({ error: 'errors.range' });
    expect(parse(field('duty.lateGraceMin'), '1.5')).toEqual({ error: 'errors.int' });
  });

  it('validates time and version formats', () => {
    expect(parse(field('duty.shiftStart'), '9:00')).toEqual({ error: 'errors.time' });
    expect(parse(field('app.minVersion'), '1.2')).toEqual({ error: 'errors.version' });
    expect(parse(field('app.minVersion'), '1.2.0')).toEqual({ value: '1.2.0' });
  });

  it('returns only changed keys; a part of a JSON setting is sent inside the whole value', () => {
    expect(diff(current, { 'cash.limitPoisha': '50000', 'duty.weeklyOff': [5] }).changes).toEqual({});
    const d = diff(current, { 'cash.limitPoisha': '60000', 'duty.weeklyOff': [6, 5] });
    expect(d.changes).toEqual({ 'cash.limitPoisha': 6_000_000, 'attendance.defaultShift': { ...shiftNow, weeklyOff: [5, 6] } });
    expect(d.fieldChanges).toEqual({ 'cash.limitPoisha': 6_000_000, 'duty.weeklyOff': [5, 6] });
    // two parts of the same value travel together; the parts nobody edits here (distanceFilterM) are kept
    expect(diff(current, { 'location.fastSec': '10', 'location.stillSec': '300' }).changes).toEqual({ 'location.sampling': { fastSec: 10, slowSec: 45, stillSec: 300, distanceFilterM: 25, maxAccuracyM: 50 } });
  });

  it('only edits settings the server has (the form once showed keys the server refused)', () => {
    expect(read(field('duty.shiftStart'), current)).toBe('09:00');
    expect(read(field('location.slowSec'), current)).toBe(45);
    expect(read(field('duty.shiftStart'), {})).toBeUndefined();
    expect([...KNOWN]).toEqual(expect.arrayContaining(['attendance.defaultShift', 'location.sampling', 'collections.geofenceM', 'tags.requireApproval', 'attendance.overtimeAfterMin', 'attendance.lateDaysPerAbsent']));
    for (const gone of ['duty.shiftStart', 'cash.warnAtRatio', 'collections.farFromPinM', 'promises.maxHorizonDays', 'tags.staffCanSet', 'tags.approvalMode', 'location.fastSec']) expect(KNOWN.has(gone)).toBe(false);
    expect(new Set(FIELDS.map((f) => f.key)).size).toBe(FIELDS.length);
  });

  it('a branch that works every day with a Friday break; a branch off on Saturday (FR-ATT-010)', () => {
    const friday = diff(current, { 'duty.weeklyOff': [], 'duty.breakWindows': [{ weekday: 5, start: '12:30', end: '15:30' }] }, { branchOnly: true });
    expect(friday.errors).toEqual({});
    expect(friday.changes).toEqual({ 'attendance.defaultShift': { ...shiftNow, weeklyOff: [], breakWindows: [{ weekday: 5, start: '12:30', end: '15:30' }] } });
    expect(diff(current, { 'duty.weeklyOff': [6] }, { branchOnly: true }).changes).toEqual({ 'attendance.defaultShift': { ...shiftNow, weeklyOff: [6] } });

    const w = field('duty.breakWindows');
    expect(toDraft(w, undefined)).toEqual([]);
    expect(parse(w, [{ weekday: 5, start: '15:30', end: '12:30' }])).toEqual({ error: 'errors.windowOrder' });
    expect(parse(w, [{ weekday: 5, start: '12.30', end: '15:30' }])).toEqual({ error: 'errors.time' });
    expect(parse(w, [{ weekday: 5, start: '12:30', end: '15:30' }, { weekday: 5, start: '15:00', end: '16:00' }])).toEqual({ error: 'errors.windowOverlap' });
    expect(parse(w, [{ weekday: 6, start: '13:00', end: '14:00' }, { weekday: 5, start: '12:30', end: '15:30' }]).value).toEqual([{ weekday: 5, start: '12:30', end: '15:30' }, { weekday: 6, start: '13:00', end: '14:00' }]);
  });

  it('for one branch, only settings a branch may override are edited', () => {
    const d = diff(current, { 'duty.shiftStart': '08:00', 'app.minVersion': '2.0.0', 'attendance.lateDaysPerAbsent': '3' }, { branchOnly: true });
    expect(Object.keys(d.fieldChanges)).toEqual(['duty.shiftStart']);
    expect(Object.keys(d.changes)).toEqual(['attendance.defaultShift']);
  });

  it('lets the joint-visit credit go down to 0 % while other shares start at 1 % (FR-CW-005)', () => {
    expect(parse(field('cowork.visitCredit'), '0')).toEqual({ value: 0 });
    expect(parse(field('cowork.visitCredit'), '৫০')).toEqual({ value: 0.5 });
    expect(parse(field('cowork.visitCredit'), '101')).toEqual({ error: 'errors.ratio0' });
    expect(toDraft(field('cowork.visitCredit'), 1)).toBe('100');
    expect(parse(share, '0')).toEqual({ error: 'errors.ratio' });
    expect(parse(field('cowork.maxMembers'), '1')).toEqual({ error: 'errors.range' });
    expect(parse(field('cowork.maxMembers'), '5')).toEqual({ value: 5 });
  });

  it('applies cross-field rules', () => {
    expect(diff(current, { 'duty.shiftEnd': '08:00' }).errors).toEqual({ 'duty.shiftEnd': 'errors.shiftOrder' });
    expect(diff(current, { 'location.fastSec': '60' }).errors).toEqual({ 'location.slowSec': 'errors.slowFast' });
  });

  it('stores selfie events as an ordered subset and needs at least one while photos are required', () => {
    const f = SECTIONS.find((x) => x.id === 'attendance')!.fields.find((x) => x.key === 'attendance.selfieEvents')!;
    expect(parse(f, ['work_out', 'bogus', 'work_in'])).toEqual({ value: ['work_in', 'work_out'] });
    expect(toDraft(f, undefined)).toEqual([]);
    const cur = { 'attendance.selfieRequired': true, 'attendance.selfieEvents': ['work_in', 'work_out'] };
    expect(diff(cur, { 'attendance.selfieEvents': [] }).errors).toEqual({ 'attendance.selfieEvents': 'errors.selfieEvents' });
    expect(diff(cur, { 'attendance.selfieRequired': false, 'attendance.selfieEvents': [] })).toEqual({ changes: { 'attendance.selfieRequired': false, 'attendance.selfieEvents': [] }, errors: {}, fieldChanges: { 'attendance.selfieRequired': false, 'attendance.selfieEvents': [] } });
    expect(diff(cur, { 'attendance.selfieEvents': ['work_in', 'work_out'] }).changes).toEqual({});
  });

  it('edits the report settings (FR-REP-005, FR-CUS-009)', () => {
    expect(parse(field('reports.leaderboardMinPresentDays'), '০')).toEqual({ value: 0 });
    expect(parse(field('reports.leaderboardMinPresentDays'), '32')).toEqual({ error: 'errors.range' });
    expect(parse(field('reports.dataQualityMaxBranchKm'), '0')).toEqual({ error: 'errors.range' });
    expect(parse(field('reports.dataQualityMaxBranchKm'), '30')).toEqual({ value: 30 });
    expect(parse(field('reports.leaderboardVisibleToStaff'), true)).toEqual({ value: true });
  });
});
