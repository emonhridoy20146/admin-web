import { Banknote } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useDeposits } from './api/cash';

/** Nav badge: deposits waiting for verification in the current branch. */
function usePendingDepositBadge(): number | undefined {
  return useDeposits('pending', undefined, 100).data?.items.length || undefined;
}

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
      useBadge: usePendingDepositBadge,
    },
  ],
  permissions: ['cash.view', 'cash.deposit.verify', 'cash.limit.manage'],
  events: { emits: [EV.depositDecided], listens: [EV.collectionVoided, EV.collectionResolved] },
  commands: [
    { id: 'cash.open', title: 'cash:title', icon: Banknote, href: '/cash/', permission: 'cash.view' },
  ],
  messages: { bn, en },
};
