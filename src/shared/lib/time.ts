import { DateTime } from 'luxon';

export const DHAKA = 'Asia/Dhaka';

/** Today's business date (YYYY-MM-DD) in Asia/Dhaka. */
export function todayDhaka(now: Date = new Date()): string {
  return DateTime.fromJSDate(now).setZone(DHAKA).toISODate()!;
}

export function addDays(isoDate: string, days: number): string {
  return DateTime.fromISO(isoDate, { zone: DHAKA }).plus({ days }).toISODate()!;
}

export function minutesSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
}
