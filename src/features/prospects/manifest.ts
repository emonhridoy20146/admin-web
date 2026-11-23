import { UserRoundSearch } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** FR-PRO-001 (field-api 1.45.0): possible customers staff and the office record, followed up until converted or dropped. */
export const prospectsManifest: FeatureManifest = {
  name: 'prospects',
  flag: 'module.prospects',
  routes: [{ path: '/prospects', title: 'prospects:title', permission: 'prospect.view', navGroup: 'field', icon: UserRoundSearch, order: 15 }],
  permissions: ['prospect.view', 'prospect.manage', 'prospect.create'],
  events: { emits: [EV.prospectChanged] },
  commands: [{ id: 'prospects.open', title: 'prospects:title', icon: UserRoundSearch, href: '/prospects/', permission: 'prospect.view', keywords: ['prospect', 'lead', 'possible', 'সম্ভাব্য'] }],
  messages: { bn, en },
};
