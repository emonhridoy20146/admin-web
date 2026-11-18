import { describe, expect, it } from 'vitest';
import { payGlyph, payLook, payStateOf, psToken, worstPayState } from '../model/pay-state';

describe('pay state (pin colour, field-api ADR-035)', () => {
  it('takes the server value when there is one', () => {
    expect(payStateOf({ payState: 'missed_many', status: 'paid_up' })).toBe('missed_many');
  });
  it('reads an older server status: tagged/suggested bad = red, overdue = one missed unless a count says more', () => {
    expect(payStateOf({ status: 'overdue', tagged: true })).toBe('bad');
    expect(payStateOf({ badges: ['bad_suggested', 'overdue'] })).toBe('bad');
    expect(payStateOf({ tag: { state: 'tagged', severity: 'watch' }, badges: ['overdue'] })).toBe('missed_one');
    expect(payStateOf({ status: 'overdue', missedCount: 3 })).toBe('missed_many');
    expect(payStateOf({ status: 'promised_today' })).toBe('missed_one');
    expect(payStateOf({ status: 'due_today' })).toBe('due_today');
    expect(payStateOf({ status: 'current' })).toBe('on_track');
    expect(payStateOf({ status: 'paid_up' })).toBe('paid_off');
    expect(payStateOf({ totalOutstandingPoisha: 0 })).toBe('paid_off');
  });
  it('orders worst first', () => {
    expect(worstPayState(['on_track', 'missed_one', null, 'paid_off'])).toBe('missed_one');
    expect(worstPayState([])).toBeNull();
  });
  it('puts a glyph in the pin that says what the colour says', () => {
    expect(payGlyph('bad')).toBe('alert');
    expect(payGlyph('missed_many', 4)).toEqual({ text: '4' });
    expect(payGlyph('missed_many', null)).toEqual({ text: '2' });
    expect(payGlyph('missed_one', 1, () => '১')).toEqual({ text: '১' });
    expect(payGlyph('missed_many', 140)).toEqual({ text: '99+' });
    expect(payGlyph('due_today')).toBe('dot');
    expect(payGlyph('on_track')).toBe('check');
    expect(payLook('missed_one', 1)).toMatchObject({ fill: '--ps-missed-one-pin', edge: '--ps-missed-one-fg' });
    expect(psToken('paid_off', 'bg')).toBe('--ps-paid-off-bg');
  });
});
