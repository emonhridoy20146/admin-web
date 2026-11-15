'use client';
/**
 * URL state (06-data-model §4): filters, sort, cursor and drawer live in the query string so links are
 * shareable and Back works. Unknown/invalid params are dropped by the caller's parser.
 */
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type UrlPatch = Record<string, string | string[] | null | undefined>;

export function useUrlState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = useCallback((k: string) => sp.get(k) ?? '', [sp]);
  const getList = useCallback((k: string) => (sp.get(k) ?? '').split(',').filter(Boolean), [sp]);

  const set = useCallback(
    (patch: UrlPatch, opts: { push?: boolean } = {}) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        const val = Array.isArray(v) ? v.join(',') : v;
        if (val == null || val === '') next.delete(k);
        else next.set(k, val);
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts.push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [sp, router, pathname],
  );

  return useMemo(() => ({ get, getList, set, params: sp }), [get, getList, set, sp]);
}

/** Parse a value from an allow-list; anything else is dropped silently. */
export function oneOf<T extends string>(v: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
export function listOf<T extends string>(v: string[], allowed: readonly T[]): T[] {
  return v.filter((x): x is T => (allowed as readonly string[]).includes(x));
}
