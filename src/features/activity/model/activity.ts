import type { ActivityItem } from '../api/activity';

/** Calendar day of a line in Dhaka (YYYY-MM-DD), for the day headings. */
export function dhakaDay(iso: string): string {
  return new Date(Date.parse(iso) + 6 * 3_600_000).toISOString().slice(0, 10);
}

/** Lines grouped by Dhaka day, newest day first; the order inside a day is kept. */
export function byDay<T extends Pick<ActivityItem, 'at'>>(items: T[]): { day: string; items: T[] }[] {
  const out: { day: string; items: T[] }[] = [];
  for (const i of items) {
    const d = dhakaDay(i.at);
    const last = out[out.length - 1];
    if (last && last.day === d) last.items.push(i);
    else out.push({ day: d, items: [i] });
  }
  return out;
}

/** Where a line opens: the collection, the customer (visit, promise and pin are about the customer). */
export function hrefOf(i: Pick<ActivityItem, 'entity' | 'entityId' | 'customer'>): string | null {
  if (i.entity === 'collection') return `/collections/?drawer=collection:${i.entityId}`;
  const c = i.customer?.id;
  return c ? `/customers/${c}/` : null;
}

/** The i18n key of the sentence: "… collected", "… recorded a visit", "… set a pin" or "… proposed a pin". */
export function sentenceKey(i: Pick<ActivityItem, 'type' | 'data'>): string {
  if (i.type === 'pin') return i.data.applied ? 'line.pinSet' : 'line.pinProposed';
  return `line.${i.type}`;
}
