'use client';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarClock, CircleCheck, CloudUpload, Receipt, Undo2, UserRound } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatNumber, pickText, formatDaySpan } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { todayDhaka } from '@/shared/lib/time';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import { Card, CardHeader } from '@/shared/ui/card';
import { MoneyText } from '@/shared/ui/money';
import { AsOf } from '@/shared/ui/page';
import { PrintButton } from '@/shared/ui/print';
import type { Tone } from '@/shared/ui/status';
import type { components } from '@/shared/api/schema';
import type { CustomerDetail } from '../api/customers';
import { creditTerm, kindOf, lineRows, linesByPayment, missedOf, nextDue, penaltyPercent, planPayState, returnedPaymentsOf, stateOf, usualInstallment, type LineState, type LineVM } from '../model/invoice';
import { frequencyLabel, guarantorPhones, itemLabel } from '../model/plan';
import { PayStateBadge } from './pay-state';

type Plan = components['schemas']['Plan'];

const LINE_TONE: Record<LineState, Tone> = { paid: 'paid', paid_late: 'paid', partial: 'dueToday', missed: 'overdue', due_today: 'current', upcoming: 'neutral', rolled: 'neutral', closed: 'neutral' };

/**
 * FR-W-028: one ERP invoice laid out to be read (and printed): what was sold, what it cost, what was paid, what is
 * left, and for installment sales every installment with its exact date, amount, what was paid on it and when.
 * ERP money is shown as the ERP sends it; field money not yet in the ERP is shown apart and labelled.
 * `returned` (FR-W-074, contract 1.53.0): an invoice returned in the ERP, from `returnedPlans`. It gets a Returned chip
 * and a note, no due date, schedule, terms or field money, its own `payments`, and no action besides print.
 */
export function InvoiceViewer({ c, plan, onBack, returned = false }: { c: CustomerDetail; plan: Plan; onBack: () => void; returned?: boolean }) {
  const { t } = useTranslation('customers');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branches = useBranches();
  const today = todayDhaka();
  const kind = kindOf(plan);
  const credit = kind === 'credit';
  const cash = kind === 'cash';
  const state = stateOf(plan);
  const pay = planPayState(plan, today);
  const rows = lineRows(plan, today);
  const branch = branches.data?.find((b) => b.id === plan.branchId);
  const pending = returned ? [] : (c.pendingCollections ?? []).filter((p) => p.erpPlanId === plan.erpPlanId && (p.amountPoisha ?? 0) > 0);
  const pendingPoisha = pending.reduce((s, p) => s + (p.amountPoisha ?? 0), 0);
  const next = state === 'open' && !returned ? nextDue(plan, today) : null;
  const term = credit && !returned ? creditTerm(plan, today) : null;
  const no = plan.invoiceNo ?? plan.erpPlanId ?? '';

  return (
    <article aria-labelledby="invoice-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline sm:min-h-9">
          <ArrowLeft className="size-4" aria-hidden />
          {t('invoice.back')}
        </button>
        <PrintButton name={`${no} ${pickText(c.name, locale)}`} />
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-fg-tertiary">{cash ? t('invoice.cashTitle') : credit ? t('invoice.creditTitle') : t('invoice.installmentTitle')}</p>
            <h2 id="invoice-title" className="font-mono text-xl font-semibold tracking-tight text-fg">{no}</h2>
            <p className="mt-0.5 text-base text-fg">{plan.product}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {returned && <StatusBadge status="returned" testId="returned-chip" />}
            {cash && <span data-testid="cash-sale-badge"><Badge tone="neutral">{t('invoice.kindCash')}</Badge></span>}
            {pay && !returned && <PayStateBadge state={pay} missed={missedOf(plan, today)} />}
            {state === 'closed' && !cash && !returned && <Badge tone="neutral">{t(`planStatus.${plan.status}`)}</Badge>}
            {plan.badSuggested && <StatusBadge status="bad_suggested" />}
            {plan.status === 'defaulted' && <Badge tone="danger">{t('planStatus.defaulted')}</Badge>}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <Fact label={t('invoice.saleDate')}>{plan.saleDate || plan.startDate ? formatDate((plan.saleDate ?? plan.startDate)!) : '—'}</Fact>
          <Fact label={t('invoice.branch')}>{branch ? <span lang={locale}>{pickText(branch.name, locale)}</span> : '—'}</Fact>
          <Fact label={t('invoice.erpStatus')}>
            {plan.invoiceStatus ? t(`invoice.erpInvoiceStatus.${plan.invoiceStatus}`, { defaultValue: plan.invoiceStatus }) : '—'}
            {plan.paymentStatus && <span className="text-fg-tertiary"> · {t(`invoice.erpPaymentStatus.${plan.paymentStatus}`, { defaultValue: plan.paymentStatus })}</span>}
          </Fact>
          <Fact label={t('invoice.asOf')}>{c.erpFetchedAt ? <AsOf at={c.erpFetchedAt} /> : '—'}</Fact>
        </dl>

        <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line [&>*]:bg-surface">
          <Figure label={t('invoice.total')}><MoneyText poisha={plan.totalPayablePoisha ?? 0} className="text-lg font-semibold" /></Figure>
          <Figure label={t('invoice.paidSoFar')}><MoneyText poisha={plan.paidPoisha ?? 0} className="text-lg font-semibold" /></Figure>
          <Figure label={t('invoice.left')}>
            {cash ? (
              <span className="text-lg font-semibold text-fg-secondary">{t('invoice.nothingDue')}</span>
            ) : (
              <MoneyText poisha={plan.outstandingPoisha ?? 0} className={cn('text-lg font-semibold', returned && 'text-fg-secondary', !returned && state === 'open' && (plan.missedCount ?? 0) > 0 && 'text-st-overdue')} />
            )}
          </Figure>
        </dl>

        {returned && (
          <p className="mt-3 flex gap-2 rounded-md bg-st-returned-bg px-3 py-2 text-sm text-st-returned" data-testid="returned-note">
            <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('returned.viewerNote')}</span>
          </p>
        )}
        {cash && (
          <p className="mt-3 flex items-center gap-2 text-sm text-fg-secondary" data-testid="cash-sale-note">
            <CircleCheck className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
            {t('invoice.cashNote')}
          </p>
        )}
        {next && kind === 'installment' && (
          <p className="mt-3 flex items-center gap-2 text-sm text-fg">
            <CalendarClock className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
            {t('invoice.nextDue', { date: formatDate(next.date), amount: formatMoney(next.amountPoisha) })}
          </p>
        )}
        {term && <CreditLine term={term} />}
        {pendingPoisha > 0 && (
          <p className="mt-3 flex gap-2 rounded-md bg-st-pending-bg px-3 py-2 text-sm text-st-pending">
            <CloudUpload className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('invoice.pendingField', { amount: formatMoney(pendingPoisha), n: formatNumber(pending.length) })}</span>
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] print:grid-cols-1">
        <div className="min-w-0 space-y-4">
          {kind === 'installment' && !returned && <ScheduleCard plan={plan} rows={rows} />}
          <ItemsCard plan={plan} />
          <PaymentsCard c={c} plan={plan} rows={rows} returned={returned} />
        </div>
        <div className="space-y-4">
          <MoneyCard plan={plan} credit={kind !== 'installment'} cash={cash || returned} pendingPoisha={pendingPoisha} />
          {kind === 'installment' && !returned && <TermsCard plan={plan} today={today} />}
          <GuarantorCard plan={plan} />
        </div>
      </div>
    </article>
  );
}

/**
 * A table that may scroll sideways on a phone: keyboard users must be able to reach and scroll it (axe
 * scrollable-region-focusable), so the box is a named, focusable region with a visible focus ring.
 */
function ScrollBox({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn('scrollbar-thin overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-solid', className)}>
      {children}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-tertiary">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 sm:px-4">
      <dt className="text-xs text-fg-tertiary">{label}</dt>
      <dd className="tabular mt-0.5">{children}</dd>
    </div>
  );
}

function CreditLine({ term }: { term: { dueDate: string; days: number; settled: boolean } }) {
  const { t } = useTranslation('customers');
  const tone = term.settled ? 'text-fg' : term.days < 0 ? 'text-st-overdue' : term.days <= 3 ? 'text-st-due-today' : 'text-fg';
  const when = term.settled ? t('invoice.creditSettled') : term.days < 0 ? t('invoice.creditOver', { n: formatDaySpan(-term.days) }) : term.days === 0 ? t('invoice.creditToday') : t('invoice.creditLeft', { n: formatDaySpan(term.days) });
  return (
    <p className={cn('mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm', tone)}>
      <CalendarClock className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
      <span className="text-fg">{t('invoice.creditDue', { date: formatDate(term.dueDate) })}</span>
      <span className="font-semibold">{when}</span>
    </p>
  );
}

/** Every installment: date, amount (late fee included), paid, left, state, and when it was paid with which receipt. */
function ScheduleCard({ plan, rows }: { plan: Plan; rows: LineVM[] }) {
  const { t } = useTranslation('customers');
  const counted = rows.filter((r) => r.state !== 'rolled');
  const paid = counted.filter((r) => r.state === 'paid' || r.state === 'paid_late').length;
  const missed = rows.filter((r) => r.state === 'missed').length;
  const summary = t('invoice.scheduleSummary', { n: formatNumber(counted.length), paid: formatNumber(paid), missed: formatNumber(missed) });
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('invoice.schedule')} subtitle={summary} />
      {!rows.length ? (
        <p className="px-4 py-6 text-sm text-fg-tertiary">{t('invoice.noSchedule')}</p>
      ) : (
        <>
          <ScrollBox label={t('invoice.schedule')} className="hidden sm:block print:block">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('invoice.schedule')} · {plan.invoiceNo}</caption>
              <thead className="bg-surface-subtle text-xs text-fg-secondary">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-semibold">{t('seq')}</th>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">{t('dueDate')}</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">{t('invoice.lineAmount')}</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">{t('paidAmount')}</th>
                  <th scope="col" className="px-3 py-2 text-end font-semibold">{t('invoice.lineLeft')}</th>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">{t('col.status')}</th>
                  <th scope="col" className="px-4 py-2 text-start font-semibold">{t('invoice.paidOnCol')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.seq} className={cn('border-t border-line align-top', r.state === 'missed' && 'bg-st-overdue-bg/50', r.state === 'due_today' && 'bg-st-current-bg/60', r.state === 'rolled' && 'text-fg-tertiary')}>
                    <td className="tabular px-4 py-2.5 text-fg-tertiary">{formatNumber(r.seq)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatDate(r.dueDate)}
                      {r.estimated && <span className="ms-1 text-xs text-fg-tertiary">({t('estimated')})</span>}
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <MoneyText poisha={r.amountPoisha} className={r.state === 'rolled' ? 'text-fg-tertiary' : ''} />
                      {r.lateFeePoisha > 0 && <span className="block text-xs whitespace-nowrap text-fg-tertiary">{t('lateFeeIncl', { amount: formatMoney(r.lateFeePoisha) })}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <MoneyText poisha={r.paidPoisha} className={r.paidPoisha === 0 ? 'text-fg-tertiary' : ''} />
                      {r.writtenOffPoisha > 0 && <span className="block text-xs whitespace-nowrap text-fg-tertiary">{t('invoice.writtenOffIncl', { amount: formatMoney(r.writtenOffPoisha) })}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-end">{r.leftPoisha > 0 ? <MoneyText poisha={r.leftPoisha} className={cn('font-medium', r.state === 'missed' && 'text-st-overdue')} /> : <span className="text-fg-tertiary">—</span>}</td>
                    <td className="px-3 py-2.5"><LineBadge r={r} /></td>
                    <td className="px-4 py-2.5"><PaidOn r={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>
          {/* phones: one card per installment */}
          <ol className="divide-y divide-line sm:hidden print:hidden" aria-label={t('invoice.schedule')}>
            {rows.map((r) => (
              <li key={r.seq} className={cn('px-4 py-3', r.state === 'missed' && 'bg-st-overdue-bg/50', r.state === 'rolled' && 'text-fg-tertiary')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{t('invoice.lineN', { n: formatNumber(r.seq) })} · {formatDate(r.dueDate)}</p>
                    <div className="mt-1"><LineBadge r={r} /></div>
                  </div>
                  <div className="shrink-0 text-end text-sm">
                    <MoneyText poisha={r.amountPoisha} className="font-medium" />
                    {r.leftPoisha > 0 && r.paidPoisha > 0 && <span className="block text-xs text-fg-tertiary">{t('invoice.paidOfLeft', { paid: formatMoney(r.paidPoisha), left: formatMoney(r.leftPoisha) })}</span>}
                  </div>
                </div>
                <div className="mt-1.5 text-xs"><PaidOn r={r} /></div>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}

function LineBadge({ r }: { r: LineVM }) {
  const { t } = useTranslation('customers');
  return <Badge tone={LINE_TONE[r.state]} icon={r.state === 'upcoming' || r.state === 'rolled' || r.state === 'closed' ? false : undefined}>{t(`invoice.line.${r.state}`)}</Badge>;
}

/** When it was paid and with which receipt; for missed lines how many days ago it fell due. */
function PaidOn({ r }: { r: LineVM }) {
  const { t } = useTranslation('customers');
  if (r.state === 'rolled') return <span className="text-xs text-fg-tertiary">{r.movedTo ? t('invoice.movedTo', { n: formatNumber(r.movedTo) }) : t('invoice.moved')}</span>;
  const late = r.daysLate > 0 && (r.state === 'missed' || r.state === 'partial') ? <span className="block text-xs font-medium text-st-overdue">{t('invoice.daysPast', { n: formatDaySpan(r.daysLate) })}</span> : null;
  if (!r.payments.length) {
    if (r.paidPoisha > 0) return <>{late}<span className="text-xs text-fg-tertiary">{t('invoice.paidDateUnknown')}</span></>;
    return late ?? <span className="text-xs text-fg-tertiary">—</span>;
  }
  return (
    <div className="space-y-0.5">
      {late}
      <ul className="space-y-0.5">
        {r.payments.map((p, i) => (
          <li key={`${p.erpPaymentId}-${i}`} className="text-xs whitespace-nowrap text-fg-secondary">
            <span className="text-fg">{p.date ? formatDate(p.date) : '—'}</span>
            {p.receiptNo && <span className="ms-1.5 font-mono">{p.receiptNo}</span>}
            {r.payments.length > 1 && <span className="ms-1.5">{formatMoney(p.amountPoisha ?? 0)}</span>}
          </li>
        ))}
      </ul>
      {r.state === 'paid_late' && <span className="block text-xs text-fg-tertiary">{t('invoice.paidLate', { n: formatDaySpan(r.daysLate) })}</span>}
    </div>
  );
}

function ItemsCard({ plan }: { plan: Plan }) {
  const { t } = useTranslation('customers');
  const items = plan.items ?? [];
  if (!items.length) return null;
  const priced = items.some((i) => i.unitPricePoisha != null || i.lineTotalPoisha != null);
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('items')} />
      <ScrollBox label={t('items')}>
        <table className="w-full text-sm">
          <caption className="sr-only">{t('items')}</caption>
          <thead className="bg-surface-subtle text-xs text-fg-secondary">
            <tr>
              <th scope="col" className="px-4 py-2 text-start font-semibold">{t('product')}</th>
              <th scope="col" className="px-3 py-2 text-end font-semibold">{t('invoice.qty')}</th>
              {priced && <th scope="col" className="px-3 py-2 text-end font-semibold">{t('invoice.unitPrice')}</th>}
              {priced && <th scope="col" className="px-3 py-2 text-end font-semibold">{t('invoice.discount')}</th>}
              {priced && <th scope="col" className="px-4 py-2 text-end font-semibold">{t('invoice.lineTotal')}</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="px-4 py-2.5">
                  <span className="text-fg">{itemLabel({ ...it, qty: 1 })}</span>
                  {!!it.serials?.length && <span className="block font-mono text-xs break-all text-fg-tertiary">{t('serials', { list: it.serials.join(', ') })}</span>}
                  {(it.serviceChargePoisha ?? 0) > 0 && <span className="block text-xs text-fg-tertiary">{t('invoice.serviceCharge', { amount: formatMoney(it.serviceChargePoisha ?? 0) })}</span>}
                </td>
                <td className="tabular px-3 py-2.5 text-end">{formatNumber(it.qty ?? 1)}</td>
                {priced && <td className="px-3 py-2.5 text-end">{it.unitPricePoisha != null ? <MoneyText poisha={it.unitPricePoisha} /> : '—'}</td>}
                {priced && <td className="px-3 py-2.5 text-end">{(it.discountPoisha ?? 0) > 0 ? <MoneyText poisha={-(it.discountPoisha ?? 0)} /> : <span className="text-fg-tertiary">—</span>}</td>}
                {priced && <td className="px-4 py-2.5 text-end">{it.lineTotalPoisha != null ? <MoneyText poisha={it.lineTotalPoisha} className="font-medium" /> : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollBox>
    </Card>
  );
}

/** The invoice's money as the ERP keeps it, line by line, like a receipt. Nothing here is added up by the browser. */
function MoneyCard({ plan, credit, cash, pendingPoisha }: { plan: Plan; credit: boolean; cash: boolean; pendingPoisha: number }) {
  const { t } = useTranslation('customers');
  const rows: { label: string; poisha: number; strong?: boolean; sub?: boolean; minus?: boolean; tone?: string }[] = [];
  if (plan.subtotalPoisha != null) rows.push({ label: t('invoice.subtotal'), poisha: plan.subtotalPoisha });
  if ((plan.discountPoisha ?? 0) > 0) rows.push({ label: t('invoice.invoiceDiscount'), poisha: plan.discountPoisha!, minus: true });
  if ((plan.taxPoisha ?? 0) > 0) rows.push({ label: t('invoice.tax'), poisha: plan.taxPoisha! });
  rows.push({ label: t('invoice.total'), poisha: plan.totalPayablePoisha ?? 0, strong: true });
  if (!credit) {
    rows.push({ label: t('downPayment'), poisha: plan.downPaymentPoisha ?? 0 });
    if (plan.financedPoisha != null) rows.push({ label: t('invoice.financed'), poisha: plan.financedPoisha });
  }
  rows.push({ label: credit ? t('invoice.paidTotal') : t('invoice.paidWithDown'), poisha: plan.paidPoisha ?? 0 });
  if ((plan.writtenOffPoisha ?? 0) > 0) rows.push({ label: t('invoice.ofWhichWrittenOff'), poisha: plan.writtenOffPoisha!, sub: true });
  if ((plan.settlementDiscountPoisha ?? 0) > 0) rows.push({ label: t('invoice.ofWhichSettlement'), poisha: plan.settlementDiscountPoisha!, sub: true });
  if ((plan.refundedPoisha ?? 0) > 0) rows.push({ label: t('invoice.refunded'), poisha: plan.refundedPoisha! });
  rows.push({ label: t('invoice.leftErp'), poisha: plan.outstandingPoisha ?? 0, strong: true, tone: !cash && (plan.outstandingPoisha ?? 0) > 0 ? 'text-st-overdue' : undefined });
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('invoice.money')} />
      <dl className="divide-y divide-line text-sm">
        {rows.map((r, i) => (
          <div key={i} className={cn('flex items-baseline justify-between gap-3 px-4 py-2', r.sub && 'ps-8 text-fg-secondary', r.strong && 'bg-surface-subtle')}>
            <dt className={cn(r.strong ? 'font-semibold text-fg' : 'text-fg-secondary', r.sub && 'text-xs')}>{r.label}</dt>
            <dd className="tabular text-end">
              <MoneyText poisha={r.minus ? -r.poisha : r.poisha} className={cn(r.strong && 'font-semibold', r.sub && 'text-xs', r.tone)} />
            </dd>
          </div>
        ))}
      </dl>
      {pendingPoisha > 0 && (
        <div className="flex items-baseline justify-between gap-3 border-t border-line bg-st-pending-bg px-4 py-2 text-sm text-st-pending">
          <span>{t('invoice.pendingLabel')}</span>
          <MoneyText poisha={pendingPoisha} pending />
        </div>
      )}
      <p className="border-t border-line px-4 py-2 text-xs text-fg-tertiary">{t('invoice.erpNumbers')}</p>
    </Card>
  );
}

function TermsCard({ plan, today }: { plan: Plan; today: string }) {
  const { t } = useTranslation('customers');
  const freq = frequencyLabel(plan);
  const lines = (plan.schedule ?? []).filter((l) => !l.rolled);
  const usual = usualInstallment(plan);
  const pct = penaltyPercent(plan.penalty?.rate);
  const missed = missedOf(plan, today);
  const next = stateOf(plan) === 'open' ? nextDue(plan, today) : null;
  const items: [string, React.ReactNode][] = [
    [t('invoice.count'), formatNumber(plan.installmentCount ?? lines.length)],
    [t('invoice.every'), freq ? t(freq.key, { n: formatNumber(freq.n ?? 0) }) : '—'],
    [t('invoice.usual'), usual != null ? <MoneyText poisha={usual} /> : '—'],
    [t('invoice.first'), lines[0]?.dueDate ? formatDate(lines[0].dueDate) : '—'],
    [t('finalDue'), plan.finalDueDate ? formatDate(plan.finalDueDate) : '—'],
    [t('invoice.lateFee'), plan.penalty ? (plan.penalty.enabled ? (pct != null ? t('invoice.lateFeeRate', { rate: formatNumber(pct, { decimals: pct % 1 ? 2 : 0 }) }) : t('invoice.lateFeeOn')) : t('invoice.lateFeeOff')) : '—'],
    [t('invoice.missed'), missed ? <span className="font-medium text-st-overdue">{t('invoice.missedDays', { n: formatNumber(missed), days: formatDaySpan(plan.daysOverdue ?? 0) })}</span> : formatNumber(0)],
    [t('invoice.next'), next ? `${formatDate(next.date)} · ${formatMoney(next.amountPoisha)}` : '—'],
  ];
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('invoice.terms')} />
      <dl className="divide-y divide-line text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 px-4 py-2">
            <dt className="text-fg-secondary">{label}</dt>
            <dd className="tabular text-end text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function PaymentsCard({ c, plan, rows, returned }: { c: CustomerDetail; plan: Plan; rows: LineVM[]; returned?: boolean }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  // a returned invoice carries its own payments (1.53.0); the others are found in the customer's payment list
  const list = returned ? returnedPaymentsOf(plan) : (c.payments ?? []).filter((p) => p.erpPlanId === plan.erpPlanId && !p.returned);
  const bySeq = linesByPayment(rows);
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('invoice.payments')} subtitle={list.length ? t('invoice.nPayments', { n: formatNumber(list.filter((p) => !p.reversed).length) }) : undefined} />
      {!list.length ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-fg-tertiary">
          <Receipt className="size-4 shrink-0" aria-hidden />
          {t('invoice.noPayments')}
        </p>
      ) : (
        <ScrollBox label={t('invoice.payments')}>
          <table className="w-full text-sm">
            <caption className="sr-only">{t('invoice.payments')}</caption>
            <thead className="bg-surface-subtle text-xs text-fg-secondary">
              <tr>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('invoice.payDate')}</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">{t('payments.receipt')}</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">{t('payments.method')}</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">{t('invoice.forLines')}</th>
                <th scope="col" className="px-4 py-2 text-end font-semibold">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const seqs = bySeq.get(p.erpPaymentId ?? '') ?? [];
                return (
                  <tr key={p.erpPaymentId} className="border-t border-line align-top">
                    <td className="px-4 py-2 whitespace-nowrap">{p.date ? formatDate(p.date) : '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {p.receiptNo}
                      {p.reversed && <Badge tone="danger" className="ms-1">{t('payments.reversed')}</Badge>}
                      {p.advance && <Badge tone="info" icon={false} className="ms-1">{t('payments.advance')}</Badge>}
                      {p.returned && <StatusBadge status="returned_payment" className="ms-1" testId="returned-payment-tag" />}
                    </td>
                    <td className="px-3 py-2">
                      {tc(`method.${p.method}`, { defaultValue: p.method })}
                      {p.collectorName && <span className="block text-xs text-fg-tertiary">{t('payments.collector', { name: p.collectorName })}</span>}
                      {p.referrerName && p.referrerName !== p.collectorName && <span className="block text-xs text-fg-tertiary">{t('payments.referrer', { name: p.referrerName })}</span>}
                    </td>
                    <td className="px-3 py-2 text-fg-secondary">{seqs.length ? t('invoice.lineList', { list: seqs.map((n) => formatNumber(n)).join(', ') }) : '—'}</td>
                    <td className="px-4 py-2 text-end">
                      <MoneyText poisha={p.amountPoisha ?? 0} className={p.reversed ? 'font-medium text-fg-tertiary line-through' : 'font-medium'} />
                      {(p.discountPoisha ?? 0) > 0 && <span className="block text-xs whitespace-nowrap text-fg-tertiary">{t('payments.discount', { amount: formatMoney(p.discountPoisha ?? 0) })}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollBox>
      )}
    </Card>
  );
}

function GuarantorCard({ plan }: { plan: Plan }) {
  const { t } = useTranslation('customers');
  const g = plan.guarantor;
  if (!g?.name) return null;
  return (
    <Card className="p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-secondary">
        <UserRound className="size-4" aria-hidden />
        {t('planGuarantor')}
      </h3>
      <p className="text-base text-fg">{g.name}</p>
      {guarantorPhones(g).map((p) => (
        <a key={p} href={`tel:${p}`} className="me-3 font-mono text-sm text-fg-secondary hover:text-primary">{p}</a>
      ))}
      {g.address && <p className="mt-1 text-sm text-fg-tertiary">{g.address}</p>}
    </Card>
  );
}
