import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { TagTab } from './components/tag-tab';

export const tagsManifest: FeatureManifest = {
  name: 'tags',
  flag: 'module.tags',
  routes: [],
  permissions: ['tag.view', 'tag.set', 'tag.approve'],
  events: { emits: [EV.customerTagged] },
  widgets: { customerDetailTabs: [{ id: 'tag', title: 'tags:tab', order: 10, permission: 'tag.view', component: TagTab }] },
  messages: { bn, en },
};
