import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { components } from '../api/schema';

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
  widgets?: { dashboard?: WidgetDef[]; customerDetailTabs?: CustomerTabDef[] };
  /** i18n namespace = name */
  messages: { bn: Messages; en: Messages };
}
