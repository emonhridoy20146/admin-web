import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import { emit, EV } from '@/shared/feature/events';
import type { components } from '@/shared/api/schema';

export type Area = components['schemas']['Area'];
export type Assignment = components['schemas']['Assignment'];
export type User = components['schemas']['User'];

export function useAreas() {
  const branchId = useBranchId();
  return useQuery({ queryKey: ['assignments', 'areas', branchId], queryFn: () => unwrap(api.GET('/areas', { params: { query: { branchId } } })), staleTime: 60_000 });
}

/** Active assignments: gives the assignment id needed to end one (Area.assignees only has user ids). */
export function useAssignments() {
  const branchId = useBranchId();
  return useQuery({ queryKey: ['assignments', 'active', branchId], queryFn: () => unwrap(api.GET('/assignments', { params: { query: { branchId, active: true } } })), staleTime: 60_000 });
}

export function useStaff() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['assignments', 'staff', branchId],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId, role: 'field_staff', active: true, limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}

function useDone() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['assignments'] });
    emit(EV.assignmentChanged);
  };
}

export function useAssignArea() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ userId, areaId, reason }: { userId: string; areaId: string; reason?: string }) => unwrap(api.POST('/assignments', { body: { userId, type: 'area', areaId, reason } })),
    onSuccess: done,
  });
}

export function useEndAssignment() {
  const done = useDone();
  return useMutation({ mutationFn: (id: string) => unwrap(api.DELETE('/assignments/{id}', { params: { path: { id } } })), onSuccess: done });
}

export function useSaveArea() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ id, version, body }: { id?: string; version?: number; body: Area }) =>
      id
        ? unwrap(api.PATCH('/areas/{id}', { params: { path: { id }, header: version != null ? { 'If-Match': `"${version}"` } : {} }, body }))
        : unwrap(api.POST('/areas', { body })),
    onSuccess: done,
  });
}

/** FR-ASG: give many customers to one staff member in one call (at most 1000 ids). */
export function useBulkAssign() {
  const done = useDone();
  return useMutation({
    mutationFn: (v: { userId: string; customerIds: string[]; reason?: string }) => unwrap(api.POST('/assignments/bulk', { body: v })),
    onSuccess: done,
  });
}

export const BULK_MAX = 1000;

/** Field staff of one branch (the customer's), for assigning one customer. */
export function useStaffOf(branchId: string | null | undefined) {
  return useQuery({
    queryKey: ['assignments', 'staff', branchId ?? 'all'],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId: branchId ?? undefined, role: 'field_staff', active: true, limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}

/** The active direct (customer) assignment of one customer, if any: tells "assigned directly" from "through an area". */
export function useCustomerAssignment(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ['assignments', 'customer', customerId],
    queryFn: async () => (await unwrap(api.GET('/assignments', { params: { query: { customerId: customerId!, active: true } } }))).find((a) => a.type === 'customer' && a.customerId === customerId) ?? null,
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

/** FR-ASG-002: give one customer to one staff member (a direct assignment beats the area's). */
export function useAssignCustomer() {
  const done = useDone();
  return useMutation({
    mutationFn: ({ userId, customerId, reason }: { userId: string; customerId: string; reason?: string }) => unwrap(api.POST('/assignments', { body: { userId, type: 'customer', customerId, reason } })),
    onSuccess: done,
  });
}
