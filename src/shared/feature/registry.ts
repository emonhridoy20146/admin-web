import type { FeatureManifest, FeatureRoute, CustomerTabDef, WidgetDef, CommandDef, MapLayerDef, NavGroup, SectionDef } from './types';

let manifests: FeatureManifest[] = [];
let sections: SectionDef[] = [];

/** Called once by src/app/features.ts — the only feature list. */
export function registerFeatures(list: FeatureManifest[]) {
  const names = new Set<string>();
  for (const m of list) {
    if (names.has(m.name)) throw new Error(`Duplicate feature ${m.name}`);
    names.add(m.name);
  }
  manifests = list;
}

/** Called once by src/app/navigation.ts — the only list of sidebar sections. Every tab must be a route of a feature. */
export function registerSections(list: SectionDef[]) {
  const paths = new Set(manifests.flatMap((m) => m.routes.map((r) => r.path)));
  const seen = new Set<string>();
  for (const s of list)
    for (const p of s.tabs) {
      if (!paths.has(p)) throw new Error(`Section ${s.id}: no feature has the route ${p}`);
      if (seen.has(p)) throw new Error(`Route ${p} is in two sections`);
      seen.add(p);
    }
  sections = list;
}

export function getFeatures(): FeatureManifest[] {
  return manifests;
}

export interface Gate {
  can: (key?: string) => boolean;
  flag: (key?: string) => boolean;
}

const enabled = (m: FeatureManifest, g: Gate) => g.flag(m.flag);

/** Every page in the nav, sections' tabs included (header bells and the ⌘K "go to" list use it). */
export function navRoutes(g: Gate): NavRoute[] {
  return manifests
    .filter((m) => enabled(m, g))
    .flatMap((m) => m.routes.map((r) => ({ ...r, feature: m.name })))
    .filter((r) => r.navGroup && !r.hidden && g.can(r.permission))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export type NavRoute = FeatureRoute & { feature: string };

/** A visible section with the tabs this user may open (flag on, permission held), in tab order. */
export interface NavSection {
  section: SectionDef;
  tabs: NavRoute[];
  /** where the sidebar item goes: the first visible tab */
  href: string;
}

export type NavEntry = { kind: 'route'; group: NavGroup; order: number; route: NavRoute } | { kind: 'section'; group: NavGroup; order: number; nav: NavSection };

function visibleTabs(s: SectionDef, g: Gate): NavRoute[] {
  const all = manifests.filter((m) => enabled(m, g)).flatMap((m) => m.routes.map((r) => ({ ...r, feature: m.name })));
  return s.tabs.map((p) => all.find((r) => r.path === p)).filter((r): r is NavRoute => !!r && !r.hidden && g.can(r.permission));
}

export function navSections(g: Gate): NavSection[] {
  return sections
    .map((section) => ({ section, tabs: visibleTabs(section, g) }))
    .filter((s) => s.tabs.length > 0)
    .map((s) => ({ ...s, href: s.tabs[0]!.path }));
}

/** The sidebar: sections, plus routes that belong to no section (each its own item), sorted by group and order. */
export function navEntries(g: Gate): NavEntry[] {
  const inSection = new Set(sections.flatMap((s) => s.tabs));
  const loose: NavEntry[] = navRoutes(g)
    .filter((r) => !inSection.has(r.path))
    .map((route) => ({ kind: 'route', group: route.navGroup!, order: route.order ?? 100, route }));
  const secs: NavEntry[] = navSections(g).map((nav) => ({ kind: 'section', group: nav.section.group, order: nav.section.order, nav }));
  return [...loose, ...secs].sort((a, b) => a.order - b.order);
}

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
const under = (pathname: string, path: string) => (path === '/' ? norm(pathname) === '/' : norm(pathname) === path || pathname.startsWith(path + '/'));

/**
 * The section a pathname belongs to and its active tab (longest matching tab path). `exact` is true when the page is the
 * tab itself (the tab strip shows), false for a page below it (a detail page: only the sidebar item is highlighted).
 */
export function sectionForPath(pathname: string, g: Gate): { nav: NavSection; active: NavRoute; exact: boolean } | null {
  for (const nav of navSections(g)) {
    const active = nav.tabs.filter((r) => under(pathname, r.path)).sort((a, b) => b.path.length - a.path.length)[0];
    if (active) return { nav, active, exact: norm(pathname) === active.path };
  }
  return null;
}

export function dashboardWidgets(g: Gate): WidgetDef[] {
  return manifests
    .filter((m) => enabled(m, g))
    .flatMap((m) => m.widgets?.dashboard ?? [])
    .filter((w) => g.can(w.permission))
    .sort((a, b) => a.order - b.order);
}

export function customerTabs(g: Gate): CustomerTabDef[] {
  return manifests
    .filter((m) => enabled(m, g))
    .flatMap((m) => m.widgets?.customerDetailTabs ?? [])
    .filter((t) => g.can(t.permission))
    .sort((a, b) => a.order - b.order);
}

export function mapLayers(g: Gate): MapLayerDef[] {
  return manifests
    .filter((m) => enabled(m, g))
    .flatMap((m) => m.widgets?.mapLayers ?? [])
    .filter((l) => g.can(l.permission))
    .sort((a, b) => a.order - b.order);
}

export function commands(g: Gate): CommandDef[] {
  return manifests
    .filter((m) => enabled(m, g))
    .flatMap((m) => m.commands ?? [])
    .filter((c) => g.can(c.permission));
}

/** Which feature owns a pathname (for the module-off page). Longest prefix wins. */
export function featureForPath(pathname: string): { manifest: FeatureManifest; route: FeatureRoute } | null {
  let best: { manifest: FeatureManifest; route: FeatureRoute } | null = null;
  for (const m of manifests)
    for (const r of m.routes) {
      const base = r.path.replace(/\/(\[.*|view)$/, '');
      const match = base === '/' ? pathname === '/' : pathname === base || pathname.startsWith(base + '/');
      if (match && (!best || base.length > best.route.path.length)) best = { manifest: m, route: r };
    }
  return best;
}
