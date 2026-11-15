'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowRight, Handshake } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, DescList } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import { Segmented } from '@/shared/ui/primitives';
import { Select } from '@/shared/ui/form';
import { MoneyText } from '@/shared/ui/money';
import { Button } from '@/shared/ui/button';
import { Drawer } from '@/shared/ui/overlay';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useCancelPromise, usePromises, type PromiseItem } from '../api/promises';
import { canCancel, daysTo, isLate, paidRatio, STATUSES, windowFor, WINDOWS } from '../model/promise';

const TONE: Record<string, Tone> = { open: 'promised', kept: 'paid', partially_kept: 'dueToday', broken: 'danger', superseded: 'neutral', cancelled: 'neutral' };

export function PromisesPage() {
  const { t } = useTranslation('promises');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canManage = useCan('promise.create');
  const url = useUrlState();
  const today = todayDhaka();
  const win = oneOf(url.get('when'), WINDOWS, 'today');
  const status = oneOf(url.get('status'), ['', ...STATUSES] as const, '');
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const q = usePromises({ ...windowFor(win, today), status: status || undefined, cursor: cursor || undefined, limit });
  const openId = url.get('drawer');
  const open = q.data?.items.find((p) => p.id === openId) ?? null;
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancel = useCancelPromise();

  const when = (p: PromiseItem) => {
    const d = daysTo(p.promisedDate, today);
    const late = isLate(p, today);
    return (
      <span className="inline-flex flex-col">
        <span className="tabular">{formatDate(p.promisedDate, { withYear: false })}</span>
        <span className={cn('text-xs', late ? 'font-medium text-st-overdue' : 'text-fg-tertiary')}>
          {d === 0 ? t('rel.today') : d > 0 ? t('rel.in', { n: formatNumber(d) }) : t('rel.ago', { n: formatNumber(-d) })}
        </span>
      </span>
    );
  };

  const columns: Column<PromiseItem>[] = [
    {
      id: 'customer',
      header: t('col.customer'),
      priority: 1,
      mobile: 'title',
      cell: (p) => (
        <button type="button" onClick={() => url.set({ drawer: p.id ?? null }, { push: true })} className="block min-w-0 text-start">
          <span className="block max-w-[240px] truncate font-medium text-fg hover:text-primary" lang={locale}>{pickText(p.customer?.name, locale)}</span>
          <span className="block font-mono text-xs text-fg-tertiary">{p.customer?.code}</span>
        </button>
      ),
    },
    {
      id: 'amount',
      header: t('col.amount'),
      align: 'end',
      priority: 1,
      mobile: 'amount',
      cell: (p) => (
        <span className="inline-flex flex-col items-end">
          <MoneyText poisha={p.promisedAmountPoisha} className="font-medium" />
          {(p.paidTowardsPoisha ?? 0) > 0 && <span className="text-xs text-st-paid">{t('paidOf', { amount: formatMoney(p.paidTowardsPoisha ?? 0) })}</span>}
        </span>
      ),
    },
    { id: 'status', header: t('col.status'), priority: 1, mobile: 'badges', cell: (p) => <Badge tone={TONE[p.status ?? 'open'] ?? 'neutral'}>{t(`status.${p.status ?? 'open'}`)}</Badge> },
    { id: 'date', header: t('col.date'), priority: 2, mobile: 'meta', cell: when },
    { id: 'owner', header: t('col.owner'), priority: 2, mobile: 'meta', cell: (p) => p.owner?.name ?? <span className="text-fg-tertiary">—</span> },
    { id: 'created', header: t('col.created'), priority: 4, cell: (p) => (p.createdAt ? formatDate(p.createdAt, { withYear: false }) : '—') },
  ];

  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label={t('when')}
          value={win}
          onChange={(v) => (pager.reset(), url.set({ when: v === 'today' ? null : v, cursor: null }))}
          options={WINDOWS.map((w) => ({ value: w, label: t(`window.${w}`) }))}
        />
        <Select aria-label={t('col.status')} value={status} onChange={(e) => (pager.reset(), url.set({ status: e.target.value || null, cursor: null }))} className="h-9 sm:w-52">
          <option value="">{t('allStatus')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </Select>
      </div>

      <DataTable
        tableId="promises"
        caption={t('title')}
        columns={columns}
        rows={q.data?.items}
        rowKey={(p) => p.id ?? p.clientId}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        empty={<EmptyState icon={Handshake} title={t('empty')} body={t('emptyBody')} />}
        pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!q.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(q.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n)) }}
      />

      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && url.set({ drawer: null })}
        title={open ? <span lang={locale}>{pickText(open.customer?.name, locale)}</span> : ''}
        subtitle={open?.customer?.code}
        headerExtra={open ? <Badge tone={TONE[open.status ?? 'open'] ?? 'neutral'}>{t(`status.${open.status ?? 'open'}`)}</Badge> : undefined}
        footer={
          open ? (
            <>
              {canCancel(open.status) && canManage && <Button variant="destructive" onClick={() => setCancelOpen(true)}>{t('cancel')}</Button>}
              <Link href={`/customers/${open.customer?.id ?? open.customerId}/`} className="ms-auto inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-primary hover:bg-surface-hover">
                {t('openCustomer')}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </>
          ) : undefined
        }
      >
        {open && (
          <div className="space-y-5 p-5">
            <div className="rounded-md border border-line px-4 py-3.5">
              <p className="text-xs font-medium text-fg-tertiary">{t('col.amount')}</p>
              <MoneyText poisha={open.promisedAmountPoisha} className="text-xl font-semibold" />
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hover" role="img" aria-label={t('paidShare', { pct: formatPercent(paidRatio(open)) })}>
                <div className="h-full rounded-full bg-st-paid" style={{ width: `${paidRatio(open) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-sm text-fg-secondary">{t('paidLine', { paid: formatMoney(open.paidTowardsPoisha ?? 0), pct: formatPercent(paidRatio(open)) })}</p>
            </div>
            {isLate(open, today) && <p className="rounded-sm bg-st-overdue-bg px-3 py-2 text-sm text-st-overdue">{t('lateHint', { n: formatNumber(-daysTo(open.promisedDate, today)) })}</p>}
            <DescList
              items={[
                { label: t('col.date'), value: formatDate(open.promisedDate) },
                { label: t('col.owner'), value: open.owner?.name ?? '—' },
                { label: t('col.created'), value: open.createdAt ? formatDateTime(open.createdAt) : '—' },
                { label: t('plan'), value: open.erpPlanId ? <span className="font-mono text-sm">{open.erpPlanId}</span> : '—' },
              ]}
            />
            {open.note && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-fg-secondary">{t('note')}</h3>
                <p className="text-base text-fg" lang={/[ঀ-৿]/.test(open.note) ? 'bn' : 'en'}>{open.note}</p>
              </section>
            )}
          </div>
        )}
      </Drawer>

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t('cancelTitle')}
        description={open ? t('cancelDesc', { name: pickText(open.customer?.name, locale), amount: formatMoney(open.promisedAmountPoisha), date: formatDate(open.promisedDate) }) : undefined}
        minLength={5}
        destructive
        confirmLabel={t('cancel')}
        onSubmit={async ({ reason }) => {
          await cancel.mutateAsync({ id: open!.id!, reason });
          toast.success(t('cancelled'));
          url.set({ drawer: null });
        }}
      />
    </>
  );
}
