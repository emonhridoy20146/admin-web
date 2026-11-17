import { CalendarCheck, CalendarDays, Umbrella } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { usePendingLeaveBadge } from './api/leave';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** Attendance (FR-ATT), leave approvals (FR-ATT-008) and the work calendar: holidays and shifts (FR-SET-002/003). */
export const attendanceManifest: FeatureManifest = {
  name: 'attendance',
  flag: 'module.attendance',
  routes: [
    { path: '/attendance', title: 'attendance:title', permission: 'attendance.view', navGroup: 'field', icon: CalendarCheck, order: 70 },
    { path: '/attendance/leave', title: 'attendance:leave.title', permission: 'attendance.manage', navGroup: 'field', icon: Umbrella, order: 71, useBadge: usePendingLeaveBadge },
    { path: '/attendance/calendar', title: 'attendance:calendar.title', permission: 'attendance.view', navGroup: 'admin', icon: CalendarDays, order: 32 },
  ],
  permissions: ['attendance.view', 'attendance.manage', 'settings.manage'],
  commands: [
    { id: 'attendance.open', title: 'attendance:title', icon: CalendarCheck, href: '/attendance/', permission: 'attendance.view' },
    { id: 'attendance.leave', title: 'attendance:leave.title', icon: Umbrella, href: '/attendance/leave/', permission: 'attendance.manage', keywords: ['leave', 'ছুটি'] },
    { id: 'attendance.calendar', title: 'attendance:calendar.title', icon: CalendarDays, href: '/attendance/calendar/', permission: 'attendance.view', keywords: ['holiday', 'shift', 'ছুটির দিন', 'শিফট'] },
  ],
  messages: { bn, en },
};
