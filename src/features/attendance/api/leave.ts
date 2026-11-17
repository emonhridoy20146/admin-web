import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components, operations } from '@/shared/api/schema';

export type LeaveRequest = components['schemas']['LeaveRequest'];
export type LeaveStatus = NonNullable<LeaveRequest['status']>;
export type LeaveQuery = NonNullable<operations['listLeave']['parameters']['query']>;
export type Holiday = components['schemas']['Holiday'];
export type HolidayCreate = components['schemas']['HolidayCreate'];
export type Shift = components['schemas']['Shift'];

/** FR-ATT-008: leave requests of the branches in scope (attendance.manage), newest first, at most 300. */
export function useLeaveRequests(params: Omit<LeaveQuery, 'branchId'>) {
  const branchId = useBranchId();
  const query: LeaveQuery = { ...params, branchId };
  return useQuery({
    queryKey: ['attendance', 'leave', query],
    queryFn: async () => (await unwrap(api.GET('/leave-requests', { params: { query } }))).items ?? [],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Approve, or reject with a reason (≥ 5 characters). Not optimistic: the staff member is told at once. */
export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'approve' | 'reject'; reason?: string }) =>
      unwrap(api.POST('/leave-requests/{id}/decision', { params: { path: { id } }, body: { decision, ...(reason ? { reason } : {}) } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

/** FR-SET-002: holidays of one year, sorted by date (national and every branch's own). */
export function useHolidays(year: number) {
  return useQuery({
    queryKey: ['attendance', 'holidays', year],
    queryFn: () => unwrap(api.GET('/calendar/holidays', { params: { query: { year } } })),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: HolidayCreate) => unwrap(api.POST('/calendar/holidays', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/calendar/holidays/{id}', { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

/** FR-SET-003: work shifts (hours, weekly off, late grace, break limit). Also read by the user form. */
export function useShifts() {
  return useQuery({
    queryKey: ['attendance', 'shifts'],
    queryFn: () => unwrap(api.GET('/shifts')),
    staleTime: 5 * 60_000,
  });
}

export function useSaveShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Shift }) =>
      id ? unwrap(api.PATCH('/shifts/{id}', { params: { path: { id } }, body })) : unwrap(api.POST('/shifts', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attendance', 'shifts'] }),
  });
}

/** Nav badge: requests waiting for a decision in the selected branch. */
export function usePendingLeaveBadge(): number | undefined {
  const q = useLeaveRequests({ status: 'pending' });
  return q.data?.length || undefined;
}
