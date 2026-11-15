export type DiffKind = 'added' | 'removed' | 'changed' | 'same';

export interface DiffRow {
  key: string;
  before: unknown;
  after: unknown;
  kind: DiffKind;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Flat key diff of an audit entry's before/after objects; changed rows first, unchanged last. */
export function diffRows(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined): DiffRow[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const rank: Record<DiffKind, number> = { changed: 0, added: 1, removed: 2, same: 3 };
  return keys
    .map((key): DiffRow => {
      const inB = key in b;
      const inA = key in a;
      const kind: DiffKind = inB && !inA ? 'removed' : !inB && inA ? 'added' : same(b[key], a[key]) ? 'same' : 'changed';
      return { key, before: b[key], after: a[key], kind };
    })
    .sort((x, y) => rank[x.kind] - rank[y.kind]);
}

/** Compact one-line rendering of a JSON value for the diff table (no HTML; plain text only). */
export function show(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/** "rbac.override.set" → "rbac" (filter group) */
export function actionGroup(action: string | undefined): string {
  return (action ?? '').split('.')[0] ?? '';
}
