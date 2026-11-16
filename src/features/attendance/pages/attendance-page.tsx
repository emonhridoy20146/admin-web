'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CameraOff, ChevronLeft, ChevronRight, ClockAlert, PencilLine, UserCheck, UserX } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { formatDate, formatDuration, formatMonth, formatNumber, formatTime, formatWeekday, pickText } from '@/shared/lib/format';
import { addDays, todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import { Segmented } from '@/shared/ui/primitives';
import { Input } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { useDays, useStaff, useSummary, type AttendanceDay } from '../api/attendance';
import { countDay, index, lastDay, missingSelfie, monthDays, monthOf, shiftMonth, sortDay, type Status } from '../model/attendance';
import { MonthMatrix } from '../components/month-matrix';
import { CorrectionDialog } from '../components/correction-dialog';
import { DayDrawer } from '../components/day-drawer';

const TONE: Record<Status, Tone> = {
  on_duty: 'success', on_break: 'info', off_duty: 'neutral', present: 'success', late: 'warning', absent: 'danger',
  leave: 'info', holiday: 'neutral', weekly_off: 'neutral', not_started: 'pending',
};
const VIEWS = ['day', 'month'] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

interface Row { id: string; name: string; code: string; day?: AttendanceDay }

export function AttendancePage() {
  const { t } = useTranslation('attendance');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canManage = useCan('attendance.manage');
  const url = useUrlState();
  const today = todayDhaka();
  const view = oneOf(url.get('view'), VIEWS, 'day');
  const date = ISO_DATE.test(url.get('date')) && url.get('date') <= today ? url.get('date') : today;
  const month = ISO_MONTH.test(url.get('month')) && url.get('month') <= monthOf(today) ? url.get('month') : monthOf(today);
  const staff = useStaff();
  const dayQ = useDays(view === 'day' ? date : `${month}-01`, view === 'day' ? date : lastDay(month));
  const summaryQ = useSummary(month);
  const [target, setTarget] = useState<{ userId: string; name: string; date: string } | null>(null);

  const people = useMemo(() => (staff.data ?? []).map((u) => ({ id: u.id!, name: pickText(u.name, locale), code: u.employeeCode ?? '' })), [staff.data, locale]);
  const byUser = useMemo(() => index(dayQ.data), [dayQ.data]);
  const rows: Row[] = useMemo(() => sortDay(people.map((p) => ({ ...p, day: byUser.get(p.id)?.get(date) }))), [people, byUser, date]);
  const counts = countDay(rows.map((r) => r.day).filter((d): d is AttendanceDay => !!d));
  const summary = useMemo(() => new Map((summaryQ.data ?? []).map((s) => [s.userId!, s])), [summaryQ.data]);
  const loading = staff.isLoading || dayQ.isLoading;
  const openId = view === 'day' ? url.get('drawer') : '';
  const openRow = rows.find((r) => r.id === openId);

  const columns: Column<Row>[] = [
    {
      id: 'staff',
      header: t('col.staff'),
      priority: 1,
      mobile: 'title',
      cell: (r) => (
        <div className="min-w-0">
          <span className="block max-w-[220px] truncate font-medium text-fg" lang={locale}>{r.name}</span>
          <span className="block font-mono text-xs text-fg-tertiary">{r.code}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: t('col.status'),
      priority: 1,
      mobile: 'badges',
      cell: (r) => {
        const s = r.day?.status ?? 'not_started';
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Badge tone={TONE[s]}>{t(`status.${s}`)}</Badge>
            {r.day?.corrected && <Badge tone="neutral" icon={PencilLine}>{t('corrected')}</Badge>}
            {r.day?.autoClosed && <Badge tone="warning" icon={false}>{t('autoClosed')}</Badge>}
            {missingSelfie(r.day) && <Badge tone="danger" icon={CameraOff}>{t('noSelfie')}</Badge>}
          </span>
        );
      },
    },
    { id: 'in', header: t('col.in'), priority: 1, mobile: 'meta', cell: (r) => (r.day?.firstIn ? <span className="tabular">{formatTime(r.day.firstIn)}</span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'out', header: t('col.out'), priority: 2, mobile: 'meta', cell: (r) => (r.day?.lastOut ? <span className="tabular">{formatTime(r.day.lastOut)}</span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'late', header: t('col.late'), align: 'end', priority: 2, mobile: 'amount', cell: (r) => ((r.day?.lateMin ?? 0) > 0 ? <span className="tabular font-medium text-warning">{formatDuration(r.day!.lateMin!)}</span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'break', header: t('col.break'), align: 'end', priority: 3, cell: (r) => ((r.day?.breakMin ?? 0) > 0 ? <span className="tabular">{formatDuration(r.day!.breakMin!)}</span> : <span className="text-fg-tertiary">—</span>) },
    { id: 'duty', header: t('col.duty'), align: 'end', priority: 3, cell: (r) => ((r.day?.dutyMin ?? 0) > 0 ? <span className="tabular">{formatDuration(r.day!.dutyMin!)}</span> : <span className="text-fg-tertiary">—</span>) },
    ...(canManage
      ? [{
          id: 'act',
          header: t('col.action'),
          align: 'end' as const,
          priority: 2 as const,
          hideable: false,
          cell: (r: Row) => (
            <Button size="sm" variant="ghost" onClick={(e) => (e.stopPropagation(), setTarget({ userId: r.id, name: r.name, date }))} aria-label={t('correctFor', { name: r.name })}>
              <PencilLine className="size-3.5" aria-hidden />
              {t('correct')}
            </Button>
          ),
        }]
      : []),
  ];

  const stepDay = (by: number) => {
    const next = addDays(date, by);
    if (next <= today) url.set({ date: next === today ? null : next });
  };
  const stepMonth = (by: number) => {
    const next = shiftMonth(month, by);
    if (next <= monthOf(today)) url.set({ month: next === monthOf(today) ? null : next });
  };

  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented label={t('view.label')} value={view} onChange={(v) => url.set({ view: v === 'day' ? null : v })} options={VIEWS.map((v) => ({ value: v, label: t(`view.${v}`) }))} />
        {view === 'day' ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => stepDay(-1)} aria-label={t('prevDay')}><ChevronLeft className="size-4 rtl:rotate-180" aria-hidden /></Button>
            <Input type="date" aria-label={t('date')} value={date} max={today} onChange={(e) => ISO_DATE.test(e.target.value) && url.set({ date: e.target.value === today ? null : e.target.value })} className="h-9 w-44" />
            <Button size="sm" onClick={() => stepDay(1)} disabled={date >= today} aria-label={t('nextDay')}><ChevronRight className="size-4 rtl:rotate-180" aria-hidden /></Button>
            {date !== today && <Button size="sm" variant="ghost" onClick={() => url.set({ date: null })}>{t('today')}</Button>}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => stepMonth(-1)} aria-label={t('prevMonth')}><ChevronLeft className="size-4 rtl:rotate-180" aria-hidden /></Button>
            <span className="min-w-36 text-center text-base font-medium text-fg" aria-live="polite">{formatMonth(month)}</span>
            <Button size="sm" onClick={() => stepMonth(1)} disabled={month >= monthOf(today)} aria-label={t('nextMonth')}><ChevronRight className="size-4 rtl:rotate-180" aria-hidden /></Button>
          </div>
        )}
      </div>

      {view === 'day' ? (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line shadow-e1 sm:grid-cols-4 [&>*]:bg-surface">
            <Kpi icon={UserCheck} label={t('kpi.worked')} value={loading ? null : `${formatNumber(counts.worked)} / ${formatNumber(rows.length)}`} sub={`${formatWeekday(date)} · ${formatDate(date, { withYear: false })}`} />
            <Kpi icon={CalendarDays} label={t('kpi.onDuty')} value={loading ? null : formatNumber(counts.onDuty)} sub={t('kpi.onDutySub')} />
            <Kpi icon={ClockAlert} label={t('kpi.late')} value={loading ? null : formatNumber(counts.late)} warn={counts.late > 0} />
            <Kpi icon={UserX} label={t('kpi.absent')} value={loading ? null : formatNumber(counts.absent + (date < today ? counts.notStarted : 0))} danger={counts.absent > 0} sub={date === today && counts.notStarted > 0 ? t('kpi.notStarted', { n: formatNumber(counts.notStarted) }) : undefined} />
          </dl>
          <DataTable
            tableId="attendance-day"
            caption={t('view.day')}
            columns={columns}
            rows={loading ? undefined : rows}
            rowKey={(r) => r.id}
            activeRowKey={openId || null}
            onRowClick={(r) => url.set({ drawer: r.id }, { push: true })}
            loading={loading}
            error={dayQ.error ?? staff.error}
            onRetry={() => (void dayQ.refetch(), void staff.refetch())}
            empty={<EmptyState icon={UserCheck} title={t('empty')} />}
          />
        </>
      ) : dayQ.error || summaryQ.error ? (
        <ErrorBanner error={dayQ.error ?? summaryQ.error} onRetry={() => (void dayQ.refetch(), void summaryQ.refetch())} />
      ) : loading ? (
        <Skeleton className="h-96 w-full rounded-md" />
      ) : !people.length ? (
        <EmptyState icon={UserCheck} title={t('empty')} />
      ) : (
        <MonthMatrix staff={people} days={monthDays(month, today)} byUser={byUser} summary={summary} today={today} onPick={(d) => url.set({ view: null, date: d === today ? null : d }, { push: true })} />
      )}

      <DayDrawer target={openRow ? { userId: openRow.id, name: openRow.name, date } : null} onClose={() => url.set({ drawer: null })} />
      <CorrectionDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, warn, danger }: { icon: typeof UserCheck; label: string; value: string | null; sub?: string; warn?: boolean; danger?: boolean }) {
  return (
    <div className="px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-tertiary">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1">
        <span className={cn('tabular block text-xl font-semibold', danger ? 'text-danger' : warn ? 'text-warning' : 'text-fg')}>{value ?? <Skeleton className="h-7 w-16" />}</span>
        {sub && <span className="mt-0.5 block text-xs text-fg-tertiary">{sub}</span>}
      </dd>
    </div>
  );
}
