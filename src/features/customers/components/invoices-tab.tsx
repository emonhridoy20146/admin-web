'use client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, FileSearch, FileText } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { useUi } from '@/shared/lib/ui-store';
import { todayDhaka } from '@/shared/lib/time';
import { Badge } from '@/shared/ui/badge';
import { EmptyState } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { Segmented } from '@/shared/ui/primitives';
import type { CustomerDetail } from '../api/customers';
import { creditTerm, filterInvoices, INVOICE_KINDS, INVOICE_STATES, invoiceCounts, kindOf, missedOf, nextDue, planPayState, returnedPlansOf, sortInvoices, stateOf } from '../model/invoice';
import { InvoiceViewer } from './invoice-viewer';
import { ReturnedInvoices } from './returned-invoices';
import { PayStateBadge } from './pay-state';

/**
 * FR-W-028: the customer's ERP invoices, filtered by kind (installment / credit) and state (open / paid / returned),
 * in the link (`?tab=invoices&invKind=credit&invoice=<id>`) so Back and shared links work. A row opens the viewer.
 * FR-W-073 (contract 1.53.0): invoices returned in the ERP (`returnedPlans`) are listed apart below, never counted in the
 * filters' counts, and open in the same viewer in its returned mode.
 */
export function InvoicesTab({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const kind = oneOf(url.get('invKind'), INVOICE_KINDS, 'all');
  const state = oneOf(url.get('invState'), INVOICE_STATES, 'all');
  const openId = url.get('invoice');
  const today = todayDhaka();
  const all = useMemo(() => sortInvoices(c.plans ?? [], today), [c.plans, today]);
  const counts = useMemo(() => invoiceCounts(all), [all]);
  const shown = filterInvoices(all, kind, state);
  const returned = useMemo(() => returnedPlansOf(c), [c]);
  const selected = openId ? all.find((p) => p.erpPlanId === openId) : undefined;
  const selectedReturned = openId && !selected ? returned.find((p) => p.erpPlanId === openId) : undefined;

  if (selected) return <InvoiceViewer c={c} plan={selected} onBack={() => url.set({ invoice: null })} />;
  if (selectedReturned) return <InvoiceViewer c={c} plan={selectedReturned} returned onBack={() => url.set({ invoice: null })} />;
  const returnedList = <ReturnedInvoices plans={returned} onOpen={(id) => url.set({ invoice: id }, { push: true })} className="pt-2" />;
  // only returned invoices: nothing to filter, just the returned list
  if (!all.length && returned.length)
    return (
      <div className="space-y-4">
        {openId && <p className="rounded-md border border-line bg-surface-subtle px-3 py-2 text-sm text-fg-secondary">{t('invoice.notFound')}</p>}
        {returnedList}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Segmented label={t('invoiceKind.label')} value={kind} onChange={(v) => url.set({ invKind: v === 'all' ? null : v })} options={INVOICE_KINDS.map((k) => ({ value: k, label: t(`invoiceKind.${k}`), count: counts.kinds[k] }))} />
        <Segmented label={t('invoice.stateLabel')} value={state} onChange={(v) => url.set({ invState: v === 'all' ? null : v })} options={INVOICE_STATES.map((s) => ({ value: s, label: t(`invoice.state.${s}`), count: counts.states[s] }))} />
      </div>
      {openId && <p className="rounded-md border border-line bg-surface-subtle px-3 py-2 text-sm text-fg-secondary">{t('invoice.notFound')}</p>}

      {!shown.length ? (
        <EmptyState icon={all.length ? FileSearch : FileText} title={all.length ? t('invoice.noneMatch') : t('invoice.none')} className="py-10" />
      ) : (
        <ul className="space-y-2" aria-label={t('tabs.invoices')}>
          {shown.map((p) => {
            const k = kindOf(p);
            const credit = k === 'credit';
            const st = stateOf(p);
            const pay = planPayState(p, today);
            const next = st === 'open' && k === 'installment' ? nextDue(p, today) : null;
            const term = credit && st === 'open' ? creditTerm(p, today) : null;
            return (
              <li key={p.erpPlanId}>
                <button
                  type="button"
                  onClick={() => url.set({ invoice: p.erpPlanId ?? null }, { push: true })}
                  className={cn('group flex w-full flex-col gap-3 rounded-md border border-line bg-surface px-4 py-3 text-start shadow-e1 hover:border-line-strong hover:bg-surface-hover sm:flex-row sm:items-center', st === 'closed' && 'bg-surface-subtle')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-fg">{p.invoiceNo ?? p.erpPlanId}</span>
                      <Badge tone={credit ? 'info' : 'neutral'} icon={false}>{t(`invoice.kind${k === 'cash' ? 'Cash' : credit ? 'Credit' : 'Installment'}`)}</Badge>
                      {pay && <PayStateBadge state={pay} missed={missedOf(p, today)} />}
                      {st === 'closed' && k !== 'cash' && <Badge tone="neutral">{t(`planStatus.${p.status}`)}</Badge>}
                      {k === 'cash' && <span className="text-xs text-fg-secondary">{t('invoice.nothingDue')}</span>}
                    </span>
                    <span className="mt-1 block truncate text-sm text-fg">{p.product}</span>
                    <span className="mt-0.5 block text-xs text-fg-tertiary">
                      {(p.saleDate ?? p.startDate) && t('invoice.soldOn', { date: formatDate((p.saleDate ?? p.startDate)!) })}
                      {k === 'installment' && p.installmentCount ? ` · ${t('installments', { n: formatNumber(p.installmentCount) })}` : ''}
                      {next ? ` · ${t('invoice.nextDue', { date: formatDate(next.date, { withYear: false }), amount: formatMoney(next.amountPoisha) })}` : ''}
                      {term ? ` · ${t('invoice.creditDue', { date: formatDate(term.dueDate) })}` : ''}
                    </span>
                  </span>
                  <span className="grid shrink-0 grid-cols-3 gap-4 text-end text-sm sm:w-[22rem]">
                    <span>
                      <span className="block text-xs text-fg-tertiary">{t('invoice.total')}</span>
                      <MoneyText poisha={p.totalPayablePoisha ?? 0} />
                    </span>
                    <span>
                      <span className="block text-xs text-fg-tertiary">{t('paid')}</span>
                      <MoneyText poisha={p.paidPoisha ?? 0} />
                    </span>
                    <span>
                      <span className="block text-xs text-fg-tertiary">{t('invoice.left')}</span>
                      {k === 'cash' ? <span className="font-semibold text-fg-tertiary">—</span> : <MoneyText poisha={p.outstandingPoisha ?? 0} className={cn('font-semibold', st === 'open' ? 'text-fg' : 'text-fg-tertiary')} />}
                    </span>
                  </span>
                  <ChevronRight className="hidden size-4 shrink-0 text-fg-tertiary group-hover:text-fg sm:block rtl:rotate-180" aria-hidden />
                  <span className="sr-only">{t('invoice.open')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {returnedList}
    </div>
  );
}
