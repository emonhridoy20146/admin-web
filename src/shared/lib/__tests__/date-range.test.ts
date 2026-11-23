import { describe, expect, it } from 'vitest';
import { daysIn, matchPreset, normalizeRange, PAST_PRESETS, presetRange, PROMISE_PRESETS, rangeInstants, rangeParams, readRange } from '../date-range';

const today = '2026-11-23';

describe('presetRange (FR-W-063, Asia/Dhaka days)', () => {
  it('covers the expected days', () => {
    expect(presetRange('today', today)).toEqual({ from: today, to: today });
    expect(presetRange('yesterday', today)).toEqual({ from: '2026-11-22', to: '2026-11-22' });
    expect(presetRange('7d', today)).toEqual({ from: '2026-11-17', to: today });
    expect(presetRange('month', today)).toEqual({ from: '2026-11-01', to: today });
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('next7', today)).toEqual({ from: '2026-11-24', to: '2026-11-30' });
    expect(presetRange('next15', today)).toEqual({ from: '2026-11-24', to: '2026-12-08' });
  });
  it('handles January for last month', () => {
    expect(presetRange('lastMonth', '2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('readRange', () => {
  it('reads a preset from the link', () => {
    expect(readRange({ range: '7d' }, today, PAST_PRESETS, 'today')).toMatchObject({ choice: '7d', from: '2026-11-17' });
  });
  it('drops a preset the page does not offer', () => {
    expect(readRange({ range: 'next7' }, today, PAST_PRESETS, 'today').choice).toBe('today');
    expect(readRange({ range: 'next7' }, today, PROMISE_PRESETS, 'today').choice).toBe('next7');
  });
  it('reads from/to as a custom range, or as the preset it matches', () => {
    expect(readRange({ from: '2026-11-01', to: '2026-11-10' }, today, PAST_PRESETS, 'today')).toEqual({ choice: 'custom', from: '2026-11-01', to: '2026-11-10' });
    expect(readRange({ from: today, to: today }, today, PAST_PRESETS, '7d').choice).toBe('today');
    expect(readRange({ from: '2026-11-05' }, today, PAST_PRESETS, 'today')).toMatchObject({ from: '2026-11-05', to: '2026-11-05' });
  });
  it('keeps a long range from the link as it is', () => {
    expect(readRange({ from: '2020-01-01', to: '2099-12-31' }, today, PAST_PRESETS, 'today')).toEqual({ choice: 'custom', from: '2020-01-01', to: '2099-12-31' });
  });
  it('ignores bad dates', () => {
    expect(readRange({ from: '2026-13-40', to: 'x' }, today, PAST_PRESETS, 'today').choice).toBe('today');
  });
});

describe('helpers', () => {
  it('orders and caps a range', () => {
    expect(normalizeRange({ from: '2026-11-10', to: '2026-11-01' })).toEqual({ from: '2026-11-01', to: '2026-11-10' });
    expect(normalizeRange({ from: '2020-01-01', to: '2026-11-23' }, 31)).toEqual({ from: '2026-10-24', to: '2026-11-23' });
  });
  it('writes link values', () => {
    expect(rangeParams('today', null, 'today')).toEqual({ range: null, from: null, to: null });
    expect(rangeParams('month', null, 'today')).toEqual({ range: 'month', from: null, to: null });
    expect(rangeParams('custom', { from: '2026-11-02', to: '2026-11-01' }, 'today')).toEqual({ range: null, from: '2026-11-01', to: '2026-11-02' });
  });
  it('counts days and matches presets', () => {
    expect(daysIn({ from: '2026-11-01', to: '2026-11-30' })).toBe(30);
    expect(matchPreset({ from: '2026-11-17', to: today }, today, PAST_PRESETS)).toBe('7d');
  });
  it('gives Dhaka day bounds as instants', () => {
    expect(rangeInstants({ from: today, to: today })).toEqual({ from: '2026-11-22T18:00:00.000Z', to: '2026-11-23T17:59:59.999Z' });
  });
});
