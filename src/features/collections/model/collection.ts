import { addDays } from '@/shared/lib/time';

export const RANGES = ['today', 'yesterday', '7d', '30d'] as const;
export type RangePreset = (typeof RANGES)[number];

export function rangeFor(preset: RangePreset, today: string): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
  }
}

export function presetFor(from: string, to: string, today: string): RangePreset | null {
  return (
    RANGES.find((r) => {
      const x = rangeFor(r, today);
      return x.from === from && x.to === to;
    }) ?? null
  );
}

/** FR-COL-009: only collections not yet in the ERP can be voided here; posted money is reversed in the ERP. */
export const VOIDABLE = ['received', 'posting', 'posting_failed'] as const;
export function canVoid(status?: string): boolean {
  return !!status && (VOIDABLE as readonly string[]).includes(status);
}

export const METHOD_ORDER = ['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'other_mobile'] as const;
export const METHOD_COLOR: Record<string, string> = {
  cash: 'bg-pay-cash',
  bkash: 'bg-pay-bkash',
  nagad: 'bg-pay-nagad',
  rocket: 'bg-pay-rocket',
  bank_transfer: 'bg-pay-bank',
  other_mobile: 'bg-pay-other',
};

export function orderedTotals(
  totals: Record<string, number> | undefined,
): { method: string; poisha: number; share: number }[] {
  const t = totals ?? {};
  const sum = Object.values(t).reduce((a, b) => a + b, 0);
  return METHOD_ORDER.filter((m) => (t[m] ?? 0) > 0).map((m) => ({
    method: m,
    poisha: t[m]!,
    share: sum ? t[m]! / sum : 0,
  }));
}
