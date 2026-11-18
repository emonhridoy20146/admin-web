import type { PinGlyph, PinLook } from '@/shared/map/pin-icon';
import type { components } from '@/shared/api/schema';

/**
 * Payment state = the colour of a customer's map pin (field-api ADR-035, contract 1.14.0), worst first:
 * red `bad` (tagged bad, or a plan's full term is over with money left), orange `missed_many` (2+ missed
 * installments), yellow `missed_one`, blue `due_today`, green `on_track` (everything due so far is paid),
 * grey `paid_off` (nothing left).
 */
export type PayState = components['schemas']['PayState'];
export const PAY_STATES = ['bad', 'missed_many', 'missed_one', 'due_today', 'on_track', 'paid_off'] as const satisfies readonly PayState[];

const CSS: Record<PayState, string> = { bad: 'bad', missed_many: 'missed-many', missed_one: 'missed-one', due_today: 'due-today', on_track: 'on-track', paid_off: 'paid-off' };

/** CSS variable for a part of the state's colour: `pin` (fill), `fg` (text/outline), `bg` (soft background). */
export function psToken(s: PayState, part: 'pin' | 'fg' | 'bg'): string {
  return `--ps-${CSS[s]}-${part}`;
}

/** Tailwind classes, written out so the build keeps them. */
export const PS_CLASS: Record<PayState, { badge: string; bar: string; text: string }> = {
  bad: { badge: 'bg-ps-bad-bg text-ps-bad', bar: 'bg-ps-bad-pin', text: 'text-ps-bad' },
  missed_many: { badge: 'bg-ps-missed-many-bg text-ps-missed-many', bar: 'bg-ps-missed-many-pin', text: 'text-ps-missed-many' },
  missed_one: { badge: 'bg-ps-missed-one-bg text-ps-missed-one', bar: 'bg-ps-missed-one-pin', text: 'text-ps-missed-one' },
  due_today: { badge: 'bg-ps-due-today-bg text-ps-due-today', bar: 'bg-ps-due-today-pin', text: 'text-ps-due-today' },
  on_track: { badge: 'bg-ps-on-track-bg text-ps-on-track', bar: 'bg-ps-on-track-pin', text: 'text-ps-on-track' },
  paid_off: { badge: 'bg-ps-paid-off-bg text-ps-paid-off', bar: 'bg-ps-paid-off-pin', text: 'text-ps-paid-off' },
};

export function isPayState(v: unknown): v is PayState {
  return typeof v === 'string' && (PAY_STATES as readonly string[]).includes(v);
}

export function payRank(s: PayState): number {
  return PAY_STATES.indexOf(s);
}

export function worstPayState(list: (PayState | null | undefined)[]): PayState | null {
  let best: PayState | null = null;
  for (const s of list) if (s && (best === null || payRank(s) < payRank(best))) best = s;
  return best;
}

interface PayInput {
  payState?: PayState | null;
  missedCount?: number | null;
  /** customer status (list items, pins) */
  status?: string | null;
  badges?: string[] | null;
  tagged?: boolean | null;
  tag?: { state?: string; severity?: string } | null;
  totalOutstandingPoisha?: number | null;
  outstandingPoisha?: number | null;
}

/**
 * The server's pay state; before field-api 1.14.0 is deployed it is missing, so it is read from the older status
 * (overdue cannot tell one missed installment from several, so it counts as one unless the server sent a count).
 */
export function payStateOf(x: PayInput): PayState {
  if (isPayState(x.payState)) return x.payState;
  const badges = new Set([...(x.badges ?? []), ...(x.status ? [x.status] : [])]);
  const tagBad = x.tagged || (x.tag?.state === 'tagged' && x.tag.severity !== 'watch') || badges.has('tagged_bad');
  if (tagBad || badges.has('bad_suggested')) return 'bad';
  const owed = x.totalOutstandingPoisha ?? x.outstandingPoisha;
  if (badges.has('paid_up') || owed === 0) return 'paid_off';
  if (badges.has('overdue') || badges.has('promised_today')) return (x.missedCount ?? 0) >= 2 ? 'missed_many' : 'missed_one';
  if (badges.has('due_today')) return 'due_today';
  return 'on_track';
}

/** The glyph inside the pin: "!" for bad, the number missed, a dot for due today, a tick for the calm ones. */
export function payGlyph(s: PayState, missed?: number | null, fmt: (n: number) => string = String): PinGlyph {
  if (s === 'bad') return 'alert';
  if (s === 'missed_many' || s === 'missed_one') {
    const n = Math.max(missed ?? 0, s === 'missed_many' ? 2 : 1);
    return { text: n > 99 ? `${fmt(99)}+` : fmt(n) };
  }
  if (s === 'due_today') return 'dot';
  return 'check';
}

export function payLook(s: PayState, missed?: number | null, fmt?: (n: number) => string): PinLook {
  return { fill: psToken(s, 'pin'), edge: psToken(s, 'fg'), glyph: payGlyph(s, missed, fmt) };
}
