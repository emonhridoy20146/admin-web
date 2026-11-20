import { Map as MapIcon, MapPinned, Users } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useProposals } from './api/customers';

/** Nav badge: pin proposals waiting for a decision. */
function usePendingPins(): number | undefined {
  return useProposals('pending').data?.length || undefined;
}

export const customersManifest: FeatureManifest = {
  name: 'customers',
  flag: 'module.customers',
  routes: [
    { path: '/customers', title: 'customers:title', permission: 'customer.view', navGroup: 'field', icon: Users, order: 10 },
    { path: '/customers/view', title: 'customers:title', permission: 'customer.view', hidden: true },
    { path: '/map', title: 'customers:map.title', permission: 'customer.view', navGroup: 'field', icon: MapIcon, order: 11 },
    { path: '/pin-approvals', title: 'customers:pins.title', permission: 'customer.location.approve', navGroup: 'field', icon: MapPinned, order: 12, useBadge: usePendingPins },
  ],
  permissions: ['customer.view', 'customer.export', 'customer.location.approve', 'customer.phone.manage', 'assignment.manage'],
  events: { listens: [EV.customerTagged, EV.collectionResolved, EV.assignmentChanged] },
  commands: [
    { id: 'customers.map', title: 'customers:map.title', icon: MapIcon, href: '/map/', permission: 'customer.view' },
    { id: 'customers.pins', title: 'customers:pins.title', icon: MapPinned, href: '/pin-approvals/', permission: 'customer.location.approve' },
  ],
  messages: { bn, en },
};
