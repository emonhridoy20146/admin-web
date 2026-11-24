import { MessagesSquare, Plus } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useRequestBadge } from './api/requests';

/**
 * FR-W-070 (master FR-REQ-001..006, contract 1.48.0, field-api ADR-066): requests, reports, information and complaints
 * from staff and the office, worked in an area manager queue and a super admin queue, with the whole timeline.
 */
export const requestsManifest: FeatureManifest = {
  name: 'requests',
  flag: 'module.requests',
  routes: [{ path: '/requests', title: 'requests:title', permission: 'request.view', navGroup: 'top', icon: MessagesSquare, order: 2.5, useBadge: useRequestBadge }],
  permissions: ['request.view', 'request.create', 'request.manage', 'request.important.manage'],
  events: { emits: [EV.requestChanged] },
  commands: [
    { id: 'requests.open', title: 'requests:title', icon: MessagesSquare, href: '/requests/', permission: 'request.view', keywords: ['request', 'ticket', 'complaint', 'report', 'অনুরোধ', 'অভিযোগ'] },
    { id: 'requests.new', title: 'requests:new', icon: Plus, href: '/requests/?new=1', permission: 'request.create', keywords: ['request', 'ticket', 'অনুরোধ'] },
  ],
  messages: { bn, en },
};
