import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const authManifest: FeatureManifest = {
  name: 'auth',
  routes: [
    { path: '/login', title: 'auth:title', hidden: true },
    { path: '/change-password', title: 'auth:changeTitle', hidden: true },
  ],
  permissions: [],
  messages: { bn, en },
};
