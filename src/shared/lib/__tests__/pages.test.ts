import { describe, expect, it } from 'vitest';
import { pageCountOf, pageList, parsePage, rowRange } from '../pages';

describe('pageList (FR-W-060)', () => {
  it('shows first, last and the current page with neighbours, gaps between', () => {
    expect(pageList(5, 20)).toEqual([1, 'gap', 4, 5, 6, 'gap', 20]);
  });
  it('keeps the row the same length near the ends', () => {
    expect(pageList(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(pageList(3, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(pageList(20, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
  });
  it('never hides a single page behind a gap', () => {
    expect(pageList(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
  });
  it('lists every page when there are few', () => {
    expect(pageList(2, 3)).toEqual([1, 2, 3]);
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(1, 0)).toEqual([]);
  });
  it('clamps a current page outside the range', () => {
    expect(pageList(99, 4)).toEqual([1, 2, 3, 4]);
  });
});

describe('row range and page count', () => {
  it('reads "Showing 101–200 of 2,430"', () => {
    expect(rowRange(2, 100, 100)).toEqual({ first: 101, last: 200 });
    expect(rowRange(25, 100, 30)).toEqual({ first: 2401, last: 2430 });
    expect(rowRange(1, 100, 0)).toEqual({ first: 0, last: 0 });
  });
  it('counts pages', () => {
    expect(pageCountOf(2430, 100)).toBe(25);
    expect(pageCountOf(2430, 1000)).toBe(3);
    expect(pageCountOf(0, 100)).toBe(1);
  });
  it('parses the page param safely', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('2.5')).toBe(1);
    expect(parsePage(null)).toBe(1);
  });
});
