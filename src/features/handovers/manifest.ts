import { ArrowLeftRight, Plus } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useHandovers } from './api/handovers';

/** Nav badge: handovers still waiting for the receiver. */
function usePendingBadge(): number | undefined {
  return useHandovers().data?.filter((h) => h.status === 'pending_acceptance').length || undefined;
}

export const handoversManifest: FeatureManifest = {
  name: 'handovers',
  flag: 'module.handovers',
  routes: [{ path: '/handovers', title: 'handovers:title', permission: 'handover.create', navGroup: 'field', icon: ArrowLeftRight, order: 60, useBadge: usePendingBadge }],
  permissions: ['handover.create'],
  events: { emits: [EV.handoverChanged], listens: [] },
  commands: [
    { id: 'handovers.open', title: 'handovers:title', icon: ArrowLeftRight, href: '/handovers/', permission: 'handover.create' },
    { id: 'handovers.new', title: 'handovers:new', icon: Plus, href: '/handovers/?new=1', permission: 'handover.create' },
  ],
  messages: { bn, en },
};
