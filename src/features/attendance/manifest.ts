import { CalendarCheck } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const attendanceManifest: FeatureManifest = {
  name: 'attendance',
  flag: 'module.attendance',
  routes: [{ path: '/attendance', title: 'attendance:title', permission: 'attendance.view', navGroup: 'field', icon: CalendarCheck, order: 70 }],
  permissions: ['attendance.view', 'attendance.manage'],
  commands: [{ id: 'attendance.open', title: 'attendance:title', icon: CalendarCheck, href: '/attendance/', permission: 'attendance.view' }],
  messages: { bn, en },
};
