import { describe, expect, it } from 'vitest';
import { actionGroup, diffRows, show } from '../model/diff';

describe('audit diff', () => {
  it('classifies and orders keys', () => {
    const rows = diffRows({ a: 1, b: 2, c: [1] }, { a: 1, b: 3, d: 'x' });
    expect(rows.map((r) => [r.key, r.kind])).toEqual([['b', 'changed'], ['d', 'added'], ['c', 'removed'], ['a', 'same']]);
  });

  it('handles missing sides', () => {
    expect(diffRows(undefined, { x: true })).toEqual([{ key: 'x', before: undefined, after: true, kind: 'added' }]);
    expect(diffRows(undefined, undefined)).toEqual([]);
  });

  it('renders values as plain text', () => {
    expect(show(undefined)).toBe('—');
    expect(show(null)).toBe('null');
    expect(show('<b>x</b>')).toBe('<b>x</b>');
    expect(show({ a: [1, 2] })).toBe('{"a":[1,2]}');
  });

  it('groups actions by prefix', () => {
    expect(actionGroup('rbac.override.set')).toBe('rbac');
    expect(actionGroup(undefined)).toBe('');
  });
});
