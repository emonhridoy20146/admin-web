import { Activity } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** Core admin feature: no module flag (04-architecture §2). */
export const systemManifest: FeatureManifest = {
  name: 'system',
  routes: [{ path: '/admin/system', title: 'system:title', permission: 'settings.manage', navGroup: 'admin', icon: Activity, order: 45 }],
  permissions: ['settings.manage'],
  commands: [{ id: 'system.open', title: 'system:title', icon: Activity, href: '/admin/system/', permission: 'settings.manage' }],
  messages: { bn, en },
};
