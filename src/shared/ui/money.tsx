'use client';
import { useTranslation } from 'react-i18next';
import { CloudUpload } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatMoney, formatMoneyCompact } from '../lib/format';
import { useUi } from '../lib/ui-store';

/** Money is sacred: tabular, right-aligned by the caller, never truncated. `pending` = not yet posted in ERP. */
export function MoneyText({ poisha, compact, pending, sign, className }: { poisha: number | null | undefined; compact?: boolean; pending?: boolean; sign?: boolean; className?: string }) {
  useUi((s) => s.locale + s.bnDigits); // re-render on format prefs change
  const { t } = useTranslation();
  if (poisha == null) return <span className="text-fg-tertiary">—</span>;
  const text = compact ? formatMoneyCompact(poisha) : formatMoney(poisha, { sign });
  if (pending)
    return (
      <span className={cn('tabular inline-flex items-center gap-1 whitespace-nowrap text-st-pending', className)} title={t('money.pendingInErp')}>
        <CloudUpload className="size-3.5" aria-hidden />
        {text}
        <span className="sr-only">{t('money.pendingInErp')}</span>
      </span>
    );
  return <span className={cn('tabular whitespace-nowrap', className)} title={compact ? formatMoney(poisha) : undefined}>{text}</span>;
}
