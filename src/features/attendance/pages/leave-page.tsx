'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarDays, CalendarRange, Check, Clock, OctagonX, TriangleAlert, Undo2, X, type LucideIcon } from 'lucide-react';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, DescList } from '@/shared/ui/page';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/form';
import { Avatar, Segmented } from '@/shared/ui/primitives';
import { Dialog, Drawer } from '@/shared/ui/overlay';
import { ErrorBanner } from '@/shared/ui/feedback';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useDecideLeave, useLeaveRequests, type LeaveRequest, type LeaveStatus } from '../api/leave';
import { covers, leaveDays, overlapping, sortLeave } from '../model/calendar';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const FILTERS = ['pending', 'approved', 'rejected', 'cancelled', 'all'] as const;

const STATUS_LOOK: Record<LeaveStatus, { tone: Tone; icon: LucideIcon }> = {
  pending: { tone: 'pending', icon: Clock },
  approved: { tone: 'success', icon: Check },
  rejected: { tone: 'danger', icon: OctagonX },
  cancelled: { tone: 'neutral', icon: Undo2 },
};

/** Leave status = colour + icon + label. */
export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const { t } = useTranslation('attendance');
  const s = STATUS_LOOK[status];
  return <Badge tone={s.tone} icon={s.icon}>{t(`leave.status.${status}`)}</Badge>;
}

function range(r: LeaveRequest) {
  return r.from === r.to ? formatDate(r.from!) : `${formatDate(r.from!)} – ${formatDate(r.to!)}`;
}

/** FR-ATT-008 / FR-W: leave requests of the branch; pending first; approve, or reject with a reason. */
export function LeavePage() {
  const { t } = useTranslation('attendance');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canDecide = useCan('attendance.manage');
  const url = useUrlState();
  const today = todayDhaka();
  const filter = oneOf(url.get('status'), FILTERS, 'pending');
  const from = ISO.test(url.get('from')) ? url.get('from') : undefined;
  const to = ISO.test(url.get('to')) ? url.get('to') : undefined;
  const q = useLeaveRequests({ from, to });
  const all = useMemo(() => sortLeave(q.data ?? []), [q.data]);
  const rows = filter === 'all' ? all : all.filter((r) => r.status === filter);
  const count = (s: LeaveStatus) => all.filter((r) => r.status === s).length;
  const onLeaveToday = all.filter((r) => r.status === 'approved' && covers(r, today));
  const openId = url.get('drawer');
  const open = all.find((r) => r.id === openId) ?? null;
  const [approving, setApproving] = useState<LeaveRequest | null>(null);
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const decide = useDecideLeave();

  const columns: Column<LeaveRequest>[] = [
    {
      id: 'staff',
      header: t('leave.col.staff'),
      priority: 1,
      mobile: 'title',
      cell: (r) => (
        <button type="button" onClick={() => url.set({ drawer: r.id }, { push: true })} className="flex min-w-0 items-center gap-2.5 text-start">
          <Avatar name={r.userName ?? '?'} />
          <span className="block max-w-[220px] truncate font-medium text-fg hover:text-primary" lang={locale}>{r.userName}</span>
        </button>
      ),
    },
    { id: 'status', header: t('leave.col.status'), priority: 1, mobile: 'badges', cell: (r) => <LeaveStatusBadge status={r.status!} /> },
    { id: 'dates', header: t('leave.col.dates'), priority: 1, mobile: 'subtitle', cell: (r) => <span className="tabular whitespace-nowrap">{range(r)}</span> },
    { id: 'days', header: t('leave.col.days'), align: 'end', priority: 2, mobile: 'meta', cell: (r) => <span className="tabular">{t('leave.daysN', { count: leaveDays(r), n: formatNumber(leaveDays(r)) })}</span> },
    { id: 'type', header: t('leave.col.type'), priority: 2, cell: (r) => t(`leave.type.${r.type}`) },
    { id: 'reason', header: t('leave.col.reason'), priority: 4, cell: (r) => (r.reason ? <span className="block max-w-[260px] truncate" lang="bn">{r.reason}</span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'asked', header: t('leave.col.asked'), priority: 5, cell: (r) => <span className="whitespace-nowrap text-fg-secondary">{formatRelative(r.createdAt!)}</span> },
    ...(canDecide
      ? [{
          id: 'act',
          header: t('leave.col.action'),
          align: 'end' as const,
          priority: 2 as const,
          hideable: false,
          cell: (r: LeaveRequest) =>
            r.status === 'pending' ? (
              <span className="inline-flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setApproving(r)} aria-label={t('leave.approveFor', { name: r.userName })}>
                  <Check className="size-3.5" aria-hidden />
                  {t('leave.approve')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(r)} aria-label={t('leave.rejectFor', { name: r.userName })}>
                  <X className="size-3.5" aria-hidden />
                  {t('leave.reject')}
                </Button>
              </span>
            ) : null,
        }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={t('leave.title')}
        crumbs={[{ label: t('title'), href: '/attendance/' }, { label: t('leave.title') }]}
        actions={
          <Link href="/attendance/calendar/" className="inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-base font-medium text-fg shadow-e1 hover:bg-surface-hover">
            <CalendarDays className="size-4" aria-hidden />
            {t('calendar.title')}
          </Link>
        }
      >
        <span>{t('leave.subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label={t('leave.filter')}
          value={filter}
          onChange={(v) => url.set({ status: v === 'pending' ? null : v, drawer: null })}
          options={FILTERS.map((f) => ({ value: f, label: t(`leave.filters.${f}`), count: f === 'all' ? undefined : count(f) }))}
        />
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2">
            <label htmlFor="leave-from" className="text-sm text-fg-secondary">{t('leave.from')}</label>
            <Input id="leave-from" type="date" value={from ?? ''} onChange={(e) => url.set({ from: e.target.value || null })} className="h-9 w-40" />
          </span>
          <span className="inline-flex items-center gap-2">
            <label htmlFor="leave-to" className="text-sm text-fg-secondary">{t('leave.to')}</label>
            <Input id="leave-to" type="date" value={to ?? ''} onChange={(e) => url.set({ to: e.target.value || null })} className="h-9 w-40" />
          </span>
          {(from || to) && <Button size="sm" variant="ghost" onClick={() => url.set({ from: null, to: null })}>{t('leave.clearDates')}</Button>}
        </span>
      </div>

      {onLeaveToday.length > 0 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-fg-secondary">
          <CalendarRange className="size-4 text-info" aria-hidden />
          <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => url.set({ status: 'approved', from: today, to: today })}>
            {t('leave.onLeaveToday', { count: onLeaveToday.length, n: formatNumber(onLeaveToday.length) })}
          </button>
        </p>
      )}

      <DataTable
        tableId="leave-requests"
        caption={t('leave.title')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id!}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        onRowClick={(r) => url.set({ drawer: r.id }, { push: true })}
        activeRowKey={openId || undefined}
        empty={t(filter === 'pending' ? 'leave.emptyPending' : 'leave.empty')}
      />

      <LeaveDrawer
        r={open}
        all={all}
        canDecide={canDecide}
        onClose={() => url.set({ drawer: null })}
        onApprove={setApproving}
        onReject={setRejecting}
      />

      <ApproveDialog r={approving} all={all} onOpenChange={(o) => !o && setApproving(null)} />

      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={t('leave.rejectTitle', { name: rejecting?.userName ?? '' })}
        description={rejecting ? t('leave.decisionDesc', { dates: range(rejecting), count: leaveDays(rejecting), n: formatNumber(leaveDays(rejecting)) }) : undefined}
        minLength={5}
        destructive
        confirmLabel={t('leave.reject')}
        onSubmit={async ({ reason }) => {
          await decide.mutateAsync({ id: rejecting!.id!, decision: 'reject', reason });
          toast.success(t('leave.rejectedToast', { name: rejecting!.userName }));
        }}
      />
    </>
  );
}

function LeaveDrawer({ r, all, canDecide, onClose, onApprove, onReject }: { r: LeaveRequest | null; all: LeaveRequest[]; canDecide: boolean; onClose: () => void; onApprove: (r: LeaveRequest) => void; onReject: (r: LeaveRequest) => void }) {
  const { t } = useTranslation('attendance');
  const locale = useUi((s) => s.locale);
  const clash = r ? overlapping(r, all) : [];
  const history = r ? all.filter((o) => o.userId === r.userId && o.id !== r.id).slice(0, 5) : [];
  return (
    <Drawer
      open={!!r}
      onOpenChange={(o) => !o && onClose()}
      title={r ? <span lang={locale}>{r.userName}</span> : ''}
      subtitle={r ? <LeaveStatusBadge status={r.status!} /> : undefined}
      footer={
        r && canDecide && r.status === 'pending' ? (
          <div className="flex w-full flex-wrap gap-2">
            <Button variant="primary" onClick={() => onApprove(r)}>
              <Check className="size-4" aria-hidden />
              {t('leave.approve')}
            </Button>
            <Button variant="destructive" onClick={() => onReject(r)}>
              <X className="size-4" aria-hidden />
              {t('leave.reject')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {r && (
        <div className="space-y-5">
          <DescList
            items={[
              { label: t('leave.col.type'), value: t(`leave.type.${r.type}`) },
              { label: t('leave.col.dates'), value: <span className="tabular">{range(r)}</span> },
              { label: t('leave.col.days'), value: t('leave.daysN', { count: leaveDays(r), n: formatNumber(leaveDays(r)) }) },
              { label: t('leave.col.reason'), value: r.reason ? <span lang="bn">{r.reason}</span> : <span className="text-fg-tertiary">{t('leave.noReason')}</span> },
              { label: t('leave.col.asked'), value: formatDateTime(r.createdAt!) },
              ...(r.decidedAt ? [{ label: t('leave.decidedAt'), value: formatDateTime(r.decidedAt) }] : []),
              ...(r.decisionReason ? [{ label: t('leave.decisionReason'), value: <span lang="bn">{r.decisionReason}</span> }] : []),
              ...(r.cancelledAt ? [{ label: t('leave.cancelledAt'), value: formatDateTime(r.cancelledAt) }] : []),
            ]}
          />
          {r.status === 'pending' && clash.length > 0 && (
            <p className="flex gap-2 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('leave.overlapWarn', { dates: clash.map(range).join(', ') })}
            </p>
          )}
          {history.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg">{t('leave.history')}</h3>
              <ul className="space-y-2">
                {history.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="tabular text-fg">{range(o)} · {t(`leave.type.${o.type}`)}</span>
                    <LeaveStatusBadge status={o.status!} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** Approving cannot be undone (the server answers ALREADY_DECIDED), so it is confirmed with the dates named. */
function ApproveDialog({ r, all, onOpenChange }: { r: LeaveRequest | null; all: LeaveRequest[]; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('attendance');
  const { t: tc } = useTranslation();
  const decide = useDecideLeave();
  const [error, setError] = useState<unknown>(null);
  const clash = r ? overlapping(r, all).filter((o) => o.status === 'approved') : [];
  return (
    <Dialog
      open={!!r}
      onOpenChange={(o) => {
        if (decide.isPending) return;
        setError(null);
        onOpenChange(o);
      }}
      title={t('leave.approveTitle', { name: r?.userName ?? '' })}
      description={r ? t('leave.decisionDesc', { dates: range(r), count: leaveDays(r), n: formatNumber(leaveDays(r)) }) : undefined}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={decide.isPending}>{tc('actions.cancel')}</Button>
          <Button
            variant="primary"
            loading={decide.isPending}
            onClick={async () => {
              if (!r) return;
              setError(null);
              try {
                await decide.mutateAsync({ id: r.id!, decision: 'approve' });
                toast.success(t('leave.approvedToast', { name: r.userName }));
                onOpenChange(false);
              } catch (e) {
                setError(e);
              }
            }}
          >
            <Check className="size-4" aria-hidden />
            {t('leave.approve')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-secondary">{t('leave.approveHelp')}</p>
      {clash.length > 0 && <p className="mt-2 text-sm text-warning">{t('leave.overlapWarn', { dates: clash.map(range).join(', ') })}</p>}
      {error ? <ErrorBanner error={error} className="mt-3" /> : null}
    </Dialog>
  );
}
