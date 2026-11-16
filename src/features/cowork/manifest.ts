import { Users } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** FR-CW-004: managers see who worked together, when, and the joint visits (ADR-029 in field-api). */
export const coworkManifest: FeatureManifest = {
  name: 'cowork',
  flag: 'module.cowork',
  routes: [{ path: '/cowork', title: 'cowork:title', permission: 'cowork.view', navGroup: 'field', icon: Users, order: 52 }],
  permissions: ['cowork.view'],
  commands: [{ id: 'cowork.open', title: 'cowork:title', icon: Users, href: '/cowork/', permission: 'cowork.view' }],
  messages: { bn, en },
};
