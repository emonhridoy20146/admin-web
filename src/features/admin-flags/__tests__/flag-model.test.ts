import { describe, expect, it } from 'vitest';
import { applyTri, isOnFor, overridesOf, sameOverrides, toBody, triOf } from '../model/flag';

describe('feature flag model', () => {
  const f = { key: 'module.location', defaultEnabled: false, branchOverrides: [{ branchId: 'b1', enabled: true }] };

  it('reads overrides and tri-state per branch', () => {
    const o = overridesOf(f);
    expect(o).toEqual({ b1: true });
    expect(triOf(o, 'b1')).toBe('on');
    expect(triOf(o, 'b2')).toBe('inherit');
  });

  it('applies tri-state edits and builds the PUT body', () => {
    const o = applyTri(applyTri(overridesOf(f), 'b2', 'off'), 'b1', 'inherit');
    expect(o).toEqual({ b2: false });
    expect(toBody(o)).toEqual([{ branchId: 'b2', enabled: false }]);
  });

  it('resolves the effective state with default OFF', () => {
    expect(isOnFor(false, { b1: true }, 'b1')).toBe(true);
    expect(isOnFor(true, { b1: false }, 'b1')).toBe(false);
    expect(isOnFor(undefined, {}, 'b9')).toBe(false);
  });

  it('compares override sets', () => {
    expect(sameOverrides({ a: true, b: false }, { b: false, a: true })).toBe(true);
    expect(sameOverrides({ a: true }, { a: false })).toBe(false);
  });
});
