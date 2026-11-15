/**
 * The ONLY feature list (CLAUDE.md §2.3). Adding a feature = add its manifest here + thin route files.
 * Order here is the default order of dashboard widgets/tabs when they share an `order` value.
 */
import { registerFeatures } from '@/shared/feature/registry';
import type { FeatureManifest } from '@/shared/feature/types';
import { authManifest } from '@/features/auth';
import { shellManifest } from '@/features/shell';
import { dashboardManifest } from '@/features/dashboard';
import { inboxManifest } from '@/features/inbox';
import { customersManifest } from '@/features/customers';

export const features: FeatureManifest[] = [authManifest, shellManifest, dashboardManifest, inboxManifest, customersManifest];

registerFeatures(features);

export const messages = Object.fromEntries(features.map((f) => [f.name, f.messages]));
