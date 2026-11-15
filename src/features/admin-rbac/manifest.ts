import { ShieldCheck } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** Core admin feature: no module flag (04-architecture §2). FR-W-009. */
export const adminRbacManifest: FeatureManifest = {
  name: 'admin-rbac',
  routes: [{ path: '/admin/permissions', title: 'admin-rbac:title', permission: 'rbac.view', navGroup: 'admin', icon: ShieldCheck, order: 20 }],
  permissions: ['rbac.view', 'rbac.manage'],
  events: { emits: [EV.permissionsChanged] },
  commands: [{ id: 'admin-rbac.open', title: 'admin-rbac:title', icon: ShieldCheck, href: '/admin/permissions/', permission: 'rbac.view' }],
  messages: { bn, en },
};
