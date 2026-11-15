import { Users } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const customersManifest: FeatureManifest = {
  name: 'customers',
  flag: 'module.customers',
  routes: [
    { path: '/customers', title: 'customers:title', permission: 'customer.view', navGroup: 'field', icon: Users, order: 10 },
    { path: '/customers/view', title: 'customers:title', permission: 'customer.view', hidden: true },
  ],
  permissions: ['customer.view', 'customer.export', 'customer.location.approve'],
  events: { listens: [EV.customerTagged, EV.collectionResolved] },
  messages: { bn, en },
};
