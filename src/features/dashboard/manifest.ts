import { LayoutDashboard } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const dashboardManifest: FeatureManifest = {
  name: 'dashboard',
  flag: 'module.dashboard',
  routes: [{ path: '/', title: 'dashboard:title', permission: 'report.view', navGroup: 'top', icon: LayoutDashboard, order: 1 }],
  permissions: ['report.view'],
  events: { listens: [EV.collectionResolved, EV.depositDecided, EV.customerTagged] },
  messages: { bn, en },
};
