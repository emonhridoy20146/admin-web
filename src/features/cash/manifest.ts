import { Banknote } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const cashManifest: FeatureManifest = {
  name: 'cash',
  flag: 'module.cash',
  routes: [
    {
      path: '/cash',
      title: 'cash:title',
      permission: 'cash.view',
      navGroup: 'field',
      icon: Banknote,
      order: 30,
      // 1.35.0 (ADR-049): deposits are final, nothing waits for the office, so the entry has no count badge
    },
  ],
  permissions: ['cash.view', 'cash.limit.manage'],
  events: { listens: [EV.collectionVoided, EV.collectionResolved] },
  commands: [
    { id: 'cash.open', title: 'cash:title', icon: Banknote, href: '/cash/', permission: 'cash.view' },
  ],
  messages: { bn, en },
};
