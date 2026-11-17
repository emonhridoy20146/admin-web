import { ChartColumn, ShieldCheck, Trophy } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const reportsManifest: FeatureManifest = {
  name: 'reports',
  flag: 'module.reports',
  routes: [
    { path: '/reports', title: 'reports:title', permission: 'report.view', navGroup: 'field', icon: ChartColumn, order: 80 },
    { path: '/leaderboard', title: 'reports:lb.title', permission: 'report.view', navGroup: 'field', icon: Trophy, order: 67 },
    { path: '/data-quality', title: 'reports:dq.title', permission: 'report.view', navGroup: 'field', icon: ShieldCheck, order: 81 },
  ],
  permissions: ['report.view', 'report.export', 'collection.view', 'audit.view'],
  commands: [
    { id: 'reports.open', title: 'reports:title', icon: ChartColumn, href: '/reports/', permission: 'report.view' },
    { id: 'reports.leaderboard', title: 'reports:lb.title', icon: Trophy, href: '/leaderboard/', permission: 'report.view' },
    { id: 'reports.dataQuality', title: 'reports:dq.title', icon: ShieldCheck, href: '/data-quality/', permission: 'report.view' },
  ],
  messages: { bn, en },
};
