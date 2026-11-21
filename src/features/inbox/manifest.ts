import { Bell, Inbox } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useInboxBadge } from './api/inbox';
import { InboxWidget } from './components/inbox-widget';

export const inboxManifest: FeatureManifest = {
  name: 'inbox',
  flag: 'module.inbox',
  routes: [{ path: '/inbox', title: 'inbox:title', permission: 'inbox.view', navGroup: 'top', icon: Inbox, order: 2, useBadge: useInboxBadge, bell: { icon: Bell, label: 'bell', order: 1 } }],
  permissions: ['inbox.view'],
  events: { emits: [EV.inboxChanged], listens: [EV.collectionResolved, EV.depositDecided, EV.customerTagged] },
  commands: [{ id: 'inbox.open', title: 'inbox:title', icon: Inbox, href: '/inbox/', permission: 'inbox.view' }],
  widgets: { dashboard: [{ id: 'inbox.preview', order: 20, span: 6, permission: 'inbox.view', component: InboxWidget }] },
  messages: { bn, en },
};
