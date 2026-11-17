import { readLatLng, type LatLng } from '@/shared/map/geo';
import type { CustomerListItem } from '../api/customers';

/** The customer's usable pin (ERP or FOS overlay), or null when it is missing, invalid or looks swapped (FR-CUS-004). */
export function currentPin(c: Pick<CustomerListItem, 'location'>): LatLng | null {
  const s = c.location?.status;
  return s === 'ok' || s === 'overridden' ? readLatLng(c.location) : null;
}
