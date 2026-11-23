/**
 * Numbered pager helpers (FR-W-060). Pure functions so the pager and its tests agree on what is shown.
 */

export type PageItem = number | 'gap';

/**
 * The page buttons to show: always the first and last page, the current page with `around` neighbours on each side,
 * and a gap where pages are left out. A gap never hides a single page (1 … 3 would be shown as 1 2 3).
 * `pageList(5, 20)` → `[1, 'gap', 4, 5, 6, 'gap', 20]`.
 */
export function pageList(current: number, count: number, around = 1): PageItem[] {
  if (count <= 0) return [];
  const cur = Math.min(Math.max(1, current), count);
  const want = new Set<number>([1, count]);
  for (let p = cur - around; p <= cur + around; p++) if (p >= 1 && p <= count) want.add(p);
  // near either end show a few more so the row keeps the same length while moving
  if (cur <= 2 + around) for (let p = 1; p <= Math.min(count, 3 + around * 2); p++) want.add(p);
  if (cur >= count - 1 - around) for (let p = Math.max(1, count - 2 - around * 2); p <= count; p++) want.add(p);
  const sorted = [...want].sort((a, b) => a - b);
  const out: PageItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev != null && p - prev === 2) out.push(prev + 1);
    else if (prev != null && p - prev > 2) out.push('gap');
    out.push(p);
  }
  return out;
}

/** Number of pages for `total` rows (at least 1). */
export function pageCountOf(total: number, size: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, size)));
}

/** First and last row number shown on a page (1-based), for "Showing 101–200 of 2,430". `rows` = rows on this page. */
export function rowRange(page: number, size: number, rows: number): { first: number; last: number } {
  if (rows <= 0) return { first: 0, last: 0 };
  const first = (Math.max(1, page) - 1) * size + 1;
  return { first, last: first + rows - 1 };
}

/** Reads a 1-based page number from the URL; anything else is page 1. */
export function parsePage(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
}
