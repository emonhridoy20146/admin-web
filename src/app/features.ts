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
import { tagsManifest } from '@/features/tags';
import { collectionsManifest } from '@/features/collections';
import { cashManifest } from '@/features/cash';
import { adminUsersManifest } from '@/features/admin-users';
import { adminRbacManifest } from '@/features/admin-rbac';
import { adminFlagsManifest } from '@/features/admin-flags';
import { adminSettingsManifest } from '@/features/admin-settings';
import { auditManifest } from '@/features/audit';
import { handoversManifest } from '@/features/handovers';
import { promisesManifest } from '@/features/promises';
import { visitsManifest } from '@/features/visits';
import { attendanceManifest } from '@/features/attendance';

export const features: FeatureManifest[] = [authManifest, shellManifest, dashboardManifest, inboxManifest, customersManifest, tagsManifest, collectionsManifest, cashManifest, promisesManifest, visitsManifest, handoversManifest, attendanceManifest, adminUsersManifest, adminRbacManifest, adminSettingsManifest, adminFlagsManifest, auditManifest];

registerFeatures(features);

export const messages = Object.fromEntries(features.map((f) => [f.name, f.messages]));
