import type { components } from '@/shared/api/schema';
import { isCollectable } from './plan';
import { isPayState, payRank, type PayState } from './pay-state';

type Plan = components['schemas']['Plan'];
type Line = NonNullable<Plan['schedule']>[number];
type LinePayment = NonNullable<Line['payments']>[number];

/**
 * FR-W-028 invoice viewer (contract 1.14.0). One FOS plan = one ERP invoice: an installment sale (down payment +
 * schedule) or a credit sale (pay later, one due date). Every amount here is the ERP's own number; the viewer lays
 * them out and never works out a balance of its own (CLAUDE.md §2.6).
 */
export const INVOICE_KINDS = ['all', 'installment', 'credit', 'cash'] as const;
export const INVOICE_STATES = ['all', 'open', 'paid', 'closed'] as const;
export type InvoiceKind = 'installment' | 'credit' | 'cash';
export type InvoiceState = 'open' | 'paid' | 'closed';

/**
 * Contract 1.44.0 (field-api ADR-057): `cash` = a cash sale, no schedule, never due. A plan without a kind comes from a
 * server before 1.13.0 and is an installment sale; any other unknown kind is treated like `cash` (never due).
 */
export const kindOf = (p: Pick<Plan, 'kind'>): InvoiceKind => {
  const k = p.kind as string | undefined | null;
  return k == null || k === 'installment' ? 'installment' : k === 'credit' ? 'credit' : 'cash';
};
/**
 * open = money left on a collectable invoice; paid = nothing left; closed = returned or cancelled in the ERP.
 * A cash sale is `paid` when the ERP says `completed`, otherwise `closed` (never open, even with money left).
 */
export const stateOf = (p: Plan): InvoiceState =>
  kindOf(p) === 'cash' ? (p.status === 'completed' ? 'paid' : 'closed') : !isCollectable(p) ? 'closed' : (p.outstandingPoisha ?? 0) > 0 ? 'open' : 'paid';

const dayNo = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
/** whole days from `a` to `b` (both YYYY-MM-DD) */
export const daysBetween = (a: string, b: string) => dayNo(b) - dayNo(a);

export type LineState = 'paid' | 'paid_late' | 'partial' | 'missed' | 'due_today' | 'upcoming' | 'rolled' | 'closed';

export interface LineVM {
  seq: number;
  dueDate: string;
  /** due amount including any late fee */
  amountPoisha: number;
  lateFeePoisha: number;
  paidPoisha: number;
  leftPoisha: number;
  writtenOffPoisha: number;
  state: LineState;
  /** date the line was finished (from the ERP payments), null when unpaid or not known */
  paidOn: string | null;
  /** days late: paid late, or unpaid past the due date */
  daysLate: number;
  payments: LinePayment[];
  estimated: boolean;
  /** rolled lines: the installment number that took this line's balance */
  movedTo: number | null;
}

/** Every line, rolled ones included (here the office wants to see where a missed balance went). */
export function lineRows(plan: Plan, today: string): LineVM[] {
  const lines = [...(plan.schedule ?? [])].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const open = isCollectable(plan);
  return lines.map((l, i) => {
    const amount = l.amountPoisha ?? 0;
    const paid = l.paidPoisha ?? 0;
    const left = l.outstandingPoisha ?? Math.max(0, amount - paid);
    const due = l.dueDate ?? '';
    const last = l.payments?.length ? l.payments[l.payments.length - 1]?.date : undefined;
    const paidOn = l.paidOn ?? (left === 0 && paid > 0 && last ? last : null);
    const late = l.daysLate ?? (paidOn ? Math.max(0, daysBetween(due, paidOn)) : left > 0 && due < today ? daysBetween(due, today) : 0);
    let state: LineState;
    if (l.rolled) state = 'rolled';
    else if (left === 0) state = late > 0 ? 'paid_late' : 'paid';
    else if (!open) state = 'closed';
    else if (l.missed ?? due < today) state = 'missed';
    else if (due === today) state = 'due_today';
    else state = paid > 0 ? 'partial' : 'upcoming';
    const movedTo = l.rolled ? (lines.slice(i + 1).find((x) => !x.rolled)?.seq ?? null) : null;
    return {
      seq: l.seq ?? i + 1,
      dueDate: due,
      amountPoisha: amount,
      lateFeePoisha: l.lateFeePoisha ?? 0,
      paidPoisha: paid,
      leftPoisha: left,
      writtenOffPoisha: l.writtenOffPoisha ?? 0,
      state,
      paidOn,
      daysLate: state === 'rolled' ? 0 : late,
      payments: l.payments ?? [],
      estimated: !!l.estimated,
      movedTo,
    };
  });
}

/** The plan's pay state from the server, else read from its lines (older server). Closed invoices have none. */
export function planPayState(plan: Plan, today: string): PayState | null {
  if (!isCollectable(plan) || kindOf(plan) === 'cash') return null;
  if (isPayState(plan.payState)) return plan.payState;
  if ((plan.outstandingPoisha ?? 0) <= 0) return 'paid_off';
  if (plan.badSuggested) return 'bad';
  const rows = lineRows(plan, today);
  const missed = rows.filter((r) => r.state === 'missed').length;
  return missed >= 2 ? 'missed_many' : missed === 1 ? 'missed_one' : rows.some((r) => r.state === 'due_today') ? 'due_today' : 'on_track';
}

export function missedOf(plan: Plan, today: string): number {
  return plan.missedCount ?? lineRows(plan, today).filter((r) => r.state === 'missed').length;
}

/** Next date with money due (today or later) and what is left on it. */
export function nextDue(plan: Plan, today: string): { date: string; amountPoisha: number } | null {
  if (kindOf(plan) === 'cash') return null;
  if (plan.nextDueDate) return { date: plan.nextDueDate, amountPoisha: plan.nextDuePoisha ?? 0 };
  const r = lineRows(plan, today).find((x) => x.leftPoisha > 0 && x.dueDate >= today && x.state !== 'rolled');
  return r ? { date: r.dueDate, amountPoisha: r.leftPoisha } : null;
}

/** Credit sale terms: the one due date and how far away it is (negative = overdue). */
export function creditTerm(plan: Plan, today: string): { dueDate: string; days: number; settled: boolean } | null {
  if (kindOf(plan) === 'cash') return null;
  const due = plan.creditDueDate ?? plan.finalDueDate ?? plan.schedule?.[0]?.dueDate;
  if (!due) return null;
  return { dueDate: due, days: daysBetween(today, due), settled: (plan.outstandingPoisha ?? 0) <= 0 };
}

/** ERP late-fee rate is a fraction (0.02 = 2 %); a value above 1 is taken as a percent already. */
export function penaltyPercent(rate: string | undefined | null): number | null {
  const n = Number(rate);
  if (rate == null || rate === '' || !Number.isFinite(n)) return null;
  return n > 1 ? n : Math.round(n * 10_000) / 100;
}

/** The installment amount most lines have (the last line often differs by rounding). */
export function usualInstallment(plan: Plan): number | null {
  const counts = new Map<number, number>();
  for (const l of plan.schedule ?? []) if (!l.rolled && (l.amountPoisha ?? 0) > 0) counts.set((l.amountPoisha ?? 0) - (l.lateFeePoisha ?? 0), (counts.get((l.amountPoisha ?? 0) - (l.lateFeePoisha ?? 0)) ?? 0) + 1);
  let best: number | null = null;
  let n = 0;
  for (const [amount, c] of counts) if (c > n) [best, n] = [amount, c];
  return best;
}

/** Open invoices first (worst colour first, then most left), then paid ones (newest sale first), then closed ones. */
export function sortInvoices(plans: Plan[], today: string): Plan[] {
  const rank = (p: Plan) => ({ open: 0, paid: 1, closed: 2 })[stateOf(p)];
  const ps = (p: Plan) => {
    const s = planPayState(p, today);
    return s ? payRank(s) : 9;
  };
  return [...plans].sort(
    (a, b) => rank(a) - rank(b) || ps(a) - ps(b) || (b.outstandingPoisha ?? 0) - (a.outstandingPoisha ?? 0) || (b.saleDate ?? b.startDate ?? '').localeCompare(a.saleDate ?? a.startDate ?? ''),
  );
}

export function filterInvoices(plans: Plan[], kind: (typeof INVOICE_KINDS)[number], state: (typeof INVOICE_STATES)[number]): Plan[] {
  return plans.filter((p) => (kind === 'all' || kindOf(p) === kind) && (state === 'all' || stateOf(p) === state));
}

export function invoiceCounts(plans: Plan[]) {
  const kinds = { all: plans.length, installment: 0, credit: 0, cash: 0 };
  const states = { all: plans.length, open: 0, paid: 0, closed: 0 };
  for (const p of plans) {
    kinds[kindOf(p)] += 1;
    states[stateOf(p)] += 1;
  }
  return { kinds, states };
}

/** ERP payment id → the installment numbers it paid (for the payments list of one invoice). */
export function linesByPayment(rows: LineVM[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const r of rows) for (const p of r.payments) if (p.erpPaymentId) out.set(p.erpPaymentId, [...(out.get(p.erpPaymentId) ?? []), r.seq]);
  return out;
}

/**
 * FR-W-074 (contract 1.53.0, field-api FR-CUS-024 / ADR-071): the customer's invoices returned in the ERP, newest sale
 * first. They come in `returnedPlans` only (never in `plans`), are shown marked as returned and are never counted: no
 * total, count, pay state, KPI or chart here adds them (the server's numbers already leave them out).
 */
export function returnedPlansOf(c: { returnedPlans?: Plan[] | null }): Plan[] {
  return [...(c.returnedPlans ?? [])].sort((a, b) => (b.saleDate ?? b.startDate ?? '').localeCompare(a.saleDate ?? a.startDate ?? ''));
}

/** The ERP payments of a returned invoice: its own `payments` (each `returned: true`), newest first. */
export function returnedPaymentsOf(plan: Plan): NonNullable<Plan['payments']> {
  return [...(plan.payments ?? [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}
