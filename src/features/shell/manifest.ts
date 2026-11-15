import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const shellManifest: FeatureManifest = { name: 'shell', routes: [], permissions: ['branch.view'], messages: { bn, en } };
