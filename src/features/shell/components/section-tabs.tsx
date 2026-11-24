'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { sectionForPath, type NavRoute } from '@/shared/feature/registry';
import { useGate } from '@/shared/feature/useGate';
import { cn } from '@/shared/lib/cn';
import { formatNumber } from '@/shared/lib/format';

/**
 * FR-W-069: the last filters used on each tab, so going back to a tab (from its strip or the sidebar) opens it as it
 * was left. Memory only (never storage: a search can hold a customer's name or phone). Open drawers, dialogs, the page
 * and the branch are not remembered; the branch always follows the switcher.
 */
const lastSearch = new Map<string, string>();
const FORGET = ['drawer', 'branch', 'cursor', 'page', 'new', 'action', 'show', 'hand', 'dep'];

function remember(path: string, sp: URLSearchParams) {
  const keep = new URLSearchParams(sp);
  for (const k of FORGET) keep.delete(k);
  const q = keep.toString();
  if (q) lastSearch.set(path, q);
  else lastSearch.delete(path);
}

/** A tab's link: its path with the filters it was left with. */
export function lastTabHref(path: string): string {
  const q = lastSearch.get(path);
  return q ? `${path}/?${q}` : `${path === '/' ? '' : path}/`;
}

function withBranch(href: string, branch: string | null) {
  if (!branch) return href;
  return `${href}${href.includes('?') ? '&' : '?'}branch=${branch}`;
}

/**
 * The tab strip of a sidebar section, above the page. Tabs are links (each tab is a page with its own URL), so this is
 * a `nav` with `aria-current="page"`, not an ARIA tablist. Shown only on a tab itself, not on pages below it (a
 * customer's page has its own tabs). Scrolls sideways on a phone with the open tab in view.
 */
export function SectionTabs() {
  const { t } = useTranslation('shell');
  const gate = useGate();
  const pathname = usePathname();
  const sp = useSearchParams();
  const hit = sectionForPath(pathname, gate);
  const activePath = hit?.exact ? hit.active.path : null;
  const listRef = useRef<HTMLUListElement>(null);
  // the strip first renders when flags and permissions are in, so scroll again when the set of tabs changes
  const tabsKey = hit?.exact ? hit.nav.tabs.map((r) => r.path).join() : '';

  useEffect(() => {
    if (activePath) remember(activePath, new URLSearchParams(sp.toString()));
  }, [activePath, sp]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[aria-current=page]');
    if (!list || !el) return;
    const l = el.offsetLeft - list.offsetLeft;
    if (l < list.scrollLeft || l + el.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = l - 16;
  }, [activePath, tabsKey]);

  // Fade only the side that has more tabs to scroll to, so the first and last tab are never half hidden.
  const [more, setMore] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const l = listRef.current;
    if (!l) return;
    const start = l.scrollLeft > 2;
    const end = l.scrollLeft + l.clientWidth < l.scrollWidth - 2;
    setMore((m) => (m.start === start && m.end === end ? m : { start, end }));
  }, []);
  useEffect(() => {
    const l = listRef.current;
    if (!l) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(l);
    return () => ro.disconnect();
  }, [measure, tabsKey]);

  if (!hit || !hit.exact || hit.nav.tabs.length < 2) return null;
  const branch = sp.get('branch');
  const section = t(hit.nav.section.title.replace(/^shell:/, ''));
  return (
    <nav aria-label={t('sections.tabs', { section })} data-testid="section-tabs" className="mx-auto w-full max-w-[1600px] pt-2 print:hidden">
      <ul
        ref={listRef}
        onScroll={measure}
        data-more-start={more.start || undefined}
        data-more-end={more.end || undefined}
        className={cn(
          'scrollbar-thin flex gap-0.5 overflow-x-auto border-b border-line px-1.5 lg:px-3.5',
          more.start && more.end && '[mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]',
          more.start && !more.end && '[mask-image:linear-gradient(to_right,transparent,black_32px)]',
          !more.start && more.end && '[mask-image:linear-gradient(to_left,transparent,black_32px)]',
        )}
      >
        {hit.nav.tabs.map((r) => (
          // tab text lines up with the page content edge (16 px phone, 24 px desktop); the fade says more tabs scroll in
          <TabLink key={r.path} route={r} active={r.path === hit.active.path} href={withBranch(r.path === hit.active.path ? `${r.path}/` : lastTabHref(r.path), branch)} />
        ))}
      </ul>
    </nav>
  );
}

function TabLink({ route, active, href }: { route: NavRoute; active: boolean; href: string }) {
  const { t } = useTranslation();
  const [badge, probes] = useBadgeSum(route.useBadge ? [route] : []);
  const Icon = route.icon;
  return (
    <li className="shrink-0">
      {probes}
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative inline-flex h-10 items-center gap-2 rounded-t-sm px-2.5 text-sm whitespace-nowrap transition-colors duration-[var(--dur-fast)] [@media(pointer:coarse)]:h-11',
          'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
          active ? 'font-semibold text-primary after:bg-primary' : 'font-medium text-fg-secondary hover:bg-surface-hover hover:text-fg',
        )}
      >
        {Icon && <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-fg-tertiary')} aria-hidden />}
        {t(route.title)}
        {badge ? <span className="tabular rounded-full bg-danger-bg px-1.5 text-xs leading-5 font-semibold text-danger ring-1 ring-danger/15 ring-inset">{formatNumber(badge > 99 ? 99 : badge)}</span> : null}
      </Link>
    </li>
  );
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
