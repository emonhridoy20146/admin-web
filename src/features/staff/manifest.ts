import { UsersRound } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const staffManifest: FeatureManifest = {
  name: 'staff',
  flag: 'module.reports',
  routes: [{ path: '/staff', title: 'staff:title', permission: 'report.view', navGroup: 'field', icon: UsersRound, order: 65 }],
  permissions: ['report.view', 'assignment.view', 'visit.view', 'collection.view', 'attendance.view'],
  commands: [{ id: 'staff.open', title: 'staff:title', icon: UsersRound, href: '/staff/', permission: 'report.view' }],
  messages: { bn, en },
};
