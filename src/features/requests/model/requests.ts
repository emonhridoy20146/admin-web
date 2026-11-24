import type { Request, RequestQuery, RequestStatus } from '../api/requests';

/**
 * FR-W-070 (master FR-REQ-001..006, contract 1.48.0, ADR-066). Queue tabs of the requests inbox:
 * - `mine`: what waits for me. A super admin's queue (request.important.manage), else the area manager queue
 *   (request.manage), else — for someone who works no queue — the requests they sent.
 * - `area_manager` / `super_admin`: the queue a request waits in now.
 * - `assigned`: given to me (`assigneeId=me`).
 * - `all`: everything in scope.
 */
export const QUEUES = ['mine', 'area_manager', 'super_admin', 'assigned', 'all'] as const;
export type QueueTab = (typeof QUEUES)[number];

/** Not resolved and not closed: what still needs someone. The default status filter. */
export const ACTIVE: RequestStatus[] = ['open', 'in_progress', 'forwarded', 'reopened'];
export const STATUSES: RequestStatus[] = ['open', 'in_progress', 'forwarded', 'reopened', 'resolved', 'closed'];
/** Status filter values of the page: `active` (default), one status, or `any`. */
export const STATUS_FILTERS = ['active', ...STATUSES, 'any'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface Me {
  id: string;
  canManage: boolean;
  canImportant: boolean;
}

/** The queue my role works, or null when I work none. */
export function myQueue(me: Me): 'super_admin' | 'area_manager' | null {
  return me.canImportant ? 'super_admin' : me.canManage ? 'area_manager' : null;
}

export function queueQuery(tab: QueueTab, me: Me): Partial<RequestQuery> {
  switch (tab) {
    case 'mine': {
      const q = myQueue(me);
      return q ? { queue: q } : { createdBy: me.id };
    }
    case 'area_manager':
    case 'super_admin':
      return { queue: tab };
    case 'assigned':
      return { assigneeId: 'me' };
    default:
      return {};
  }
}

export function statusQuery(s: StatusFilter): RequestStatus[] | undefined {
  if (s === 'any') return undefined;
  if (s === 'active') return ACTIVE;
  return [s];
}

export const isFinished = (r: Pick<Request, 'status'>) => r.status === 'resolved' || r.status === 'closed';

/** Who may do what (the server decides; the UI only hides). A super-admin-level request needs request.important.manage. */
export function actionsFor(r: Request, me: Me): { forward: boolean; assign: boolean; resolve: boolean; reopen: boolean; close: boolean; comment: boolean } {
  const atLevel = r.level === 'super_admin' ? me.canImportant : me.canManage || me.canImportant;
  const creator = r.createdBy.id === me.id;
  const assignee = r.assignee?.id === me.id;
  const finished = isFinished(r);
  return {
    forward: atLevel && !finished,
    assign: atLevel && !finished,
    resolve: (atLevel || assignee) && !finished,
    reopen: (atLevel || creator) && finished,
    close: (atLevel || creator) && r.status !== 'closed',
    comment: r.status !== 'closed',
  };
}

/** Where a request is now, for the list and the drawer: a queue, or a person. */
export function whereNow(r: Pick<Request, 'currentQueue' | 'assignee'>): { kind: 'queue'; queue: 'area_manager' | 'super_admin' } | { kind: 'person'; name: string } {
  if (r.currentQueue === 'assignee' && r.assignee) return { kind: 'person', name: r.assignee.name };
  return { kind: 'queue', queue: r.currentQueue === 'super_admin' ? 'super_admin' : 'area_manager' };
}

/** A due date picked in the form (Asia/Dhaka day) as the end of that day, which is what "due on" means. */
export function dueAtOf(day: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  return new Date(Date.parse(`${day}T23:59:59+06:00`)).toISOString();
}

export interface CreateForm {
  type: 'request' | 'report' | 'inform' | 'complaint';
  priority: 'normal' | 'important';
  title: string;
  body: string;
  customerId: string;
  customerName: string;
  due: string;
  branchId: string;
}

export type CreateErrors = Partial<Record<'title' | 'body' | 'branchId', string>>;

export function validateCreate(v: CreateForm): CreateErrors {
  const e: CreateErrors = {};
  if (!v.title.trim()) e.title = 'form.errors.title';
  else if (v.title.trim().length > 160) e.title = 'form.errors.titleLong';
  if (!v.body.trim()) e.body = 'form.errors.body';
  else if (v.body.trim().length > 4000) e.body = 'form.errors.bodyLong';
  if (!v.branchId) e.branchId = 'form.errors.branch';
  return e;
}
