import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { viaApiProxy } from '@/shared/api/config';
import { useBranchId } from '@/shared/lib/ui-store';
import type { components, operations } from '@/shared/api/schema';

export type AttendanceDay = components['schemas']['AttendanceDay'];
export type SummaryRow = components['schemas']['AttendanceSummaryRow'];
export type User = components['schemas']['User'];
export type AttendanceEvent = components['schemas']['AttendanceEvent'];
export type CorrectionBody = operations['attendanceCorrection']['requestBody']['content']['application/json'];

export function useDays(from: string, to: string) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['attendance', 'days', branchId, from, to],
    queryFn: () => unwrap(api.GET('/attendance/days', { params: { query: { branchId, from, to } } })),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useSummary(month: string) {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['attendance', 'summary', branchId, month],
    queryFn: async () => (await unwrap(api.GET('/attendance/summary', { params: { query: { branchId, month } } }))).items ?? [],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** Field staff of the branch: AttendanceDay carries only userId. */
export function useStaff() {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['attendance', 'staff', branchId],
    queryFn: async () => (await unwrap(api.GET('/users', { params: { query: { branchId, role: 'field_staff', active: true, limit: 100 } } }))).items ?? [],
    staleTime: 5 * 60_000,
  });
}

/** FR-ATT-006: a manager adds or replaces an event with a reason; the original stays in the audit log. */
export function useCorrect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CorrectionBody) => unwrap(api.POST('/attendance/corrections', { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

/** One staff member's raw events of a business date, oldest first, with photo, place and flags (contract 1.8.0). */
export function useEvents(userId: string | null, date: string) {
  return useQuery({
    queryKey: ['attendance', 'events', userId, date],
    queryFn: () => unwrap(api.GET('/attendance/events', { params: { query: { userId: userId!, date } } })),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** Short-lived presigned URL of an attendance photo. A face photo is personal data: never stored, never cached past its expiry. */
export function useSelfieUrl(id: string | null | undefined) {
  return useQuery({
    queryKey: ['attendance', 'selfie', id],
    queryFn: () => unwrap(api.GET('/media/{id}/url', { params: { path: { id: id! } } })).then((r) => ({ ...r, url: viaApiProxy(r.url) })),
    enabled: !!id,
    staleTime: 4 * 60_000,
    gcTime: 5 * 60_000,
  });
}
