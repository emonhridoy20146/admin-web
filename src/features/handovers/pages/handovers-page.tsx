'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeftRight, ArrowRight, CalendarClock, Hourglass, Plus, TriangleAlert } from 'lucide-react';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { formatDate, formatDateTime, formatNumber, formatRelative, pickText } from '@/shared/lib/format';
import { PageHeader, DescList } from '@/shared/ui/page';
import { Button } from '@/shared/ui/button';
import { Badge, StatusBadge } from '@/shared/ui/badge';
import { MoneyText } from '@/shared/ui/money';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { Dialog, Drawer } from '@/shared/ui/overlay';
import { EmptyState, ErrorBanner } from '@/shared/ui/feedback';
import { Avatar, Segmented } from '@/shared/ui/primitives';
import { useAreas, useCancelHandover, useHandovers, useStaff, type Handover } from '../api/handovers';
import { countByGroup, groupOf, GROUPS, hoursLeft } from '../model/handover';
import { HandoverFormDialog } from '../components/handover-form-dialog';

export function HandoversPage() {
  const { t } = useTranslation('handovers');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canCreate = useCan('handover.create');
  const url = useUrlState();
  const tab = oneOf(url.get('status'), GROUPS, 'pending');
  const q = useHandovers();
  const staff = useStaff();
  const areas = useAreas();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const cancel = useCancelHandover();
  const formOpen = url.get('new') === '1' && canCreate;
  const openId = url.get('drawer');

  const nameOf = useMemo(() => {
    const m = new Map((staff.data ?? []).map((u) => [u.id, pickText(u.name, locale)]));
    return (id?: string) => m.get(id) || t('unknownStaff');
  }, [staff.data, locale, t]);
  const areaName = useMemo(() => {
    const m = new Map((areas.data ?? []).map((a) => [a.id, pickText(a.name, locale)]));
    return (id: string) => m.get(id) || id;
  }, [areas.data, locale]);

  const counts = countByGroup(q.data);
  const rows = useMemo(
    () => (q.data ?? []).filter((h) => groupOf(h.status) === tab).sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1)),
    [q.data, tab],
  );
  const open = (q.data ?? []).find((h) => h.id === openId) ?? null;
  const toCancel = (q.data ?? []).find((h) => h.id === cancelId) ?? null;

  const scope = (h: Handover) => {
    const names = (h.areaIds ?? []).map(areaName);
    const extra = h.customerIds?.length ? t('nDirect', { n: formatNumber(h.customerIds.length) }) : '';
    return [names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${formatNumber(names.length - 2)}` : ''), extra].filter(Boolean).join(' · ') || '—';
  };

  const columns: Column<Handover>[] = [
    {
      id: 'who',
      header: t('col.who'),
      priority: 1,
      mobile: 'title',
      cell: (h) => (
        <button type="button" onClick={() => url.set({ drawer: h.id ?? null }, { push: true })} className="flex min-w-0 items-center gap-2 text-start font-medium text-fg hover:text-primary" lang={locale}>
          <span className="truncate">{nameOf(h.fromUserId)}</span>
          <ArrowRight className="size-3.5 shrink-0 text-fg-tertiary rtl:rotate-180" aria-label={t('to')} />
          <span className="truncate">{nameOf(h.toUserId)}</span>
        </button>
      ),
    },
    {
      id: 'status',
      header: t('col.status'),
      priority: 1,
      mobile: 'badges',
      cell: (h) => {
        const left = hoursLeft(h);
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <StatusBadge status={h.status ?? 'pending_acceptance'} />
            {h.endDate && <Badge tone="info" icon={CalendarClock}>{t('until', { date: formatDate(h.endDate, { withYear: false }) })}</Badge>}
            {left != null && <span className={left < 24 ? 'text-xs font-medium text-warning' : 'text-xs text-fg-tertiary'}>{t('expiresIn', { n: formatNumber(left) })}</span>}
          </span>
        );
      },
    },
    { id: 'scope', header: t('col.scope'), priority: 2, mobile: 'subtitle', cell: (h) => <span className="text-fg-secondary" lang={locale}>{scope(h)}</span> },
    { id: 'customers', header: t('col.customers'), align: 'end', priority: 2, mobile: 'meta', cell: (h) => <span className="tabular">{formatNumber(h.summary?.customers ?? 0)}</span> },
    { id: 'outstanding', header: t('col.outstanding'), align: 'end', priority: 3, mobile: 'amount', cell: (h) => <MoneyText poisha={h.summary?.outstandingPoisha ?? 0} /> },
    { id: 'effective', header: t('col.effective'), priority: 4, cell: (h) => (h.effectiveDate ? formatDate(h.effectiveDate, { withYear: false }) : '—') },
    { id: 'created', header: t('col.created'), priority: 4, mobile: 'meta', cell: (h) => (h.createdAt ? formatRelative(h.createdAt) : '—') },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => url.set({ new: '1' })}>
              <Plus className="size-4" aria-hidden />
              {t('new')}
            </Button>
          ) : undefined
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4">
        <Segmented
          label={t('col.status')}
          value={tab}
          onChange={(v) => url.set({ status: v === 'pending' ? null : v })}
          options={GROUPS.map((g) => ({ value: g, label: t(`group.${g}`), count: g === 'pending' ? counts.pending || undefined : undefined }))}
        />
      </div>

      <DataTable
        tableId="handovers"
        caption={t('title')}
        columns={columns}
        rows={q.isLoading ? undefined : rows}
        rowKey={(h) => h.id ?? ''}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        empty={<EmptyState icon={ArrowLeftRight} title={t(`empty.${tab}`)} body={tab === 'pending' ? t('empty.pendingBody') : undefined} />}
      />

      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && url.set({ drawer: null })}
        title={open ? `${nameOf(open.fromUserId)} → ${nameOf(open.toUserId)}` : ''}
        subtitle={open?.createdAt ? formatDateTime(open.createdAt) : undefined}
        headerExtra={open ? <StatusBadge status={open.status ?? 'pending_acceptance'} /> : undefined}
        footer={
          open?.status === 'pending_acceptance' && canCreate ? (
            <Button variant="destructive" onClick={() => setCancelId(open.id ?? null)}>{t('cancel')}</Button>
          ) : undefined
        }
      >
        {open && (
          <div className="space-y-5 p-5">
            {open.status === 'pending_acceptance' && (
              <p className="flex items-start gap-2 rounded-sm bg-info-bg px-3 py-2 text-sm text-info">
                <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('pendingHint', { name: nameOf(open.fromUserId) })}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Person name={nameOf(open.fromUserId)} label={t('form.from')} />
              <ArrowRight className="size-4 shrink-0 text-fg-tertiary rtl:rotate-180" aria-hidden />
              <Person name={nameOf(open.toUserId)} label={t('form.to')} />
            </div>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{t('summary')}</h3>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line [&>*]:bg-surface">
                <Stat label={t('col.customers')} value={formatNumber(open.summary?.customers ?? 0)} />
                <Stat label={t('col.outstanding')} value={<MoneyText poisha={open.summary?.outstandingPoisha ?? 0} />} />
                <Stat label={t('stat.overdue')} value={formatNumber(open.summary?.overdue ?? 0)} warn={(open.summary?.overdue ?? 0) > 0} />
                <Stat label={t('stat.openPromises')} value={formatNumber(open.summary?.openPromises ?? 0)} />
                <Stat label={t('stat.openConflicts')} value={formatNumber(open.summary?.openConflicts ?? 0)} warn={(open.summary?.openConflicts ?? 0) > 0} />
              </dl>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{t('col.scope')}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {(open.areaIds ?? []).map((id) => <li key={id}><Badge tone="neutral" icon={false}><span lang={locale}>{areaName(id)}</span></Badge></li>)}
                {!!open.customerIds?.length && <li><Badge tone="neutral" icon={false}>{t('nDirect', { n: formatNumber(open.customerIds.length) })}</Badge></li>}
              </ul>
            </section>
            <DescList
              items={[
                { label: t('col.effective'), value: open.effectiveDate ? formatDate(open.effectiveDate) : '—' },
                { label: t('form.end'), value: open.endDate ? formatDate(open.endDate) : t('permanent') },
                ...(open.status === 'pending_acceptance' && open.expiresAt ? [{ label: t('expires'), value: formatDateTime(open.expiresAt) }] : []),
              ]}
            />
            <section>
              <h3 className="mb-1 text-sm font-semibold text-fg-secondary">{t('form.reason')}</h3>
              <p className="text-base text-fg" lang={/[ঀ-৿]/.test(open.reason) ? 'bn' : 'en'}>{open.reason}</p>
            </section>
            <p className="flex items-start gap-2 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('cashWarning')}
            </p>
          </div>
        )}
      </Drawer>

      <Dialog
        open={!!toCancel}
        onOpenChange={(o) => !o && !cancel.isPending && setCancelId(null)}
        title={t('cancelTitle')}
        description={toCancel ? t('cancelDesc', { from: nameOf(toCancel.fromUserId), to: nameOf(toCancel.toUserId), n: formatNumber(toCancel.summary?.customers ?? 0) }) : undefined}
        footer={
          <>
            <Button onClick={() => setCancelId(null)} disabled={cancel.isPending}>{t('keep')}</Button>
            <Button
              variant="destructive"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(cancelId!, {
                  onSuccess: () => {
                    toast.success(t('cancelled'));
                    setCancelId(null);
                    url.set({ drawer: null });
                  },
                })
              }
            >
              {t('cancel')}
            </Button>
          </>
        }
      >
        {cancel.error ? <ErrorBanner error={cancel.error} /> : null}
      </Dialog>

      <HandoverFormDialog open={formOpen} onOpenChange={(o) => url.set({ new: o ? '1' : null })} staff={staff.data ?? []} areas={areas.data ?? []} />
    </>
  );
}

function Person({ name, label }: { name: string; label: string }) {
  const locale = useUi((s) => s.locale);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-line px-3 py-2.5">
      <Avatar name={name} />
      <div className="min-w-0">
        <p className="text-xs text-fg-tertiary">{label}</p>
        <p className="truncate text-sm font-medium text-fg" lang={locale}>{name}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs font-medium text-fg-tertiary">{label}</dt>
      <dd className={warn ? 'tabular text-md font-semibold text-warning' : 'tabular text-md font-semibold text-fg'}>{value}</dd>
    </div>
  );
}
