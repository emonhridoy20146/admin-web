import { describe, expect, it } from 'vitest';
import { listOrItems } from '../list';

describe('listOrItems', () => {
  it('reads a plain array and an items envelope', () => {
    expect(listOrItems<number>([1, 2])).toEqual([1, 2]);
    expect(listOrItems<number>({ items: [3] })).toEqual([3]);
  });
  it('falls back to an empty list', () => {
    expect(listOrItems(null)).toEqual([]);
    expect(listOrItems(undefined)).toEqual([]);
    expect(listOrItems({ items: 'x' })).toEqual([]);
  });
});
