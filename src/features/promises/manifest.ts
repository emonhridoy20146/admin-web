import { Handshake } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import { CustomerPromisesTab } from './components/customer-promises-tab';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const promisesManifest: FeatureManifest = {
  name: 'promises',
  flag: 'module.promises',
  routes: [{ path: '/promises', title: 'promises:title', permission: 'promise.view', navGroup: 'field', icon: Handshake, order: 40 }],
  permissions: ['promise.view', 'promise.create'],
  events: { emits: [EV.promiseChanged], listens: [] },
  commands: [{ id: 'promises.open', title: 'promises:title', icon: Handshake, href: '/promises/', permission: 'promise.view' }],
  // FR-PRM-006: the customer's promise chains on the customer page
  widgets: { customerDetailTabs: [{ id: 'promises', title: 'promises:chain.tab', order: 20, permission: 'promise.view', component: CustomerPromisesTab }] },
  messages: { bn, en },
};
