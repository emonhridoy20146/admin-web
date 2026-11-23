import type { components } from '@/shared/api/schema';

type Plan = components['schemas']['Plan'];
type Line = NonNullable<Plan['schedule']>[number];
type Item = NonNullable<Plan['items']>[number];

/**
 * Lines to show. The ERP moves an unpaid line's balance to a later line and leaves the old one at 0
 * (`rolled`, contract 1.13.0); those are hidden so the schedule matches what the office sees.
 */
export function visibleLines(plan: Plan): Line[] {
  return (plan.schedule ?? []).filter((s) => !s.rolled);
}

export function rolledCount(plan: Plan): number {
  return (plan.schedule ?? []).filter((s) => s.rolled).length;
}

/** A cash sale (contract 1.44.0) or a kind this build does not know: no schedule, never due (field-api ADR-057). */
export function isCashLike(plan: Pick<Plan, 'kind'>): boolean {
  const k = plan.kind as string | undefined | null;
  return k != null && k !== 'installment' && k !== 'credit';
}

/** Returned (closed) and cancelled invoices and cash sales are not collectable and are not in the totals. */
export function isCollectable(plan: Plan): boolean {
  return plan.status !== 'closed' && plan.status !== 'cancelled' && !isCashLike(plan);
}

/** Collectable plans first (newest final due first), then closed and cancelled ones. */
export function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => Number(isCollectable(b)) - Number(isCollectable(a)) || (b.finalDueDate ?? '').localeCompare(a.finalDueDate ?? ''));
}

/** i18n key (namespace customers) and count for how often installments fall due. */
export function frequencyLabel(plan: Plan): { key: string; n?: number } | null {
  if (plan.kind !== 'installment' && plan.kind != null) return null;
  if (!plan.frequency) return null;
  if (plan.frequency === 'custom') return plan.customDays ? { key: 'frequency.everyNDays', n: plan.customDays } : { key: 'frequency.custom' };
  return { key: `frequency.${plan.frequency}` };
}

/** "Walton fridge WFC-3F5 ×2": name, model when known, quantity above one. */
export function itemLabel(item: Item): string {
  return [item.name, item.model, (item.qty ?? 1) > 1 ? `×${item.qty}` : null].filter(Boolean).join(' ');
}

/** The guarantor phones to show: the list when the ERP sent one, else the single phone. */
export function guarantorPhones(g: NonNullable<Plan['guarantor']> | undefined | null): string[] {
  if (!g) return [];
  const list = g.phones?.length ? g.phones : g.phone ? [g.phone] : [];
  return [...new Set(list.filter(Boolean))];
}
