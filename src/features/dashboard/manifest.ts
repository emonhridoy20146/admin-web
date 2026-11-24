import { LayoutDashboard } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const dashboardManifest: FeatureManifest = {
  name: 'dashboard',
  // field-api has no `module.dashboard`: GET /dashboard/overview belongs to the reports module (`module.reports`,
  // "Dashboard and reports"). Gating on a key the server never sends kept the dashboard hidden on live.
  flag: 'module.reports',
  routes: [{ path: '/', title: 'dashboard:title', permission: 'report.view', navGroup: 'top', icon: LayoutDashboard, order: 1 }],
  permissions: ['report.view', 'flag.manage', 'customer.location.approve', 'prospect.view'],
  events: { listens: [EV.collectionResolved, EV.customerTagged] },
  messages: { bn, en },
};
