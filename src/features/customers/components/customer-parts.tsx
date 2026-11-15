'use client';
import { useTranslation } from 'react-i18next';
import { CloudUpload, Flag, MapPin, Phone, StickyNote, UserRound } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatNumber, formatRelative, formatPercent, pickText } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { MoneyText } from '@/shared/ui/money';
import { Badge, StatusBadge, StatusBadges } from '@/shared/ui/badge';
import { EmptyState } from '@/shared/ui/feedback';
import type { components } from '@/shared/api/schema';
import { sortStatuses } from '../model/customer-row';
import type { CustomerDetail } from '../api/customers';

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
    { label: t('outstanding'), value: <MoneyText poisha={c.totalOutstandingPoisha ?? 0} className="text-lg font-semibold" />, emphasis: (c.daysOverdue ?? 0) > 0 },
    { label: t('col.daysOverdue'), value: (c.daysOverdue ?? 0) > 0 ? <span className="text-lg font-semibold text-st-overdue">{t('days', { n: formatNumber(c.daysOverdue ?? 0) })}</span> : <span className="text-lg font-semibold text-fg-tertiary">—</span> },
    { label: t('col.nextDue'), value: <span className="text-lg font-semibold">{c.nextDueDate ? formatDate(c.nextDueDate, { withYear: false }) : '—'}</span> },
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
      {c.openPromise && (
        <Badge tone="promised">{t('promiseOn', { date: formatDate(c.openPromise.promisedDate, { withYear: false }), amount: formatMoney(c.openPromise.promisedAmountPoisha) })}</Badge>
      )}
    </div>
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
          {t('badSuggestionBody', { plan: c.badSuggestion.erpPlanId, date: formatDate(c.badSuggestion.finalDueDate!), amount: formatMoney(c.badSuggestion.outstandingPoisha ?? 0) })}
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
  const hasLoc = c.location?.status === 'ok' && c.location.lat != null;
  return (
    <dl className="space-y-3 text-base">
      <Item icon={Phone} label={t('phones')}>
        <span className="flex flex-col">
          {(c.phones?.length ? c.phones : [c.phone]).filter(Boolean).map((p) => (
            <a key={p} href={`tel:${p}`} className="tabular font-mono text-sm text-fg hover:text-primary">{p}</a>
          ))}
        </span>
      </Item>
      <Item icon={MapPin} label={t('address')}>
        <span>{c.address}</span>
        <span className={cn('mt-0.5 block text-xs', hasLoc ? 'text-fg-tertiary' : 'text-warning')}>
          {hasLoc ? `${c.location!.lat!.toFixed(5)}, ${c.location!.lng!.toFixed(5)}` : t('locationMissing')}
        </span>
      </Item>
      <Item icon={UserRound} label={t('assignedTo')}>{c.assignee?.name ?? '—'}</Item>
      {c.guarantor?.name && (
        <Item icon={UserRound} label={t('guarantor')}>
          {c.guarantor.name} <span className="font-mono text-sm text-fg-tertiary">{c.guarantor.phone}</span>
        </Item>
      )}
    </dl>
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

export function PlanCard({ plan, showSchedule }: { plan: Plan; showSchedule?: boolean }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const total = plan.totalPayablePoisha ?? 0;
  const paidPct = total ? (plan.paidPoisha ?? 0) / total : 0;
  const sched = plan.schedule ?? [];
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-fg">{plan.product}</span>
            {plan.badSuggested && <StatusBadge status="bad_suggested" />}
            {plan.status === 'completed' && <StatusBadge status="paid_up" />}
          </div>
          <div className="mt-0.5 text-sm text-fg-tertiary">
            <span className="font-mono text-xs">{plan.erpPlanId}</span> · {t('installments', { n: formatNumber(plan.installmentCount ?? 0) })} · {t('started')} {formatDate(plan.startDate!)} · {t('finalDue')} {formatDate(plan.finalDueDate!)}
          </div>
        </div>
        <div className="text-end">
          <div className="text-xs text-fg-tertiary">{t('outstanding')}</div>
          <MoneyText poisha={plan.outstandingPoisha ?? 0} className="text-md font-semibold" />
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
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
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
        </dl>
      </div>
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
                  <td className="px-3 py-2 text-end"><MoneyText poisha={s.amountPoisha ?? 0} /></td>
                  <td className="px-3 py-2 text-end"><MoneyText poisha={s.paidPoisha ?? 0} className={(s.paidPoisha ?? 0) === 0 ? 'text-fg-tertiary' : ''} /></td>
                  <td className="px-4 py-2"><StatusBadge status={s.status ?? 'upcoming'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
