'use client';
import { useTranslation } from 'react-i18next';
import { Banknote, CloudUpload, Footprints, Handshake, HeartCrack, MapPin, MapPinOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { Tooltip } from '@/shared/ui/primitives';
import { toneClass, type Tone } from '@/shared/ui/status';
import type { CustomerDetail, CustomerListItem } from '../api/customers';
import { workMarks } from '../model/activity';

/**
 * FR-W-037: four small marks on every customer row, in every filter: visited, paid, promised (this month) and
 * whether the map pin is set. A mark that is "on" has its status colour and icon; one that is "off" is a grey
 * outline. Each has a text label for screen readers and a tooltip with the numbers (never colour alone).
 */
export function WorkMarks({ c, className }: { c: CustomerListItem; className?: string }) {
  const { t } = useTranslation('customers');
  useUi((s) => s.bnDigits);
  const m = workMarks(c);
  const a = c.activity;
  const visit = m.visit === 'today' ? t('marks.visitToday') : m.visit === 'month' ? t('marks.visitMonth', { n: formatNumber(a?.visitCount ?? 0) }) : t('marks.visitNone');
  const paid = m.paid === 'paid' ? t('marks.paid', { amount: formatMoney(a?.paidPoisha ?? 0) }) : m.paid === 'pending' ? t('marks.pending', { amount: formatMoney(a?.pendingPoisha ?? 0) }) : t('marks.paidNone');
  const promise =
    m.promise === 'open'
      ? t('marks.promiseOpen', { date: c.openPromise?.promisedDate ? formatDate(c.openPromise.promisedDate, { withYear: false }) : '' })
      : m.promise === 'broken'
        ? t('marks.promiseBroken')
        : m.promise === 'kept'
          ? t('marks.promiseKept')
          : t('marks.promiseNone');
  return (
    <span className={cn('inline-flex items-center gap-1', className)} data-testid="work-marks">
      {m.known && (
        <>
          <Mark on={!!m.visit} tone={m.visit === 'today' ? 'success' : 'info'} icon={Footprints} label={visit} kind="visit" />
          <Mark on={!!m.paid} tone={m.paid === 'pending' ? 'pending' : 'paid'} icon={m.paid === 'pending' ? CloudUpload : Banknote} label={paid} kind="paid" />
          <Mark on={!!m.promise} tone={m.promise === 'broken' ? 'danger' : m.promise === 'kept' ? 'success' : 'promised'} icon={m.promise === 'broken' ? HeartCrack : Handshake} label={promise} kind="promise" />
        </>
      )}
      <Mark on tone={m.pin ? 'success' : 'danger'} icon={m.pin ? MapPin : MapPinOff} label={t(m.pin ? 'marks.pinSet' : 'marks.pinMissing')} kind="pin" />
    </span>
  );
}

function Mark({ on, tone, icon: Icon, label, kind }: { on: boolean; tone: Tone; icon: LucideIcon; label: string; kind: string }) {
  return (
    <Tooltip content={label}>
      <span
        tabIndex={0}
        data-mark={kind}
        data-on={on}
        className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-xs focus-visible:outline-2 focus-visible:outline-primary', on ? toneClass[tone] : 'border border-dashed border-line-strong text-fg-disabled')}
      >
        <Icon className="size-3.5" aria-hidden strokeWidth={2.25} />
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

/** The key under the list header: which icon is which. */
export function WorkMarksLegend() {
  const { t } = useTranslation('customers');
  const items: [LucideIcon, string][] = [
    [Footprints, t('marks.legend.visit')],
    [Banknote, t('marks.legend.paid')],
    [Handshake, t('marks.legend.promise')],
    [MapPin, t('marks.legend.pin')],
  ];
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-secondary" data-testid="work-marks-legend">
      <span className="font-medium">{t('marks.legend.title')}</span>
      {items.map(([Icon, label]) => (
        <span key={label} className="inline-flex items-center gap-1">
          <Icon className="size-3.5 text-fg-tertiary" aria-hidden />
          {label}
        </span>
      ))}
    </p>
  );
}

/**
 * FR-W-037: "this month" on the customer page and drawer: visits, ERP money, field money still waiting for the ERP
 * (its own number, never added to the ERP money), promises, and how many invoices the customer has.
 */
export function MonthActivity({ c, className }: { c: CustomerDetail; className?: string }) {
  const { t } = useTranslation('customers');
  useUi((s) => s.bnDigits);
  const a = c.activity;
  if (!a) return null;
  const cells: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: string }[] = [
    {
      label: t('month.visits'),
      value: a.visitCount > 0 ? t('month.visitsN', { n: formatNumber(a.visitCount) }) : t('month.none'),
      note: a.visitedToday ? t('month.visitedToday') : a.lastVisitAt ? t('month.lastOn', { date: formatDate(a.lastVisitAt, { withYear: false }) }) : undefined,
      tone: a.visitedToday ? 'text-success' : undefined,
    },
    {
      label: t('month.paid'),
      value: a.paidPoisha > 0 ? formatMoney(a.paidPoisha) : t('month.none'),
      note: a.lastPaidDate ? t('month.lastOn', { date: formatDate(a.lastPaidDate, { withYear: false }) }) : undefined,
      tone: a.paidPoisha > 0 ? 'text-st-paid' : undefined,
    },
    {
      label: t('month.pending'),
      value: a.pendingPoisha > 0 ? formatMoney(a.pendingPoisha) : '—',
      note: a.pendingPoisha > 0 ? t('month.pendingNote') : undefined,
      tone: a.pendingPoisha > 0 ? 'text-st-pending' : undefined,
    },
    {
      label: t('month.promises'),
      value: c.openPromise ? t('month.promiseOpen') : a.promisesMade + a.promisesKept + a.promisesBroken > 0 ? t('month.promisesN', { n: formatNumber(a.promisesMade) }) : t('month.none'),
      note: [a.promisesKept > 0 ? t('month.kept', { n: formatNumber(a.promisesKept) }) : null, a.promisesBroken > 0 ? t('month.broken', { n: formatNumber(a.promisesBroken) }) : null].filter(Boolean).join(' · ') || undefined,
      tone: a.promisesBroken > 0 && !c.openPromise ? 'text-danger' : undefined,
    },
  ];
  return (
    <section aria-label={t('month.title')} className={className} data-testid="month-activity">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg-secondary">{t('month.title')}</h3>
        {c.invoiceCount && (
          <span className="text-xs text-fg-secondary">{t('month.invoices', { total: formatNumber(c.invoiceCount.total ?? 0), open: formatNumber(c.invoiceCount.open ?? 0) })}</span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4 [&>*]:bg-surface">
        {cells.map((x) => (
          <div key={x.label} className="px-3 py-2.5">
            <dt className="text-xs font-medium text-fg-tertiary">{x.label}</dt>
            <dd className={cn('tabular mt-0.5 text-base font-semibold text-fg', x.tone)}>{x.value}</dd>
            {x.note && <dd className="text-xs text-fg-tertiary">{x.note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
