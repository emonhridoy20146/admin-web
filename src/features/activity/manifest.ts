import { Activity } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useActivityBadge } from './api/activity';

/** FR-W-046: the staff activity feed (field-api module `activity`, contract 1.28.0) with its own bell in the header. */
export const activityManifest: FeatureManifest = {
  name: 'activity',
  flag: 'module.activity',
  routes: [{ path: '/activity', title: 'activity:title', permission: 'activity.view', navGroup: 'top', icon: Activity, order: 3, useBadge: useActivityBadge, bell: { icon: Activity, label: 'activity:bell', order: 2 } }],
  permissions: ['activity.view'],
  commands: [{ id: 'activity.open', title: 'activity:title', icon: Activity, href: '/activity/', permission: 'activity.view', keywords: ['activity', 'feed', 'কাজ', 'ফিড'] }],
  messages: { bn, en },
};
