import { MapPinned } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const assignmentsManifest: FeatureManifest = {
  name: 'assignments',
  flag: 'module.assignments',
  routes: [{ path: '/areas', title: 'assignments:title', permission: 'assignment.view', navGroup: 'people', icon: MapPinned, order: 40 }],
  permissions: ['assignment.view', 'assignment.manage'],
  events: { emits: [EV.assignmentChanged], listens: [EV.handoverChanged] },
  commands: [{ id: 'assignments.open', title: 'assignments:title', icon: MapPinned, href: '/areas/', permission: 'assignment.view' }],
  messages: { bn, en },
};
