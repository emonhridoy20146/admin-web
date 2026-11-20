import { GitMerge, Wallet } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useConflictBadge } from './api/collections';

export const collectionsManifest: FeatureManifest = {
  name: 'collections',
  flag: 'module.collections',
  routes: [
    {
      path: '/collections',
      title: 'collections:title',
      permission: 'collection.view',
      navGroup: 'field',
      icon: Wallet,
      order: 20,
    },
    {
      path: '/collections/conflicts',
      title: 'collections:conflicts',
      permission: 'collection.view',
      navGroup: 'field',
      icon: GitMerge,
      order: 21,
      useBadge: useConflictBadge,
    },
  ],
  permissions: ['collection.view', 'collection.record', 'collection.void', 'collection.resolve'],
  events: { emits: [EV.collectionResolved, EV.collectionVoided] },
  commands: [
    {
      id: 'collections.open',
      title: 'collections:title',
      icon: Wallet,
      href: '/collections/',
      permission: 'collection.view',
    },
    {
      id: 'collections.conflicts',
      title: 'collections:conflicts',
      icon: GitMerge,
      href: '/collections/conflicts/',
      permission: 'collection.view',
    },
  ],
  messages: { bn, en },
};
