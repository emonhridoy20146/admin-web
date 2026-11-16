import type { Device } from '../api/devices';

export const STATUSES = ['pending_approval', 'active', 'unbound'] as const;
export type DeviceStatus = (typeof STATUSES)[number];
export const VIEWS = ['all', ...STATUSES] as const;
export type View = (typeof VIEWS)[number];

export function statusOf(d: Pick<Device, 'status'>): DeviceStatus {
  return (STATUSES as readonly string[]).includes(d.status ?? '') ? (d.status as DeviceStatus) : 'active';
}

/** A rooted phone or an emulator can fake location and time, so it is called out everywhere. */
export function risks(d: Pick<Device, 'rooted' | 'emulator'>): ('rooted' | 'emulator')[] {
  return [...(d.rooted ? (['rooted'] as const) : []), ...(d.emulator ? (['emulator'] as const) : [])];
}

export function counts(rows: Device[] | undefined): Record<View, number> {
  const out: Record<View, number> = { all: 0, pending_approval: 0, active: 0, unbound: 0 };
  for (const d of rows ?? []) {
    out.all++;
    out[statusOf(d)]++;
  }
  return out;
}

/** Days since the phone last talked to the server; null when it never did. */
export function idleDays(d: Pick<Device, 'lastSeenAt'>, now: Date = new Date()): number | null {
  if (!d.lastSeenAt) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(d.lastSeenAt)) / 86_400_000));
}

export const IDLE_WARN_DAYS = 7;

/** Waiting for approval first, then risky phones, then the most recently seen. */
export function sortDevices(rows: Device[]): Device[] {
  const rank = (d: Device) => (statusOf(d) === 'pending_approval' ? 0 : statusOf(d) === 'active' ? (risks(d).length ? 1 : 2) : 3);
  return [...rows].sort((a, b) => rank(a) - rank(b) || (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));
}

export function filterDevices(rows: Device[], view: View): Device[] {
  return view === 'all' ? rows : rows.filter((d) => statusOf(d) === view);
}
