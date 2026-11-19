import { addDays } from '@/shared/lib/time';
import type { Task, TaskCreate, TaskEdit, TaskStatus } from '../api/tasks';

export const TITLE_MAX = 120;
export const NOTE_MAX = 2000;
export const REASON_MIN = 5;

/** The tabs of the list: the four states, and "late" (unfinished past the due date). */
export const TABS = ['open', 'resolve_requested', 'overdue', 'resolved', 'cancelled'] as const;
export type Tab = (typeof TABS)[number];

/** `overdue` is not a state; it narrows to unfinished tasks past their due date (query `overdue=true`). */
export function tabQuery(tab: Tab): { status?: TaskStatus; overdue?: boolean } {
  return tab === 'overdue' ? { overdue: true } : { status: tab };
}

export interface TaskForm {
  branchId: string;
  assigneeId: string;
  title: string;
  note: string;
  dueDate: string;
}

export const emptyTask = (branchId = ''): TaskForm => ({ branchId, assigneeId: '', title: '', note: '', dueDate: '' });

export const formOf = (t: Task): TaskForm => ({ branchId: t.branchId, assigneeId: t.assignee.id, title: t.title, note: t.note ?? '', dueDate: t.dueDate ?? '' });

/** Returns i18n keys (namespace tasks) per field. `today` is the Dhaka date. */
export function validateTask(v: TaskForm, today: string, editing = false): Partial<Record<keyof TaskForm, string>> {
  const e: Partial<Record<keyof TaskForm, string>> = {};
  if (!editing && !v.branchId) e.branchId = 'errors.required';
  if (!editing && !v.assigneeId) e.assigneeId = 'errors.required';
  if (!v.title.trim()) e.title = 'errors.required';
  else if (v.title.trim().length > TITLE_MAX) e.title = 'errors.tooLong';
  if (v.note.trim().length > NOTE_MAX) e.note = 'errors.tooLong';
  if (v.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.dueDate)) e.dueDate = 'errors.badDate';
  else if (v.dueDate && v.dueDate < today) e.dueDate = 'errors.past';
  return e;
}

export function toCreate(v: TaskForm, clientId: string): TaskCreate {
  return {
    clientId,
    assigneeId: v.assigneeId,
    branchId: v.branchId,
    title: v.title.trim(),
    ...(v.note.trim() ? { note: v.note.trim() } : {}),
    ...(v.dueDate ? { dueDate: v.dueDate } : {}),
  };
}

/** Only what changed, so an edit never overwrites a field the form did not touch. */
export function toEdit(v: TaskForm, t: Task): TaskEdit {
  const out: TaskEdit = {};
  if (v.title.trim() !== t.title) out.title = v.title.trim();
  if ((v.note.trim() || null) !== (t.note ?? null)) out.note = v.note.trim() || null;
  if ((v.dueDate || null) !== (t.dueDate ?? null)) out.dueDate = v.dueDate || null;
  return out;
}

/** What an admin can do with a task in each state (FR-TASK-003). The server enforces the same table. */
export function actionsFor(status: TaskStatus): { edit: boolean; verify: boolean; reject: boolean; cancel: boolean } {
  return {
    edit: status === 'open',
    verify: status === 'resolve_requested',
    reject: status === 'resolve_requested',
    cancel: status === 'open' || status === 'resolve_requested',
  };
}

/** How the due date reads: late, today, later or none. Dates are Dhaka calendar dates, so plain string compare is right. */
export type DueKind = 'none' | 'late' | 'today' | 'soon' | 'later';
export function dueKind(t: Pick<Task, 'dueDate' | 'status'>, today: string): DueKind {
  if (!t.dueDate) return 'none';
  if (t.status === 'resolved' || t.status === 'cancelled') return 'later';
  if (t.dueDate < today) return 'late';
  if (t.dueDate === today) return 'today';
  return t.dueDate <= addDays(today, 2) ? 'soon' : 'later';
}

/** Oldest first for the history list; the server already sends it in order, this keeps a merged list stable. */
export function history(t: Pick<Task, 'events'>) {
  return [...t.events].sort((a, b) => a.at.localeCompare(b.at));
}
