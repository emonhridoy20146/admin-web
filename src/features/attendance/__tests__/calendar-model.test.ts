import { describe, expect, it } from 'vitest';
import type { LeaveRequest } from '../api/leave';
import { covers, emptyShift, fromShift, leaveDays, overlapping, shiftMinutes, sortLeave, toHolidayCreate, toShift, validateHoliday, validateShift } from '../model/calendar';

const lr = (p: Partial<LeaveRequest>): LeaveRequest => ({ id: 'x', userId: 'u1', type: 'casual', from: '2026-11-18', to: '2026-11-19', status: 'pending', createdAt: '2026-11-17T04:00:00Z', ...p });

describe('leave', () => {
  it('counts days from..to, both included, or takes the server value', () => {
    expect(leaveDays({ from: '2026-11-18', to: '2026-11-18' })).toBe(1);
    expect(leaveDays({ from: '2026-11-30', to: '2026-12-02' })).toBe(3);
    expect(leaveDays({ from: '2026-11-20', to: '2026-11-19' })).toBe(0);
    expect(leaveDays({ from: '2026-11-18', to: '2026-11-19', days: 7 })).toBe(7);
  });

  it('puts waiting requests first, oldest first; the rest newest first', () => {
    const rows = [
      lr({ id: 'a', status: 'approved', createdAt: '2026-11-10T00:00:00Z' }),
      lr({ id: 'b', status: 'pending', createdAt: '2026-11-16T00:00:00Z' }),
      lr({ id: 'c', status: 'rejected', createdAt: '2026-11-15T00:00:00Z' }),
      lr({ id: 'd', status: 'pending', createdAt: '2026-11-14T00:00:00Z' }),
    ];
    expect(sortLeave(rows).map((r) => r.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('finds the same person’s blocking requests on the same days', () => {
    const r = lr({ id: 'r', from: '2026-11-18', to: '2026-11-20' });
    const all = [
      r,
      lr({ id: 'same-days', status: 'approved', from: '2026-11-20', to: '2026-11-21' }),
      lr({ id: 'withdrawn', status: 'cancelled', from: '2026-11-18', to: '2026-11-18' }),
      lr({ id: 'other-person', userId: 'u2', from: '2026-11-18', to: '2026-11-18' }),
      lr({ id: 'later', from: '2026-11-21', to: '2026-11-22' }),
    ];
    expect(overlapping(r, all).map((x) => x.id)).toEqual(['same-days']);
    expect(covers(r, '2026-11-19')).toBe(true);
    expect(covers(r, '2026-11-21')).toBe(false);
  });
});

describe('holidays', () => {
  it('needs a date and a Bangla name, and refuses a second holiday for the same branches', () => {
    const existing = [{ id: 'h1', date: '2026-12-16', branchIds: [], type: 'national' as const }, { id: 'h2', date: '2026-11-26', branchIds: ['b1'], type: 'branch' as const }];
    expect(validateHoliday({ date: '', nameBn: '', nameEn: '', branchIds: [] })).toEqual({ date: 'calendar.errors.date', nameBn: 'calendar.errors.required' });
    expect(validateHoliday({ date: '2026-12-16', nameBn: 'বিজয় দিবস', nameEn: '', branchIds: ['b1'] }, existing).date).toBe('calendar.errors.exists');
    expect(validateHoliday({ date: '2026-11-26', nameBn: 'সভা', nameEn: '', branchIds: ['b2'] }, existing)).toEqual({});
    expect(validateHoliday({ date: '2026-11-26', nameBn: 'সভা', nameEn: '', branchIds: [] }, existing).date).toBe('calendar.errors.exists');
  });

  it('sends national without branches and branch with them; English falls back to Bangla', () => {
    expect(toHolidayCreate({ date: '2026-12-16', nameBn: ' বিজয় দিবস ', nameEn: '', branchIds: [] })).toEqual({ date: '2026-12-16', name: { bn: 'বিজয় দিবস', en: 'বিজয় দিবস' }, type: 'national', branchIds: [] });
    expect(toHolidayCreate({ date: '2026-11-26', nameBn: 'সভা', nameEn: 'Meeting', branchIds: ['b1'] }).type).toBe('branch');
  });
});

describe('shifts', () => {
  it('checks times, order, weekly off and minutes', () => {
    expect(validateShift(emptyShift())).toEqual({ name: 'calendar.errors.required' });
    const ok = { ...emptyShift(), name: 'Day' };
    expect(validateShift(ok)).toEqual({});
    expect(validateShift({ ...ok, start: '9:00' }).start).toBe('calendar.errors.time');
    expect(validateShift({ ...ok, start: '18:00', end: '09:00' }).end).toBe('calendar.errors.endBeforeStart');
    expect(validateShift({ ...ok, weeklyOff: [0, 5, 6, 1] }).weeklyOff).toBe('calendar.errors.tooManyOff');
    expect(validateShift({ ...ok, lateGraceMin: '-5' }).lateGraceMin).toBe('calendar.errors.minutes');
    expect(validateShift({ ...ok, maxBreakMin: '300' }).maxBreakMin).toBe('calendar.errors.minutes');
  });

  it('round-trips a shift and sorts weekly off days', () => {
    const s = { id: 'sh', name: 'Market', start: '10:00', end: '19:00', weeklyOff: [6, 5], lateGraceMin: 20, maxBreakMin: 45 };
    expect(toShift(fromShift(s))).toEqual({ name: 'Market', start: '10:00', end: '19:00', weeklyOff: [5, 6], lateGraceMin: 20, maxBreakMin: 45 });
    expect(shiftMinutes(s)).toBe(540);
    expect(shiftMinutes({ start: 'x', end: '19:00' })).toBe(0);
  });
});
