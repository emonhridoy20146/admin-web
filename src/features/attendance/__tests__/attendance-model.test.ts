import { describe, expect, it } from 'vitest';
import { countDay, deletablePhotos, dhakaIso, summariseEvents, index, lastDay, monthDays, monthOf, offDayWorked, shiftMonth, sortDay, validateCorrection } from '../model/attendance';

describe('attendance model', () => {
  it('a day off that was worked is marked only when it earned overtime (contract 1.25.0)', () => {
    expect(offDayWorked({ flags: ['worked_on_off_day', 'overtime'], overtimeMin: 240 })).toBe(true);
    // work during approved leave carries the flag but no overtime
    expect(offDayWorked({ flags: ['worked_on_off_day'], overtimeMin: 0 })).toBe(false);
    expect(offDayWorked({ flags: ['overtime'], overtimeMin: 45 })).toBe(false);
    // an older server sends neither
    expect(offDayWorked({ flags: [] })).toBe(false);
    expect(offDayWorked(undefined)).toBe(false);
  });
  it('handles months', () => {
    expect(monthOf('2026-11-15')).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthDays('2026-02')).toHaveLength(28);
    expect(monthDays('2026-11', '2026-11-15')).toHaveLength(15);
    expect(lastDay('2026-11')).toBe('2026-11-30');
  });
  it('indexes days by user and date', () => {
    const idx = index([{ userId: 'u1', businessDate: '2026-11-14', status: 'present' }, { userId: 'u1', businessDate: '2026-11-15', status: 'late' }, { userId: 'u2', businessDate: '2026-11-15', status: 'absent' }]);
    expect(idx.get('u1')?.get('2026-11-15')?.status).toBe('late');
    expect(idx.get('u2')?.size).toBe(1);
  });
  it('counts a day', () => {
    const c = countDay([{ status: 'on_duty', lateMin: 0 }, { status: 'on_break', lateMin: 20 }, { status: 'late', lateMin: 35 }, { status: 'absent' }, { status: 'leave' }, { status: 'not_started' }, { status: 'weekly_off' }]);
    expect(c).toEqual({ worked: 3, late: 2, absent: 1, leave: 1, onDuty: 2, notStarted: 1 });
  });
  it('puts problems first in the day list', () => {
    const rows = sortDay([
      { name: 'C', day: { status: 'on_duty' as const } },
      { name: 'A', day: { status: 'late' as const, lateMin: 10 } },
      { name: 'B', day: { status: 'absent' as const } },
      { name: 'D', day: { status: 'late' as const, lateMin: 40 } },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['B', 'D', 'A', 'C']);
  });
  it('converts Dhaka wall time to an instant', () => {
    expect(dhakaIso('2026-11-15', '09:05')).toBe('2026-11-15T03:05:00.000Z');
  });
  it('validates a correction', () => {
    const now = new Date('2026-11-15T06:00:00Z'); // 12:00 Dhaka
    expect(validateCorrection({ type: 'work_in', time: '09:10', reason: 'Phone was dead in the morning' }, '2026-11-15', now)).toEqual({});
    expect(validateCorrection({ type: 'work_in', time: '13:00', reason: 'Phone was dead in the morning' }, '2026-11-15', now).time).toBe('errors.future');
    expect(validateCorrection({ type: 'work_in', time: '9:10', reason: 'short' }, '2026-11-15', now)).toEqual({ time: 'errors.time', reason: 'errors.reason' });
  });

  it('counts photos an admin deleted, and the photos still to delete (FR-MED-004)', () => {
    const ev = (id: string, extra: Record<string, unknown>) => ({ id, type: 'work_in' as const, at: '2026-11-21T03:00:00Z', flags: [], ...extra });
    const events = [
      ev('a', { selfieMediaId: null, selfieDeleted: { at: '2026-11-22T06:00:00Z', by: 'u1', byName: 'Owner' } }),
      ev('b', { selfieMediaId: 'm2' }),
      ev('c', { selfieMediaId: null, flags: ['no_selfie'] }),
    ];
    expect(summariseEvents(events)).toEqual({ total: 3, withPhoto: 1, noPhoto: 1, deleted: 1 });
    expect(deletablePhotos(events)).toBe(1);
    expect(deletablePhotos(undefined)).toBe(0);
  });
});
