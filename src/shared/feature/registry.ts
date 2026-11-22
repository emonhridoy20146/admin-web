import type { FeatureManifest, FeatureRoute, CustomerTabDef, WidgetDef, CommandDef, MapLayerDef } from './types';

let manifests: FeatureManifest[] = [];

/** Called once by src/app/features.ts — the only feature list. */
export function registerFeatures(list: FeatureManifest[]) {
  const names = new Set<string>();
  for (const m of list) {
    if (names.has(m.name)) throw new Error(`Duplicate feature ${m.name}`);
    names.add(m.name);
  }
  manifests = list;
}

export function getFeatures(): FeatureManifest[] {
  return manifests;
}

export interface Gate {
  can: (key?: string) => boolean;
  flag: (key?: string) => boolean;
}

const enabled = (m: FeatureManifest, g: Gate) => g.flag(m.flag);

export function navRoutes(g: Gate): (FeatureRoute & { feature: string })[] {
  return manifests
    .filter((m) => enabled(m, g))
    .flatMap((m) => m.routes.map((r) => ({ ...r, feature: m.name })))
    .filter((r) => r.navGroup && !r.hidden && g.can(r.permission))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
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
