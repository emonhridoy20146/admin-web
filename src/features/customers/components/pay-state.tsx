'use client';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { TFunction } from 'i18next';
import { cn } from '@/shared/lib/cn';
import { formatNumber } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { PinIcon } from '@/shared/map/pin-icon';
import { PAY_STATES, PS_CLASS, payLook, type PayState } from '../model/pay-state';

/** "৩টি কিস্তি মিস" for the missed states (with the count when known), the state's name otherwise. */
export function payLabel(t: TFunction, s: PayState, missed?: number | null): string {
  if (s === 'missed_one' || s === 'missed_many') return t('pay.missedN', { n: formatNumber(Math.max(missed ?? 0, s === 'missed_many' ? 2 : 1)) });
  return t(`pay.state.${s}`);
}

/** Pay state = colour + pin glyph + words (never colour alone), the same colour as the customer's map pin. */
export function PayStateBadge({ state, missed, className }: { state: PayState; missed?: number | null; className?: string }) {
  const { t } = useTranslation('customers');
  useUi((s) => s.bnDigits);
  return (
    <span title={t(`pay.help.${state}`)} className={cn('inline-flex h-[22px] items-center gap-1 rounded-xs px-1.5 text-xs font-medium whitespace-nowrap', PS_CLASS[state].badge, className)}>
      <PinIcon look={payLook(state, missed, (n) => formatNumber(n))} size={15} className="-ms-0.5 shrink-0" />
      {payLabel(t, state, missed)}
    </span>
  );
}

/** Legend that is also the colour filter: press a colour to see only those customers (several can be on). */
export function PayLegend({ selected, counts, onToggle, onClear }: { selected: PayState[]; counts: Record<PayState, number> | null; onToggle: (s: PayState) => void; onClear: () => void }) {
  const { t } = useTranslation('customers');
  useUi((s) => s.bnDigits);
  return (
    <div className="mb-3">
      <div role="group" aria-label={t('pay.legend')} className="scrollbar-thin -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <span className="shrink-0 text-xs font-semibold text-fg-tertiary">{t('pay.legend')}</span>
        {PAY_STATES.map((s) => {
          const on = selected.includes(s);
          const n = counts && (!selected.length || on) ? counts[s] : null;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              title={t(`pay.help.${s}`)}
              onClick={() => onToggle(s)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm font-medium [@media(pointer:coarse)]:h-11',
                on ? cn('border-current', PS_CLASS[s].badge) : 'border-line bg-surface text-fg-secondary hover:border-line-strong hover:text-fg',
              )}
            >
              <PinIcon look={payLook(s, s === 'missed_many' ? 2 : 1, (x) => formatNumber(x))} size={18} />
              {t(`pay.state.${s}`)}
              {n != null && <span className="tabular rounded-full bg-surface-hover px-1.5 text-xs text-fg-secondary">{formatNumber(n)}</span>}
            </button>
          );
        })}
        {selected.length > 0 && (
          <button type="button" onClick={onClear} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-primary hover:bg-surface-hover [@media(pointer:coarse)]:h-11">
            <X className="size-3.5" aria-hidden />
            {t('pay.allColours')}
          </button>
        )}
      </div>
    </div>
  );
}
