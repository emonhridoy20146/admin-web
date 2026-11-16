import { Smartphone } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useDevices } from './api/devices';
import { counts } from './model/device';

/** Nav badge: phones waiting for approval. */
function usePendingDevices(): number | undefined {
  return counts(useDevices().data).pending_approval || undefined;
}

export const adminDevicesManifest: FeatureManifest = {
  name: 'admin-devices',
  flag: 'module.devices',
  routes: [{ path: '/admin/devices', title: 'admin-devices:title', permission: 'device.manage', navGroup: 'admin', icon: Smartphone, order: 25, useBadge: usePendingDevices }],
  permissions: ['device.manage'],
  commands: [{ id: 'admin-devices.open', title: 'admin-devices:title', icon: Smartphone, href: '/admin/devices/', permission: 'device.manage' }],
  messages: { bn, en },
};
