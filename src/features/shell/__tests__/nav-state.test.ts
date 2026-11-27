import { describe, expect, it } from 'vitest';
import { isFolded, lastTabHref, remember, toggleFold } from '../components/nav-state';

/** FR-W-075 (ADR-W32): foldable sidebar submenus; remembered filters per page (FR-W-069, memory only). */
describe('sidebar submenus', () => {
  it('folds a section the user folded, except the one holding the open page', () => {
    expect(isFolded('staff', 'collections', ['staff'])).toBe(true);
    expect(isFolded('collections', 'collections', ['collections', 'staff'])).toBe(false);
    expect(isFolded('admin', undefined, [])).toBe(false);
    expect(isFolded('admin', undefined, ['admin'])).toBe(true);
  });

  it('toggles a section in the folded list without touching the others', () => {
    expect(toggleFold('staff', [])).toEqual(['staff']);
    expect(toggleFold('staff', ['admin', 'staff'])).toEqual(['admin']);
    const before = ['admin'];
    toggleFold('staff', before);
    expect(before).toEqual(['admin']);
  });

  it('reopens a page with its last filters, never its drawer, page number, branch or co-work drill-down', () => {
    expect(lastTabHref('/visits')).toBe('/visits/');
    remember('/visits', new URLSearchParams('range=7d&drawer=v1&branch=b2&page=3&session=s1&q=rahim'));
    expect(lastTabHref('/visits')).toBe('/visits/?range=7d&q=rahim');
    remember('/visits', new URLSearchParams('drawer=v2'));
    expect(lastTabHref('/visits')).toBe('/visits/');
    expect(lastTabHref('/')).toBe('/');
  });
});
