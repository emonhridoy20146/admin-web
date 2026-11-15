import { SlidersHorizontal } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** Core admin feature: no module flag (04-architecture §2). FR-SET-001. */
export const adminSettingsManifest: FeatureManifest = {
  name: 'admin-settings',
  routes: [{ path: '/admin/settings', title: 'admin-settings:title', permission: 'settings.manage', navGroup: 'admin', icon: SlidersHorizontal, order: 30 }],
  permissions: ['settings.manage'],
  commands: [{ id: 'admin-settings.open', title: 'admin-settings:title', icon: SlidersHorizontal, href: '/admin/settings/', permission: 'settings.manage' }],
  messages: { bn, en },
};
