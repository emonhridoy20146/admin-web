import { Megaphone } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** FR-NOT-005: notices to staff phones with "read" (পড়েছি) confirmation and who has not read (contract 1.12.0). */
export const noticesManifest: FeatureManifest = {
  name: 'notices',
  flag: 'module.notifications',
  routes: [{ path: '/notices', title: 'notices:title', permission: 'notification.broadcast', navGroup: 'top', icon: Megaphone, order: 3 }],
  permissions: ['notification.broadcast'],
  commands: [{ id: 'notices.open', title: 'notices:title', icon: Megaphone, href: '/notices/', permission: 'notification.broadcast', keywords: ['notice', 'broadcast', 'নোটিশ'] }],
  messages: { bn, en },
};
