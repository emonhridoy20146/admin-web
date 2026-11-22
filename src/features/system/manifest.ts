import { Activity, Images } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { usePhotoPurgeBadge } from './api/photos';
import { PhotoPurgeWidget } from './components/photo-purge-widget';

/** Core admin feature: no module flag (04-architecture §2). */
export const systemManifest: FeatureManifest = {
  name: 'system',
  routes: [
    { path: '/admin/system', title: 'system:title', permission: 'settings.manage', navGroup: 'admin', icon: Activity, order: 45 },
    // FR-W-054 (master FR-MED-003): photo storage and deleting the previous months' photos; the count shows from the 5th
    { path: '/admin/photos', title: 'system:photos.title', permission: 'media.delete', navGroup: 'admin', icon: Images, order: 46, useBadge: usePhotoPurgeBadge },
  ],
  permissions: ['settings.manage', 'media.delete'],
  commands: [
    { id: 'system.open', title: 'system:title', icon: Activity, href: '/admin/system/', permission: 'settings.manage' },
    { id: 'system.photos', title: 'system:photos.title', icon: Images, href: '/admin/photos/', permission: 'media.delete', keywords: ['photo', 'image', 'cloudinary', 'ছবি'] },
  ],
  widgets: { dashboard: [{ id: 'system.photo-purge', order: 90, span: 6, permission: 'media.delete', component: PhotoPurgeWidget }] },
  messages: { bn, en },
};
