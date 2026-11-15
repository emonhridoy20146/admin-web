import { MapPinCheck } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const visitsManifest: FeatureManifest = {
  name: 'visits',
  flag: 'module.visits',
  routes: [{ path: '/visits', title: 'visits:title', permission: 'visit.view', navGroup: 'field', icon: MapPinCheck, order: 50 }],
  permissions: ['visit.view'],
  commands: [{ id: 'visits.open', title: 'visits:title', icon: MapPinCheck, href: '/visits/', permission: 'visit.view' }],
  messages: { bn, en },
};
