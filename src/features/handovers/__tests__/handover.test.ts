import { describe, expect, it } from 'vitest';
import { areasOf, countByGroup, customersIn, emptyForm, groupOf, hoursLeft, toBody, validate } from '../model/handover';

const areas = [
  { id: 'a1', customerCount: 30, assignees: ['u1'], active: true },
  { id: 'a2', customerCount: 12, assignees: ['u1', 'u2'], active: true },
  { id: 'a3', customerCount: 9, assignees: ['u1'], active: false },
];
const T = '2026-11-15';

describe('handover model', () => {
  it('groups statuses into tabs', () => {
    expect(groupOf('pending_acceptance')).toBe('pending');
    expect(groupOf('accepted')).toBe('accepted');
    for (const s of ['rejected', 'cancelled', 'expired', 'reverted'] as const) expect(groupOf(s)).toBe('closed');
    expect(countByGroup([{ status: 'accepted' }, { status: 'expired' }, { status: 'pending_acceptance' }, { status: 'reverted' }] as never)).toEqual({ pending: 1, accepted: 1, closed: 2 });
  });

  it('counts hours until expiry only while pending', () => {
    const now = new Date('2026-11-15T06:00:00Z');
    expect(hoursLeft({ status: 'pending_acceptance', expiresAt: '2026-11-16T07:30:00Z' }, now)).toBe(25);
    expect(hoursLeft({ status: 'pending_acceptance', expiresAt: '2026-11-15T05:00:00Z' }, now)).toBe(0);
    expect(hoursLeft({ status: 'accepted', expiresAt: '2026-11-16T07:30:00Z' }, now)).toBeNull();
  });

  it('lists the active areas a staff member holds and sums customers', () => {
    expect(areasOf('u1', areas).map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(areasOf('u2', areas).map((a) => a.id)).toEqual(['a2']);
    expect(customersIn(['a1', 'a2'], areas)).toBe(42);
  });

  it('validates the form', () => {
    expect(validate(emptyForm(T), T)).toEqual({ fromUserId: 'errors.required', toUserId: 'errors.required', areaIds: 'errors.scope', reason: 'errors.reason' });
    const ok = { ...emptyForm(T), fromUserId: 'u1', toUserId: 'u2', areaIds: ['a1'], reason: 'Two weeks of leave' };
    expect(validate(ok, T)).toEqual({});
    expect(validate({ ...ok, toUserId: 'u1' }, T).toUserId).toBe('errors.same');
    expect(validate({ ...ok, effectiveDate: '2026-11-14' }, T).effectiveDate).toBe('errors.past');
    expect(validate({ ...ok, temporary: true }, T).endDate).toBe('errors.required');
    expect(validate({ ...ok, temporary: true, endDate: T }, T).endDate).toBe('errors.endBefore');
    expect(validate({ ...ok, temporary: true, endDate: '2026-11-29' }, T)).toEqual({});
  });

  it('sends endDate only for temporary cover', () => {
    const v = { ...emptyForm(T), fromUserId: 'u1', toUserId: 'u2', areaIds: ['a1'], reason: '  Two weeks of leave ', endDate: '2026-11-29' };
    expect(toBody(v)).toEqual({ fromUserId: 'u1', toUserId: 'u2', areaIds: ['a1'], reason: 'Two weeks of leave', effectiveDate: T });
    expect(toBody({ ...v, temporary: true }).endDate).toBe('2026-11-29');
  });
});
