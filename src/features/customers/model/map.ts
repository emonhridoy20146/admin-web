import { haversineM, readLatLng, type LatLng } from '@/shared/map/geo';
import type { LocationProposal } from '../api/customers';

/** Design token (CSS variable) that colours a pin for a customer status. */
export const STATUS_TOKEN: Record<string, string> = {
  tagged_bad: '--st-tagged-bg',
  bad_suggested: '--st-bad-suggested-fg',
  overdue: '--st-overdue-fg',
  promised_today: '--st-promised-fg',
  due_today: '--st-due-today-fg',
  current: '--st-current-fg',
  paid_up: '--st-paid-fg',
};

export function statusToken(status: string | undefined): string {
  return STATUS_TOKEN[status ?? ''] ?? '--st-current-fg';
}

export const MAP_FILTERS = ['overdue', 'due_today', 'promised_today', 'bad_suggested', 'tagged_bad', 'paid_up'] as const;

/** Below this zoom the API answers with clusters instead of pins. */
export const PIN_ZOOM = 13;

export interface ProposalVM {
  current: LatLng | null;
  proposed: LatLng | null;
  /** metres between the current pin and the proposed one; null when the customer has no pin yet */
  movedM: number | null;
  /** a big move, a poor fix, or a map pin picked far away / with a mock phone position deserves a second look */
  risky: boolean;
  /** 1.11.0: `map` = picked on a map (Uber style), `gps` = the phone's position */
  method: 'gps' | 'map';
  /** metres between a map pin and the phone when it was picked; null when unknown */
  phoneM: number | null;
}

export function proposalVM(p: LocationProposal, bigMoveM = 500, poorAccuracyM = 50, farPhoneM = 300): ProposalVM {
  const current = readLatLng(p.customer?.current);
  const proposed = readLatLng(p);
  const movedM = current && proposed ? haversineM(current, proposed) : null;
  const method = p.method === 'map' ? 'map' : 'gps';
  const phoneM = method === 'map' ? (p.deviceDistanceM ?? null) : null;
  const poorFix = method === 'gps' && (p.accuracyM ?? 0) > poorAccuracyM;
  const farPhone = method === 'map' && !p.direct && ((phoneM ?? 0) > farPhoneM || !!p.deviceMock);
  return { current, proposed, movedM, risky: (movedM ?? 0) > bigMoveM || poorFix || farPhone, method, phoneM };
}
