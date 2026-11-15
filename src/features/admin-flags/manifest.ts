import { ToggleRight } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** Core admin feature: no module flag (04-architecture §2). */
export const adminFlagsManifest: FeatureManifest = {
  name: 'admin-flags',
  routes: [{ path: '/admin/flags', title: 'admin-flags:title', permission: 'flag.manage', navGroup: 'admin', icon: ToggleRight, order: 40 }],
  permissions: ['flag.manage'],
  events: { emits: [EV.flagsChanged] },
  commands: [{ id: 'admin-flags.open', title: 'admin-flags:title', icon: ToggleRight, href: '/admin/flags/', permission: 'flag.manage' }],
  messages: { bn, en },
};
