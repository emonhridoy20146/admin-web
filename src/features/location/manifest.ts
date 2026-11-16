import { Navigation, Route } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const locationManifest: FeatureManifest = {
  name: 'location',
  flag: 'module.location',
  routes: [
    { path: '/live', title: 'location:live.title', permission: 'location.view', navGroup: 'field', icon: Navigation, order: 57 },
    { path: '/routes', title: 'location:routes.title', permission: 'location.history.view', navGroup: 'field', icon: Route, order: 58 },
  ],
  permissions: ['location.view', 'location.history.view'],
  commands: [
    { id: 'location.live', title: 'location:live.title', icon: Navigation, href: '/live/', permission: 'location.view' },
    { id: 'location.routes', title: 'location:routes.title', icon: Route, href: '/routes/', permission: 'location.history.view' },
  ],
  messages: { bn, en },
};
