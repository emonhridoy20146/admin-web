import { ChartColumn } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const reportsManifest: FeatureManifest = {
  name: 'reports',
  flag: 'module.reports',
  routes: [{ path: '/reports', title: 'reports:title', permission: 'report.view', navGroup: 'field', icon: ChartColumn, order: 80 }],
  permissions: ['report.view', 'report.export', 'collection.view'],
  commands: [{ id: 'reports.open', title: 'reports:title', icon: ChartColumn, href: '/reports/', permission: 'report.view' }],
  messages: { bn, en },
};
