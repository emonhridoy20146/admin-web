'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, FileText, Flag, Gauge, MapPin, MapPinOff, MapPinPlus, MapPinned, Phone, Signpost, StickyNote, UserPen, UserPlus, UserRound } from 'lucide-react';
import { AssignCustomerDialog } from '@/features/assignments';
import { useGate } from '@/shared/feature/useGate';
import { useUrlState } from '@/shared/lib/url-state';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatNumber, formatRelative, formatPercent, pickText, formatDaySpan } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { MoneyText } from '@/shared/ui/money';
import { Badge, StatusBadge, StatusBadges } from '@/shared/ui/badge';
import { EmptyState } from '@/shared/ui/feedback';
import type { components } from '@/shared/api/schema';
import { sortStatuses } from '../model/customer-row';
import { currentPin } from '../model/pin';
import { frequencyLabel, guarantorPhones, isCashLike, isCollectable, itemLabel, rolledCount, visibleLines } from '../model/plan';
import type { CustomerDetail } from '../api/customers';
import { CustomerPhones } from './customer-phones';
import { SetPinDialog } from './set-pin-dialog';
import { DeletePinDialog } from './delete-pin-dialog';

type Plan = components['schemas']['Plan'];

export function CustomerTitle({ c, size = 'md' }: { c: CustomerDetail; size?: 'md' | 'lg' }) {
  const locale = useUi((s) => s.locale);
  const main = pickText(c.name, locale);
  const alt = locale === 'bn' ? c.name?.en : c.name?.bn;
  return (
    <div className="min-w-0">
      <div className={cn('truncate font-semibold tracking-tight text-fg', size === 'lg' ? 'text-xl lg:text-2xl' : 'text-md')} lang={locale}>{main}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-fg-tertiary">
        {alt && <span lang={locale === 'bn' ? 'en' : 'bn'}>{alt}</span>}
        <span aria-hidden>·</span>
        <span className="font-mono text-xs">{c.code}</span>
      </div>
    </div>
  );
}

/** Key figures. ERP outstanding and pending field money are never summed (CLAUDE.md §2.6). */
export function CustomerFigures({ c, className }: { c: CustomerDetail; className?: string }) {
  const { t } = useTranslation('customers');
  const items = [
    {
      label: t('outstanding'),
      value: (
        <>
          <MoneyText poisha={c.totalOutstandingPoisha ?? 0} className="text-lg font-semibold" />
          {(c.overduePoisha ?? 0) > 0 && <span className="block text-xs text-st-overdue">{t('overdueAmount', { amount: formatMoney(c.overduePoisha ?? 0) })}</span>}
        </>
      ),
      emphasis: (c.daysOverdue ?? 0) > 0 },
    { label: t('col.daysOverdue'), value: (c.daysOverdue ?? 0) > 0 ? <span className="text-lg font-semibold text-st-overdue">{t('days', { n: formatDaySpan(c.daysOverdue ?? 0) })}</span> : <span className="text-lg font-semibold text-fg-tertiary">—</span> },
    {
      label: t('col.nextDue'),
      value: (
        <>
          <span className="text-lg font-semibold">{c.nextDueDate ? formatDate(c.nextDueDate, { withYear: false }) : '—'}</span>
          {c.installmentPoisha != null && <span className="block text-xs text-fg-tertiary">{t('installmentOf', { amount: formatMoney(c.installmentPoisha) })}</span>}
        </>
      ),
    },
    { label: t('col.pending'), value: (c.pendingFieldPoisha ?? 0) > 0 ? <MoneyText poisha={c.pendingFieldPoisha ?? 0} pending className="text-lg font-semibold" /> : <span className="text-lg font-semibold text-fg-tertiary">—</span> },
  ];
  return (
    <dl className={cn('grid grid-cols-2 overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4 [&>*]:bg-surface', 'gap-px', className)}>
      {items.map((it, i) => (
        <div key={i} className="px-4 py-3">
          <dt className="text-xs font-medium text-fg-tertiary">{it.label}</dt>
          <dd className="tabular mt-1">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CustomerStatusRow({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadges statuses={sortStatuses(c.badges ?? [])} max={4} />
      {c.tag?.state === 'tagged' && c.tag.severity && c.tag.severity !== 'bad' && <Badge tone="neutral" icon={Flag}>{t(`severity.${c.tag.severity}`)}</Badge>}
      <ErpRiskBadge c={c} />
      {c.openPromise && (
        <Badge tone="promised">{t('promiseOn', { date: formatDate(c.openPromise.promisedDate, { withYear: false }), amount: formatMoney(c.openPromise.promisedAmountPoisha) })}</Badge>
      )}
    </div>
  );
}

/** The ERP's own risk grade (read-only), shown next to FOS tags; it is not a FOS tag. */
function ErpRiskBadge({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  const r = c.erpRisk;
  if (!r?.grade || r.grade === 'N/A') return null;
  const level = (r.level ?? '').toLowerCase();
  const tone = level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'neutral';
  const label = t('erpRisk.badge', { grade: r.grade });
  const detail = [
    level ? t(`erpRisk.level.${level}`, { defaultValue: r.level }) : null,
    r.overdueCount ? t('erpRisk.overdue', { n: formatNumber(r.overdueCount) }) : null,
    r.maxDaysLate ? t('erpRisk.maxLate', { n: formatDaySpan(r.maxDaysLate) }) : null,
    r.computedAt ? t('erpRisk.asOf', { date: formatDate(r.computedAt) }) : null,
  ].filter(Boolean).join(' · ');
  return (
    <span title={detail} className="inline-flex">
      <Badge tone={tone} icon={Gauge}>{label}</Badge>
      <span className="sr-only">{detail}</span>
    </span>
  );
}

export function BadSuggestionCallout({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  if (!c.badSuggestion || c.tag?.state === 'tagged') return null;
  return (
    <div className="flex gap-3 rounded-md border border-dashed border-st-bad-suggested bg-st-bad-suggested-bg px-4 py-3 text-st-bad-suggested">
      <Flag className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">{t('badSuggestion')}</p>
        <p className="mt-0.5 text-fg-secondary">
          {t('badSuggestionBody', { plan: c.plans?.find((p) => p.erpPlanId === c.badSuggestion?.erpPlanId)?.invoiceNo ?? c.badSuggestion.erpPlanId, date: formatDate(c.badSuggestion.finalDueDate!), amount: formatMoney(c.badSuggestion.outstandingPoisha ?? 0) })}
        </p>
      </div>
    </div>
  );
}

export function PendingCallout({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  if (!(c.pendingFieldPoisha ?? 0)) return null;
  return (
    <div className="flex gap-3 rounded-md border border-line bg-st-pending-bg px-4 py-3 text-sm text-st-pending">
      <CloudUpload className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{t('pendingNote', { amount: formatMoney(c.pendingFieldPoisha ?? 0) })}</p>
    </div>
  );
}

export function ContactCard({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  const locale = useUi((s) => s.locale);
  const hasLoc = !!currentPin(c);
  return (
    <dl className="space-y-3 text-base">
      <Item icon={Phone} label={t('phones')}>
        <CustomerPhones c={c} />
      </Item>
      <Item icon={MapPin} label={t('address')}>
        {c.areaName && <span className="block font-medium" lang={locale}>{pickText(c.areaName, locale)}</span>}
        <span>{c.address}</span>
        {c.detailedAddress && c.detailedAddress !== c.address && <span className="block text-sm text-fg-secondary">{c.detailedAddress}</span>}
        <span className={cn('mt-0.5 block text-xs', hasLoc ? 'text-fg-tertiary' : 'text-warning')}>
          {hasLoc ? `${c.location!.lat!.toFixed(5)}, ${c.location!.lng!.toFixed(5)}` : t('locationMissing')}
        </span>
        <PinAction c={c} hasLoc={hasLoc} />
      </Item>
      {c.directions && (
        <Item icon={Signpost} label={t('directions')}>
          <span className="text-sm" lang={/[ঀ-৿]/.test(c.directions) ? 'bn' : 'en'}>{c.directions}</span>
        </Item>
      )}
      <Item icon={UserRound} label={t('assignedTo')}>
        <span className={c.assignee?.name ? undefined : 'text-warning'}>{c.assignee?.name ?? t('nobodyAssigned')}</span>
        <AssignAction c={c} />
      </Item>
      {c.guarantor?.name && (
        <Item icon={UserRound} label={t('guarantor')}>
          {c.guarantor.name} <span className="font-mono text-sm text-fg-tertiary">{c.guarantor.phone}</span>
        </Item>
      )}
    </dl>
  );
}
/** FR-CUS-011: managers set or move the pin on a map. `?action=pin` (from the data-quality list) opens it directly. */
function PinAction({ c, hasLoc }: { c: CustomerDetail; hasLoc: boolean }) {
  const { t } = useTranslation('customers');
  const gate = useGate();
  const url = useUrlState();
  const [open, setOpen] = useState(() => url.get('action') === 'pin');
  const [deleting, setDeleting] = useState(false);
  if (!gate.can('customer.location.approve')) return null;
  const Icon = hasLoc ? MapPinned : MapPinPlus;
  return (
    <div className="flex flex-wrap items-center gap-x-4">
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline sm:min-h-8">
        <Icon className="size-4" aria-hidden />
        {hasLoc ? t('setPin.openMove') : t('setPin.openNew')}
      </button>
      {hasLoc && (
        <button type="button" onClick={() => setDeleting(true)} className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-danger hover:underline sm:min-h-8">
          <MapPinOff className="size-4" aria-hidden />
          {t('deletePin.open')}
        </button>
      )}
      <SetPinDialog open={open} customer={c} onClose={() => (setOpen(false), url.get('action') && url.set({ action: null }))} />
      {hasLoc && <DeletePinDialog open={deleting} customer={c} onClose={() => setDeleting(false)} />}
    </div>
  );
}

/** FR-ASG-002: give this one customer to a staff member. `?action=assign` opens it directly. */
function AssignAction({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  const gate = useGate();
  const url = useUrlState();
  const [open, setOpen] = useState(() => url.get('action') === 'assign');
  if (!gate.can('assignment.manage') || !gate.flag('module.assignments')) return null;
  const Icon = c.assignee?.id ? UserPen : UserPlus;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline sm:min-h-8">
        <Icon className="size-4" aria-hidden />
        {c.assignee?.id ? t('assign.change') : t('assign.open')}
      </button>
      <AssignCustomerDialog open={open} customer={c} onClose={() => (setOpen(false), url.get('action') && url.set({ action: null }))} />
    </>
  );
}

function Item({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-fg-tertiary" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-fg-tertiary">{label}</dt>
        <dd className="text-fg">{children}</dd>
      </div>
    </div>
  );
}

/** `onOpen` adds a link to the full invoice view (FR-W-028). */
export function PlanCard({ plan, showSchedule, onOpen }: { plan: Plan; showSchedule?: boolean; onOpen?: () => void }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const total = plan.totalPayablePoisha ?? 0;
  const paidPct = total ? (plan.paidPoisha ?? 0) / total : 0;
  const sched = visibleLines(plan);
  const rolled = rolledCount(plan);
  const credit = plan.kind === 'credit';
  const cash = isCashLike(plan);
  const collectable = isCollectable(plan);
  const freq = frequencyLabel(plan);
  const written = plan.writtenOffPoisha ?? 0;
  const gPhones = guarantorPhones(plan.guarantor);
  return (
    <div className={cn('overflow-hidden rounded-md border border-line bg-surface', !collectable && 'bg-surface-subtle')}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-base font-semibold', collectable ? 'text-fg' : 'text-fg-secondary')}>{plan.product}</span>
            {credit && <Badge tone="info" icon={false}>{t('kind.credit')}</Badge>}
            {cash && <Badge tone="neutral" icon={false}>{t('kind.cash')}</Badge>}
            {plan.badSuggested && <StatusBadge status="bad_suggested" />}
            {plan.status === 'completed' && <StatusBadge status="paid_up" />}
            {plan.status === 'defaulted' && <Badge tone="danger">{t('planStatus.defaulted')}</Badge>}
            {!collectable && !cash && <Badge tone="neutral">{t(`planStatus.${plan.status}`)}</Badge>}
          </div>
          <div className="mt-0.5 text-sm text-fg-tertiary">
            <span className="font-mono text-xs">{plan.invoiceNo ?? plan.erpPlanId}</span>
            {cash ? (
              <>{(plan.saleDate ?? plan.startDate) && <> · {t('invoice.soldOn', { date: formatDate((plan.saleDate ?? plan.startDate)!) })}</>} · {t('invoice.nothingDue')}</>
            ) : credit ? (
              <> · {t('creditDue', { date: formatDate(plan.finalDueDate!) })}</>
            ) : (
              <>
                {' '}· {t('installments', { n: formatNumber(sched.length || (plan.installmentCount ?? 0)) })}
                {freq && <> · {t(freq.key, { n: formatNumber(freq.n ?? 0) })}</>} · {t('started')} {formatDate((plan.saleDate ?? plan.startDate)!)} · {t('finalDue')} {formatDate(plan.finalDueDate!)}
              </>
            )}
          </div>
          {!collectable && !cash && <p className="mt-1 text-xs text-fg-secondary">{t('notCollectable')}</p>}
        </div>
        <div className="text-end">
          <div className="text-xs text-fg-tertiary">{t('outstanding')}</div>
          {cash ? <span className="text-md font-semibold text-fg-secondary">{t('invoice.nothingDue')}</span> : <MoneyText poisha={plan.outstandingPoisha ?? 0} className="text-md font-semibold" />}
          {onOpen && (
            <button type="button" onClick={onOpen} className="mt-1 flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline sm:min-h-8">
              <FileText className="size-4" aria-hidden />
              {t('invoice.openFull')}
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-label={`${t('paid')} ${formatPercent(paidPct)}`} role="img">
          {sched.map((s) => (
            <span
              key={s.seq}
              className={cn('h-full flex-1 first:rounded-s-full last:rounded-e-full', s.status === 'paid' ? 'bg-st-paid' : s.status === 'partial' ? 'bg-st-due-today' : s.status === 'overdue' ? 'bg-st-overdue' : s.status === 'due' ? 'bg-primary' : 'bg-surface-hover')}
              title={`${formatNumber(s.seq ?? 0)} · ${formatDate(s.dueDate!)} · ${tc(`status.${s.status}`)}`}
            />
          ))}
        </div>
        <dl className={cn('mt-3 grid gap-2 text-sm', written > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
          <div>
            <dt className="text-xs text-fg-tertiary">{t('totalPayable')}</dt>
            <dd><MoneyText poisha={total} /></dd>
          </div>
          <div>
            <dt className="text-xs text-fg-tertiary">{t('downPayment')}</dt>
            <dd><MoneyText poisha={plan.downPaymentPoisha ?? 0} /></dd>
          </div>
          <div>
            <dt className="text-xs text-fg-tertiary">{t('paid')} · {formatPercent(paidPct)}</dt>
            <dd><MoneyText poisha={plan.paidPoisha ?? 0} /></dd>
          </div>
          {written > 0 && (
            <div>
              <dt className="text-xs text-fg-tertiary">{t('writtenOff')}</dt>
              <dd><MoneyText poisha={written} /></dd>
            </div>
          )}
        </dl>
      </div>
      {showSchedule && (!!plan.items?.length || !!plan.guarantor?.name) && (
        <dl className="grid gap-3 border-t border-line px-4 py-3 text-sm sm:grid-cols-2">
          {!!plan.items?.length && (
            <div className="min-w-0">
              <dt className="text-xs text-fg-tertiary">{t('items')}</dt>
              <dd>
                <ul className="space-y-1">
                  {plan.items.map((it, i) => (
                    <li key={i} className="min-w-0">
                      <span className="text-fg">{itemLabel(it)}</span>
                      {!!it.serials?.length && <span className="block truncate font-mono text-xs text-fg-tertiary">{t('serials', { list: it.serials.join(', ') })}</span>}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {plan.guarantor?.name && (
            <div className="min-w-0">
              <dt className="text-xs text-fg-tertiary">{t('planGuarantor')}</dt>
              <dd className="text-fg">
                {plan.guarantor.name}
                {gPhones.map((p) => (
                  <a key={p} href={`tel:${p}`} className="ms-2 font-mono text-sm text-fg-tertiary hover:text-primary">{p}</a>
                ))}
                {plan.guarantor.address && <span className="block text-xs text-fg-tertiary">{plan.guarantor.address}</span>}
              </dd>
            </div>
          )}
        </dl>
      )}
      {showSchedule && sched.length > 0 && (
        <div className="scrollbar-thin overflow-x-auto border-t border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('schedule')}</caption>
            <thead className="bg-surface-subtle text-xs text-fg-secondary">
              <tr>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('seq')}</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">{t('dueDate')}</th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">{t('amount')}</th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">{t('paidAmount')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {sched.map((s) => (
                <tr key={s.seq} className={cn('border-t border-line', s.status === 'overdue' && 'bg-st-overdue-bg/40')}>
                  <td className="tabular px-4 py-2 text-fg-tertiary">{formatNumber(s.seq ?? 0)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(s.dueDate!)}
                    {s.estimated && <span className="ms-1 text-xs text-fg-tertiary">({t('estimated')})</span>}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <MoneyText poisha={s.amountPoisha ?? 0} />
                    {(s.lateFeePoisha ?? 0) > 0 && <span className="block text-xs whitespace-nowrap text-fg-tertiary">{t('lateFeeIncl', { amount: formatMoney(s.lateFeePoisha ?? 0) })}</span>}
                  </td>
                  <td className="px-3 py-2 text-end"><MoneyText poisha={s.paidPoisha ?? 0} className={(s.paidPoisha ?? 0) === 0 ? 'text-fg-tertiary' : ''} /></td>
                  <td className="px-4 py-2"><StatusBadge status={s.status ?? 'upcoming'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rolled > 0 && <p className="border-t border-line px-4 py-2 text-xs text-fg-tertiary">{t('rolledHidden', { n: formatNumber(rolled) })}</p>}
        </div>
      )}
    </div>
  );
}

export function NotesList({ notes, limit }: { notes: CustomerDetail['recentNotes']; limit?: number }) {
  const { t } = useTranslation('customers');
  const list = (notes ?? []).slice(0, limit);
  if (!list.length) return <EmptyState icon={StickyNote} title={t('notes.empty')} className="py-8" />;
  return (
    <ul className="space-y-3">
      {list.map((n) => (
        <li key={n.id} className="rounded-md border border-line bg-surface px-4 py-3">
          <p className="text-base text-fg" lang={/[ঀ-৿]/.test(n.text ?? '') ? 'bn' : 'en'}>{n.text}</p>
          <p className="mt-1.5 text-xs text-fg-tertiary">
            {n.author?.name} · {formatRelative(n.createdAt!)} {n.category && <span className="ms-1 rounded-xs bg-surface-hover px-1.5 py-0.5">{n.category}</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}
