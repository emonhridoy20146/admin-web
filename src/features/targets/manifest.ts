import { Target } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** FR-COL-015: daily collection and visit targets per field staff member (branch default + personal). */
export const targetsManifest: FeatureManifest = {
  name: 'targets',
  flag: 'module.targets',
  routes: [{ path: '/targets', title: 'targets:title', permission: 'target.view', navGroup: 'people', icon: Target, order: 30 }],
  permissions: ['target.view', 'target.manage'],
  events: { emits: ['target.changed'] },
  commands: [{ id: 'targets.open', title: 'targets:title', icon: Target, href: '/targets/', permission: 'target.view' }],
  messages: { bn, en },
};
