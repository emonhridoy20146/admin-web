'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Footprints, PencilLine, Target, Undo2, UsersRound, Wallet } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useSession, useCan } from '@/shared/auth/session';
import { useBranchId, useUi } from '@/shared/lib/ui-store';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { useUrlState } from '@/shared/lib/url-state';
import { toast } from 'sonner';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardHeader } from '@/shared/ui/card';
import { Input } from '@/shared/ui/form';
import { Avatar } from '@/shared/ui/primitives';
import { Drawer } from '@/shared/ui/overlay';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { MoneyText } from '@/shared/ui/money';
import { PrintButton, PrintOnly } from '@/shared/ui/print';
import { useClearUserTarget, useSetBranchTarget, useSetUserTarget, useTargetHistory, useTargets, type StaffTarget } from '../api/targets';
import { totals } from '../model/targets';
import { TargetDialog } from '../components/target-dialog';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** FR-COL-015: daily collection and visit targets per field staff member, with the branch default they fall back to. */
export function TargetsPage() {
  const { t } = useTranslation('targets');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const user = useSession((s) => s.user);
  const selected = useBranchId();
  // a manager of one branch works in that branch even with "all branches" in the switcher
  const branchId = selected ?? (user?.branchIds?.length === 1 ? user.branchIds[0] : undefined);
  const url = useUrlState();
  const today = todayDhaka();
  const date = ISO.test(url.get('date')) ? url.get('date') : today;
  const q = useTargets(branchId, date);
  const canManage = useCan('target.manage');
  const [editing, setEditing] = useState<StaffTarget | 'branch' | null>(null);
  const [clearing, setClearing] = useState<StaffTarget | null>(null);
  const setUser = useSetUserTarget();
  const setBranch = useSetBranchTarget();
  const clear = useClearUserTarget();
  const openId = url.get('drawer');
  const items = q.data?.items;
  const open = items?.find((i) => i.userId === openId) ?? null;
  const sum = totals(items);
  const def = q.data?.defaults;

  const columns: Column<StaffTarget>[] = [
    {
      id: 'staff',
      header: t('col.staff'),
      priority: 1,
      mobile: 'title',
      cell: (r) => (
        <button type="button" onClick={() => url.set({ drawer: r.userId }, { push: true })} className="flex min-w-0 items-center gap-2.5 text-start">
          <Avatar name={r.name ?? '?'} />
          <span className="min-w-0">
            <span className="block max-w-[220px] truncate font-medium text-fg hover:text-primary" lang={locale}>{r.name}</span>
            <span className="block font-mono text-xs text-fg-tertiary">{r.employeeCode}</span>
          </span>
        </button>
      ),
    },
    { id: 'source', header: t('col.source'), priority: 2, mobile: 'badges', cell: (r) => <SourceBadge r={r} /> },
    { id: 'amount', header: t('col.amount'), align: 'end', priority: 1, mobile: 'amount', cell: (r) => (r.workingDay === false ? <span className="text-fg-tertiary">—</span> : <MoneyText poisha={r.amountPoisha ?? 0} className="font-medium" />) },
    { id: 'visits', header: t('col.visits'), align: 'end', priority: 1, mobile: 'meta', cell: (r) => (r.workingDay === false ? <span className="text-fg-tertiary">—</span> : <span className="tabular">{formatNumber(r.visits ?? 0)}</span>) },
    { id: 'from', header: t('col.from'), priority: 3, cell: (r) => (r.effectiveFrom ? <span className="tabular">{formatDate(r.effectiveFrom)}</span> : <span className="text-fg-tertiary">—</span>) },
    ...(canManage
      ? [{
          id: 'act',
          header: t('col.action'),
          align: 'end' as const,
          priority: 2 as const,
          hideable: false,
          cell: (r: StaffTarget) => (
            <span className="inline-flex gap-1 print:hidden">
              <Button size="sm" variant="ghost" onClick={() => setEditing(r)} aria-label={t('editFor', { name: r.name })}>
                <PencilLine className="size-3.5" aria-hidden />
                {t('edit')}
              </Button>
              {r.source === 'personal' && (
                <Button size="sm" variant="ghost" onClick={() => setClearing(r)} aria-label={t('clearFor', { name: r.name })}>
                  <Undo2 className="size-3.5" aria-hidden />
                  {t('clear')}
                </Button>
              )}
            </span>
          ),
        }]
      : []),
  ];

  const kpis = [
    { icon: Wallet, label: t('kpi.amount'), value: formatMoney(sum.amountPoisha) },
    { icon: Footprints, label: t('kpi.visits'), value: formatNumber(sum.visits) },
    { icon: UsersRound, label: t('kpi.working'), value: `${formatNumber(sum.working)} / ${formatNumber(items?.length ?? 0)}` },
    { icon: Target, label: t('kpi.personal'), value: formatNumber(sum.personal) },
  ];

  return (
    <>
      <PageHeader title={t('title')} actions={branchId ? <PrintButton name={`${t('title')} - ${date}`} /> : undefined}>
        <span>{t('subtitle')}</span>
      </PageHeader>

      {!branchId ? (
        <EmptyState icon={Building2} title={t('pickBranch')} body={t('pickBranchBody')} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label htmlFor="target-date" className="text-sm text-fg-secondary print:hidden">{t('date')}</label>
            <Input id="target-date" type="date" value={date} onChange={(e) => ISO.test(e.target.value) && url.set({ date: e.target.value === today ? null : e.target.value })} className="h-9 w-44 print:hidden" />
            {date !== today && <Button size="sm" variant="ghost" className="print:hidden" onClick={() => url.set({ date: null })}>{t('today')}</Button>}
            <PrintOnly className="text-base font-medium text-fg">{formatDate(date)}</PrintOnly>
          </div>

          {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="mb-4" /> : null}

          <div className="mb-4 grid gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader
                title={t('branch.title')}
                subtitle={t('branch.sub')}
                actions={canManage && def ? <Button size="sm" onClick={() => setEditing('branch')}><PencilLine className="size-3.5" aria-hidden />{t('edit')}</Button> : undefined}
              />
              <div className="px-4 py-3">
                {q.isLoading ? (
                  <Skeleton className="h-12 w-48" />
                ) : def ? (
                  <>
                    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <MoneyText poisha={def.amountPoisha ?? 0} className="text-xl font-semibold" />
                      <span className="tabular text-md text-fg">{t('visitsN', { n: formatNumber(def.visits ?? 0) })}</span>
                    </p>
                    <p className="mt-1 text-sm text-fg-secondary">
                      {def.effectiveFrom ? t('since', { date: formatDate(def.effectiveFrom) }) : null}
                      {def.setBy?.name ? ` · ${t('setBy', { name: def.setBy.name })}` : null}
                    </p>
                    {def.reason ? <p className="mt-1 text-sm text-fg-tertiary">“{def.reason}”</p> : null}
                  </>
                ) : (
                  <p className="text-sm text-fg-tertiary">{t('branch.none')}</p>
                )}
              </div>
            </Card>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line shadow-e1 lg:col-span-7 [&>*]:bg-surface">
              {kpis.map((k) => (
                <div key={k.label} className="px-4 py-3.5">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-tertiary">
                    <k.icon className="size-3.5" aria-hidden />
                    {k.label}
                  </dt>
                  <dd className="tabular mt-1 text-xl font-semibold text-fg">{q.isLoading ? <Skeleton className="h-7 w-24" /> : k.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <DataTable
            tableId="targets"
            caption={t('title')}
            columns={columns}
            rows={q.isLoading ? undefined : items}
            rowKey={(r) => r.userId}
            activeRowKey={openId || null}
            onRowClick={(r) => url.set({ drawer: r.userId }, { push: true })}
            loading={q.isLoading}
            empty={<EmptyState icon={UsersRound} title={t('empty')} />}
          />
        </>
      )}

      <Drawer open={!!open} onOpenChange={(o) => !o && url.set({ drawer: null })} title={open ? <span lang={locale}>{open.name}</span> : ''} subtitle={open?.employeeCode} headerExtra={open ? <SourceBadge r={open} /> : undefined}>
        {open && <History r={open} />}
      </Drawer>

      <TargetDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'branch' ? t('dialog.branchTitle') : editing ? t('dialog.userTitle', { name: editing.name }) : ''}
        description={editing === 'branch' ? t('dialog.branchHelp') : t('dialog.userHelp')}
        current={editing === 'branch' ? def : editing ? editing : undefined}
        onSave={async (body) => {
          if (editing === 'branch') await setBranch.mutateAsync({ branchId: branchId!, body });
          else if (editing) await setUser.mutateAsync({ userId: editing.userId, body });
          toast.success(t('saved'));
        }}
      />

      <ReasonDialog
        open={!!clearing}
        onOpenChange={(o) => !o && setClearing(null)}
        title={clearing ? t('clearTitle', { name: clearing.name }) : ''}
        description={def ? t('clearBody', { amount: formatMoney(def.amountPoisha ?? 0), visits: formatNumber(def.visits ?? 0) }) : undefined}
        confirmLabel={t('clear')}
        minLength={5}
        onSubmit={async ({ reason }) => {
          await clear.mutateAsync({ userId: clearing!.userId, reason });
          toast.success(t('saved'));
        }}
      />
    </>
  );
}

function SourceBadge({ r }: { r: StaffTarget }) {
  const { t } = useTranslation('targets');
  if (r.workingDay === false) return <Badge tone="neutral">{t('offDay')}</Badge>;
  return r.source === 'personal' ? <Badge tone="brand" icon={Target}>{t('source.personal')}</Badge> : <Badge tone="neutral" icon={Building2}>{t('source.branch')}</Badge>;
}

function History({ r }: { r: StaffTarget }) {
  const { t } = useTranslation('targets');
  const h = useTargetHistory(r.userId);
  const rows = h.data ?? [];
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line [&>*]:bg-surface">
        <div className="px-4 py-3">
          <dt className="text-xs text-fg-tertiary">{t('col.amount')}</dt>
          <dd className="text-md font-semibold">{r.workingDay === false ? '—' : <MoneyText poisha={r.amountPoisha ?? 0} />}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-fg-tertiary">{t('col.visits')}</dt>
          <dd className="tabular text-md font-semibold">{r.workingDay === false ? '—' : formatNumber(r.visits ?? 0)}</dd>
        </div>
      </dl>
      <section aria-labelledby="target-history">
        <h3 id="target-history" className="mb-2 text-sm font-semibold text-fg-secondary">{t('history')}</h3>
        {h.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : h.error ? (
          <ErrorBanner error={h.error} onRetry={() => h.refetch()} />
        ) : rows.length ? (
          <ol className="divide-y divide-line overflow-hidden rounded-md border border-line">
            {rows.map((v) => (
              <li key={v.id} className="px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="tabular font-medium text-fg">{v.effectiveFrom ? t('since', { date: formatDate(v.effectiveFrom) }) : '—'}</span>
                  <span className={cn('text-xs', v.kind === 'cleared' ? 'text-fg-tertiary' : 'text-primary')}>{t(`kind.${v.kind ?? 'set'}`)}</span>
                </div>
                <p className="tabular text-fg">
                  {v.kind === 'cleared' ? t('cleared') : `${formatMoney(v.amountPoisha ?? 0)} · ${t('visitsN', { n: formatNumber(v.visits ?? 0) })}`}
                </p>
                <p className="text-xs text-fg-tertiary">
                  {[v.setBy?.name, v.setAt ? formatDateTime(v.setAt) : null].filter(Boolean).join(' · ')}
                  {v.reason ? ` · “${v.reason}”` : ''}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-fg-tertiary">{t('noHistory')}</p>
        )}
      </section>
    </div>
  );
}
