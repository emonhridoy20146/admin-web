import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { components } from '../api/schema';
import type { Bounds } from '../map/geo';
import type { MapMarker } from '../map/map-view';

export type NavGroup = 'top' | 'field' | 'people' | 'insights' | 'admin';

export interface FeatureRoute {
  path: string;
  /** i18n key, `<namespace>:<key>` */
  title: string;
  permission?: string;
  navGroup?: NavGroup;
  icon?: LucideIcon;
  order?: number;
  /** hook returning a nav badge count (e.g. inbox open count); must be a stable hook */
  useBadge?: () => number | undefined;
  /** also a bell in the header with the `useBadge` count (FR-W-046); `label` is an i18n key, `order` left to right */
  bell?: { icon: LucideIcon; label: string; order: number };
  /** hidden from nav (detail pages) */
  hidden?: boolean;
}

/**
 * A sidebar section (FR-W-069, ADR-W28): one sidebar item that groups related pages of one or more features as tabs.
 * Sections are the information architecture of the panel and are defined once, in `src/app/navigation.ts`; features
 * keep owning their routes. Each tab is the feature's own route (its own URL and query state), so old links keep
 * working. A route listed in no section shows as its own sidebar item, as before.
 */
export interface SectionDef {
  id: string;
  /** i18n key, `<namespace>:<key>` */
  title: string;
  icon: LucideIcon;
  group: NavGroup;
  order: number;
  /** route paths in tab order; the sidebar opens the first one the user may see */
  tabs: string[];
  /** tabs whose nav badges add up to the section's sidebar badge (default: every tab) */
  badgeFrom?: string[];
}

export interface CommandDef {
  id: string;
  title: string; // i18n key
  icon?: LucideIcon;
  href: string;
  permission?: string;
  keywords?: string[];
}

export interface WidgetDef {
  id: string;
  order: number;
  permission?: string;
  span?: 4 | 6 | 8 | 12;
  component: ComponentType;
}

export interface CustomerTabDef {
  id: string;
  title: string; // i18n key
  order: number;
  permission?: string;
  component: ComponentType<{ customerId: string; customer: components['schemas']['CustomerDetail'] }>;
  /** optional count shown on the tab */
  useCount?: (customerId: string) => number | undefined;
}

/**
 * A layer another feature draws on every map of the panel (e.g. map places, FR-PLC-001), through `useMapLayers`. The
 * layer is a component rendered by the map's page: it loads its own data for the view, hands its markers up (ids
 * prefixed `<layer id>:`) and shows its own drawer when one of its markers is open (`openId`, without the prefix).
 */
export interface MapLayerProps {
  bounds: Bounds | null;
  /** the map's zoom (null until the map has drawn); a layer decides what it shows at each zoom */
  zoom: number | null;
  onMarkers: (markers: MapMarker[]) => void;
  openId: string | null;
  onClose: () => void;
}

export interface MapLayerDef {
  id: string;
  title: string; // i18n key
  order: number;
  permission?: string;
  component: ComponentType<MapLayerProps>;
}

export type Messages = Record<string, unknown>;

export interface FeatureManifest {
  name: string;
  /** field-api flag key; feature hidden when OFF (default OFF) */
  flag?: `module.${string}`;
  routes: FeatureRoute[];
  /** keys the feature checks — must exist in the master catalog (pnpm check:permissions) */
  permissions: string[];
  events?: { emits?: string[]; listens?: string[] };
  commands?: CommandDef[];
  widgets?: { dashboard?: WidgetDef[]; customerDetailTabs?: CustomerTabDef[]; mapLayers?: MapLayerDef[] };
  /** i18n namespace = name */
  messages: { bn: Messages; en: Messages };
}
