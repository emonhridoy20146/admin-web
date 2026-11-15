import { ScrollText } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** Core feature: no module flag (04-architecture §2). FR-AUD-003. */
export const auditManifest: FeatureManifest = {
  name: 'audit',
  routes: [{ path: '/admin/audit', title: 'audit:title', permission: 'audit.view', navGroup: 'admin', icon: ScrollText, order: 50 }],
  permissions: ['audit.view'],
  commands: [{ id: 'audit.open', title: 'audit:title', icon: ScrollText, href: '/admin/audit/', permission: 'audit.view' }],
  messages: { bn, en },
};
