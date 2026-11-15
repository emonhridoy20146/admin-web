import { UsersRound } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

/** Core admin feature: no module flag (04-architecture §2). */
export const adminUsersManifest: FeatureManifest = {
  name: 'admin-users',
  routes: [
    {
      path: '/admin/users',
      title: 'admin-users:title',
      permission: 'user.view',
      navGroup: 'admin',
      icon: UsersRound,
      order: 10,
    },
  ],
  permissions: ['user.view', 'user.manage', 'rbac.view'],
  commands: [
    {
      id: 'admin-users.open',
      title: 'admin-users:title',
      icon: UsersRound,
      href: '/admin/users/',
      permission: 'user.view',
    },
  ],
  messages: { bn, en },
};
