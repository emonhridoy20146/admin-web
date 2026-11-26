'use client';
import { useTranslation } from 'react-i18next';
import { FileText, Receipt, Undo2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import { MoneyText } from '@/shared/ui/money';
import type { components } from '@/shared/api/schema';
import { kindOf, returnedPaymentsOf } from '../model/invoice';

type Plan = components['schemas']['Plan'];

/**
 * FR-W-074 (contract 1.53.0): "Returned invoices" — the customer's invoices returned in the ERP, each with a Returned
 * chip and the ERP payments that were posted against it. Display only: no collect or money action, and none of these
 * amounts is added to anything (CLAUDE.md §2.6). A row opens the same invoice viewer (`onOpen`).
 */
export function ReturnedInvoices({ plans, onOpen, className }: { plans: Plan[]; onOpen: (erpPlanId: string) => void; className?: string }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  useUi((s) => s.bnDigits);
  if (!plans.length) return null;
  return (
    <section aria-labelledby="returned-invoices-title" className={cn('space-y-3', className)} data-testid="returned-invoices">
      <div>
        <h2 id="returned-invoices-title" className="flex items-center gap-2 text-md font-semibold text-fg">
          <Undo2 className="size-4 text-st-returned" aria-hidden />
          {t('returned.title')}
        </h2>
        <p className="mt-0.5 text-sm text-fg-secondary">{t('returned.note')}</p>
      </div>
      <ul className="space-y-3">
        {plans.map((p) => {
          const k = kindOf(p);
          const pays = returnedPaymentsOf(p);
          return (
            <li key={p.erpPlanId} className="overflow-hidden rounded-md border border-line bg-surface-subtle" data-testid="returned-invoice">
              <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-fg">{p.invoiceNo ?? p.erpPlanId}</span>
                    <StatusBadge status="returned" testId="returned-chip" />
                    <Badge tone={k === 'credit' ? 'info' : 'neutral'} icon={false}>{t(`invoice.kind${k === 'cash' ? 'Cash' : k === 'credit' ? 'Credit' : 'Installment'}`)}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-fg">{p.product}</p>
                  {(p.saleDate ?? p.startDate) && <p className="mt-0.5 text-xs text-fg-tertiary">{t('invoice.soldOn', { date: formatDate((p.saleDate ?? p.startDate)!) })}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  {/* the ERP's own figures for this one invoice, shown as they are; never added to the customer's numbers */}
                  <dl className="grid grid-cols-2 gap-4 text-sm sm:text-end">
                    <div>
                      <dt className="text-xs text-fg-tertiary">{t('invoice.total')}</dt>
                      <dd><MoneyText poisha={p.totalPayablePoisha ?? 0} className="text-fg-secondary" /></dd>
                    </div>
                    <div>
                      <dt className="text-xs text-fg-tertiary">{t('paid')}</dt>
                      <dd><MoneyText poisha={p.paidPoisha ?? 0} className="text-fg-secondary" /></dd>
                    </div>
                  </dl>
                  <button type="button" onClick={() => onOpen(p.erpPlanId ?? '')} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline sm:min-h-8">
                    <FileText className="size-4" aria-hidden />
                    {t('invoice.openFull')}
                    <span className="sr-only"> {p.invoiceNo ?? p.erpPlanId}</span>
                  </button>
                </div>
              </div>
              <div className="border-t border-line bg-surface px-4 py-2.5">
                <h3 className="text-xs font-semibold text-fg-secondary">{t('returned.payments')}</h3>
                {!pays.length ? (
                  <p className="mt-1 flex items-center gap-2 text-sm text-fg-tertiary">
                    <Receipt className="size-4 shrink-0" aria-hidden />
                    {t('invoice.noPayments')}
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-line" aria-label={t('returned.paymentsOf', { no: p.invoiceNo ?? p.erpPlanId })}>
                    {pays.map((pay, i) => (
                      <li key={`${pay.erpPaymentId}-${i}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-sm" data-testid="returned-payment">
                        <span className="min-w-0">
                          <span className="text-fg">{pay.date ? formatDate(pay.date) : '—'}</span>
                          {pay.receiptNo && <span className="ms-2 font-mono text-xs text-fg-secondary">{pay.receiptNo}</span>}
                          <span className="ms-2 text-xs text-fg-tertiary">{tc(`method.${pay.method}`, { defaultValue: pay.method })}</span>
                          {pay.reversed && <Badge tone="danger" className="ms-1">{t('payments.reversed')}</Badge>}
                        </span>
                        <span className="text-end">
                          <MoneyText poisha={pay.amountPoisha ?? 0} className={cn('font-medium text-fg-secondary', pay.reversed && 'line-through')} />
                          {(pay.discountPoisha ?? 0) > 0 && <span className="block text-xs text-fg-tertiary">{t('payments.discount', { amount: formatMoney(pay.discountPoisha ?? 0) })}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
