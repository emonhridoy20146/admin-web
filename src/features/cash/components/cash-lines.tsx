'use client';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Handshake } from 'lucide-react';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatDateTime, pickText } from '@/shared/lib/format';
import { MoneyText } from '@/shared/ui/money';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import type { CashLine } from '../api/cash';

const PROMISE_TONE: Record<NonNullable<CashLine['promise']>['status'], Tone> = { open: 'promised', kept: 'paid', partially_kept: 'dueToday', broken: 'danger' };

/**
 * FR-W-044 / FR-W-048 (master FR-CASH-007/008): one cash collection as a line: customer (link), invoice, receipt,
 * time, status, the money this view is about (`shown`: in hand, or covered by a deposit) against the whole amount,
 * and the promise the money was collected against, if any. Field-system cash, not an ERP balance.
 */
export function CashLines({ items, label, shown, partLabel }: { items: CashLine[]; label: string; shown: (c: CashLine) => number; partLabel: string }) {
  const { t } = useTranslation('cash');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  return (
    <ol className="space-y-2" aria-label={label}>
      {items.map((c) => {
        const part = shown(c);
        return (
          <li key={c.collectionId} className="rounded-md border border-line bg-surface px-3 py-2.5" data-testid="cash-line">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/customers/${c.customer.id}/`} className="block truncate font-medium text-fg hover:text-primary" lang={locale}>
                  {pickText(c.customer.name, locale) || c.customer.code}
                </Link>
                <p className="text-xs text-fg-tertiary">
                  <span className="font-mono">{c.customer.code}</span> · {t('inHand.invoice', { no: c.erpPlanId })}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <MoneyText poisha={part} className="font-semibold text-fg" />
                {part < c.amountPoisha && (
                  <p className="text-xs text-fg-tertiary">
                    {partLabel} <MoneyText poisha={c.amountPoisha} />
                  </p>
                )}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-secondary">
              <span>
                <span className="font-mono">{c.receiptNo}</span> · <span className="tabular">{formatDateTime(c.recordedAt)}</span>
              </span>
              <StatusBadge status={c.status} />
            </div>
            <PromiseLine promise={c.promise} />
          </li>
        );
      })}
    </ol>
  );
}

/** The promise behind a cash line: date, how it stands, and whether the money came on time (FR-CASH-008). */
function PromiseLine({ promise }: { promise: CashLine['promise'] }) {
  const { t } = useTranslation('cash');
  if (!promise) return <p className="mt-1.5 text-xs text-fg-tertiary" data-testid="cash-line-promise">{t('promise.none')}</p>;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-secondary" data-testid="cash-line-promise">
      <Handshake className="size-3.5 shrink-0 text-st-promised" aria-hidden />
      <span>{t('promise.for', { date: formatDate(promise.promisedDate) })}</span>
      <MoneyText poisha={promise.promisedAmountPoisha} />
      <Badge tone={PROMISE_TONE[promise.status]}>{t(`promise.status.${promise.status}`)}</Badge>
      <Badge tone={promise.onTime ? 'success' : 'warning'} icon={false}>{promise.onTime ? t('promise.onTime') : t('promise.late')}</Badge>
    </p>
  );
}
