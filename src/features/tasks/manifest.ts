import { ClipboardList } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import { EV } from '@/shared/feature/events';
import bn from './i18n/bn.json';
import en from './i18n/en.json';
import { useTaskBadge } from './api/tasks';

/** FR-TASK-001..005: free-form tasks for field staff with a note; the staff member asks to resolve, the admin verifies (field-api ADR-036). */
export const tasksManifest: FeatureManifest = {
  name: 'tasks',
  flag: 'module.tasks',
  routes: [{ path: '/tasks', title: 'tasks:title', permission: 'task.view', navGroup: 'field', icon: ClipboardList, order: 54, useBadge: useTaskBadge }],
  permissions: ['task.view', 'task.manage'],
  events: { emits: [EV.taskChanged] },
  commands: [{ id: 'tasks.open', title: 'tasks:title', icon: ClipboardList, href: '/tasks/', permission: 'task.view', keywords: ['task', 'assign', 'কাজ'] }],
  messages: { bn, en },
};
