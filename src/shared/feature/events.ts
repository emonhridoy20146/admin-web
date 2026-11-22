import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/** UI event bus: features announce changes; others invalidate their own queries (04 §4). */
type Handler = (payload?: unknown) => void;
const handlers = new Map<string, Set<Handler>>();

export function emit(event: string, payload?: unknown) {
  handlers.get(event)?.forEach((h) => h(payload));
}

export function on(event: string, h: Handler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(h);
  return () => handlers.get(event)!.delete(h);
}

/** Invalidate this feature's queries when another feature announces a change. */
export function useInvalidateOn(events: string[], keys: QueryKey[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const offs = events.map((e) => on(e, () => keys.forEach((k) => void qc.invalidateQueries({ queryKey: k }))));
    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, events.join(','), JSON.stringify(keys)]);
}

/** Shared event names (string contract between features). */
export const EV = {
  collectionResolved: 'collection.resolved',
  collectionVoided: 'collection.voided',
  customerTagged: 'customer.tagged',
  inboxChanged: 'inbox.changed',
  permissionsChanged: 'rbac.changed',
  flagsChanged: 'flags.changed',
  handoverChanged: 'handover.changed',
  promiseChanged: 'promise.changed',
  assignmentChanged: 'assignment.changed',
  targetChanged: 'target.changed',
  taskChanged: 'task.changed',
  collectionCreated: 'collection.created',
  promiseCreated: 'promise.created',
  visitCreated: 'visit.created',
  branchChanged: 'branch.changed',
} as const;
