import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { listOrItems } from '@/shared/api/list';
import { useBranchId } from '@/shared/lib/ui-store';
import { EV, useInvalidateOn } from '@/shared/feature/events';
import type { components, operations } from '@/shared/api/schema';

export type CustomerListItem = components['schemas']['CustomerListItem'];
export type CustomerDetail = components['schemas']['CustomerDetail'];
export type ContactAttempt = components['schemas']['ContactAttempt'];
export type CustomerQuery = NonNullable<operations['listCustomers']['parameters']['query']>;

export function useCustomers(params: Omit<CustomerQuery, 'branchId'>) {
  const branchId = useBranchId();
  useInvalidateOn([EV.customerTagged, EV.collectionResolved, EV.assignmentChanged], [['customers']]);
  // includeTotal: the "total customers" number in the header and the pager (field-api caps it at 10,000)
  const query: CustomerQuery = { ...params, branchId, includeTotal: true };
  return useQuery({
    queryKey: ['customers', 'list', query],
    queryFn: () => unwrap(api.GET('/customers', { params: { query } })),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useCustomer(id: string | null | undefined) {
  useInvalidateOn([EV.customerTagged, EV.collectionResolved, EV.assignmentChanged], [['customers', 'detail'], ['customers', 'timeline']]);
  return useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => unwrap(api.GET('/customers/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useTimeline(id: string) {
  return useInfiniteQuery({
    queryKey: ['customers', 'timeline', id],
    queryFn: ({ pageParam }) => unwrap(api.GET('/customers/{id}/timeline', { params: { path: { id }, query: { limit: 20, cursor: pageParam || undefined } } })),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** FR-ERP-005 manual refresh of one customer from the ERP. */
export function useRefreshCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/customers/{id}/refresh', { params: { path: { id } } })),
    onSuccess: (data) => {
      qc.setQueryData(['customers', 'detail', id], data);
      void qc.invalidateQueries({ queryKey: ['customers', 'list'] });
    },
  });
}

/** FR-M-014 call/SMS attempts logged from the staff app (contract 1.2.0). Never contains phone numbers. */
export function useContactAttempts(id: string) {
  return useQuery({
    queryKey: ['customers', 'contact-attempts', id],
    queryFn: () => unwrap(api.GET('/customers/{id}/contact-attempts', { params: { path: { id } } })),
    staleTime: 60_000,
  });
}

export type MapPin = components['schemas']['MapPin'];
export type LocationProposal = components['schemas']['LocationProposal'];

export type MapQuery = NonNullable<operations['customerMap']['parameters']['query']>;
export type MapCluster = NonNullable<Awaited<ReturnType<typeof fetchMap>>['clusters']>[number];
const fetchMap = (query: MapQuery) => unwrap(api.GET('/customers/map', { params: { query } }));

/**
 * FR-CUS-008: pins in the visible box (max 2000) or clusters when zoomed out. 1.14.0: `payState` (pin colours, OR)
 * and `invoiceKind` (customers with an open installment or credit invoice) narrow it on the server.
 */
export function useCustomerMap(bbox: string | null, zoom: number, opts: { filter?: string[]; payState?: MapQuery['payState']; invoiceKind?: MapQuery['invoiceKind'] } = {}) {
  const branchId = useBranchId();
  useInvalidateOn([EV.customerTagged], [['customers', 'map']]);
  const filter = opts.filter?.length ? opts.filter.join(',') : undefined;
  const payState = opts.payState?.length ? opts.payState : undefined;
  const invoiceKind = opts.invoiceKind;
  return useQuery({
    queryKey: ['customers', 'map', { branchId, bbox, zoom, filter, payState, invoiceKind }],
    queryFn: () => fetchMap({ bbox: bbox!, zoom, filter, payState, invoiceKind, branchId }),
    enabled: !!bbox,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** FR-CUS-010: pin corrections proposed from the field, waiting for a manager. */
export function useProposals(status: 'pending' | 'approved' | 'rejected') {
  const branchId = useBranchId();
  return useQuery({
    queryKey: ['customers', 'location-proposals', { branchId, status }],
    // the contract declares a plain array; servers before field-api 1.7.0 wrapped it in { items }
    queryFn: async () => listOrItems<LocationProposal>(await unwrap(api.GET('/location-proposals', { params: { query: { branchId, status } } }))),
    staleTime: 30_000,
  });
}

export function useDecideProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'approve' | 'reject'; reason?: string }) =>
      unwrap(api.POST('/location-proposals/{id}/decision', { params: { path: { id } }, body: { decision, reason } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

/**
 * FR-CUS-011 (contract 1.11.0): a manager drops the pin on the map. `clientId` is made once per dialog, so a retry
 * after a network error cannot set the pin twice. Not optimistic: the pin changes on screen after the server says so.
 */
export function useSetLocation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { clientId: string; lat: number; lng: number; note?: string }) =>
      unwrap(api.POST('/customers/{id}/location', { params: { path: { id: customerId } }, body: { ...v, method: 'map' } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

/**
 * FR-CUS-014 (contract 1.17.0): a manager deletes the customer's pin, whatever its source. Not optimistic: the pin leaves
 * the screen after the server says so. Deleting twice is harmless (`removed: false`).
 */
export function useDeleteLocation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE('/customers/{id}/location', { params: { path: { id: customerId } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}
