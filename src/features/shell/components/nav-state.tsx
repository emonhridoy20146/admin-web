'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { sectionForPath, type NavRoute } from '@/shared/feature/registry';
import { useGate } from '@/shared/feature/useGate';

/**
 * FR-W-069 / FR-W-075: the last filters used on each page of a sidebar section, so going back to a page from its
 * submenu opens it as it was left. Memory only (never storage: a search can hold a customer's name or phone). Open
 * drawers, dialogs, the page number and the branch are not remembered; the branch always follows the switcher.
 */
const lastSearch = new Map<string, string>();
// `session` is a drill-down from a co-work session ("its joint visits"), not a filter the user set
const FORGET = ['drawer', 'branch', 'cursor', 'page', 'new', 'action', 'show', 'hand', 'dep', 'session'];

export function remember(path: string, sp: URLSearchParams) {
  const keep = new URLSearchParams(sp);
  for (const k of FORGET) keep.delete(k);
  const q = keep.toString();
  if (q) lastSearch.set(path, q);
  else lastSearch.delete(path);
}

/** A page's link: its path with the filters it was left with. */
export function lastTabHref(path: string): string {
  const q = lastSearch.get(path);
  return q ? `${path}/?${q}` : `${path === '/' ? '' : path}/`;
}

/** Records the open section page's filters while it is shown (not on pages below it, such as a customer's page). */
export function useRememberFilters() {
  const gate = useGate();
  const pathname = usePathname();
  const sp = useSearchParams();
  const hit = sectionForPath(pathname, gate);
  const activePath = hit?.exact ? hit.active.path : null;
  useEffect(() => {
    if (activePath) remember(activePath, new URLSearchParams(sp.toString()));
  }, [activePath, sp]);
}

/**
 * FR-W-075 (ADR-W32): whether a sidebar section's submenu is folded. The user's choice (kept in the browser), except
 * that the section holding the open page is always unfolded so the open page is never hidden.
 */
export function isFolded(sectionId: string, activeSectionId: string | undefined, closed: readonly string[]): boolean {
  return sectionId !== activeSectionId && closed.includes(sectionId);
}

/** Folds or unfolds a section: the new list of folded section ids. */
export function toggleFold(sectionId: string, closed: readonly string[]): string[] {
  return closed.includes(sectionId) ? closed.filter((x) => x !== sectionId) : [...closed, sectionId];
}

/** Calls each route's badge hook in its own child (hooks cannot run in a loop of changing length) and adds them up. */
export function useBadgeSum(routes: NavRoute[]): [number, React.ReactNode] {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const report = useCallback((path: string, n: number) => setCounts((c) => (c[path] === n ? c : { ...c, [path]: n })), []);
  const paths = new Set(routes.map((r) => r.path));
  const sum = Object.entries(counts).reduce((a, [p, n]) => (paths.has(p) ? a + n : a), 0);
  const probes = routes.map((r) => <BadgeProbe key={r.path} path={r.path} use={r.useBadge!} report={report} />);
  return [sum, probes];
}

function BadgeProbe({ path, use, report }: { path: string; use: () => number | undefined; report: (path: string, n: number) => void }) {
  const n = use() ?? 0;
  useEffect(() => report(path, n), [path, n, report]);
  return null;
}
