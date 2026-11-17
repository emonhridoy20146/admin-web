'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CalendarOff, ChevronLeft, ChevronRight, Clock, PencilLine, Plus, Trash2, Umbrella } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatDuration, formatNumber, formatWeekday, getFormatPrefs, pickText, toBnDigits } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader } from '@/shared/ui/page';
import { DataTable, type Column } from '@/shared/ui/data-table';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Segmented } from '@/shared/ui/primitives';
import { useHolidays, useShifts, type Holiday, type Shift } from '../api/leave';
import { shiftMinutes } from '../model/calendar';
import { DeleteHolidayDialog, HolidayDialog, ShiftDialog } from '../components/calendar-dialogs';

const TABS = ['holidays', 'shifts'] as const;

/** FR-SET-002 / FR-SET-003: the holiday calendar and work shifts that attendance and targets count with. */
export function WorkCalendarPage() {
  const { t } = useTranslation('attendance');
  const url = useUrlState();
  const tab = oneOf(url.get('tab'), TABS, 'holidays');
  return (
    <>
      <PageHeader
        title={t('calendar.title')}
        crumbs={[{ label: t('title'), href: '/attendance/' }, { label: t('calendar.title') }]}
        actions={
          <Link href="/attendance/leave/" className="inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-base font-medium text-fg shadow-e1 hover:bg-surface-hover">
            <Umbrella className="size-4" aria-hidden />
            {t('leave.title')}
          </Link>
        }
      >
        <span>{t('calendar.subtitle')}</span>
      </PageHeader>
      <Segmented
        className="mb-4"
        label={t('calendar.title')}
        value={tab}
        onChange={(v) => url.set({ tab: v === 'holidays' ? null : v })}
        options={TABS.map((x) => ({ value: x, label: t(`calendar.tabs.${x}`) }))}
      />
      {tab === 'holidays' ? <Holidays /> : <Shifts />}
    </>
  );
}

function Holidays() {
  const { t } = useTranslation('attendance');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const canManage = useCan('settings.manage');
  const branches = useBranches();
  const url = useUrlState();
  const thisYear = Number(todayDhaka().slice(0, 4));
  const y = Number(url.get('year'));
  const year = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : thisYear;
  const q = useHolidays(year);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Holiday | null>(null);
  const today = todayDhaka();
  const branchName = (id: string) => pickText(branches.data?.find((b) => b.id === id)?.name, locale) || id;

  const columns: Column<Holiday>[] = [
    {
      id: 'date',
      header: t('calendar.date'),
      priority: 1,
      mobile: 'subtitle',
      cell: (h) => (
        <span className={h.date! < today ? 'tabular text-fg-tertiary' : 'tabular'}>
          {formatDate(h.date!)} <span className="text-fg-secondary">· {formatWeekday(h.date!)}</span>
        </span>
      ),
    },
    { id: 'name', header: t('calendar.name'), priority: 1, mobile: 'title', cell: (h) => <span className="font-medium" lang={locale}>{pickText(h.name, locale)}</span> },
    {
      id: 'scope',
      header: t('calendar.scope'),
      priority: 2,
      mobile: 'badges',
      cell: (h) =>
        h.branchIds?.length ? (
          <span className="inline-flex flex-wrap gap-1">
            {h.branchIds.map((b) => <Badge key={b} tone="info" icon={false}><span lang={locale}>{branchName(b)}</span></Badge>)}
          </span>
        ) : (
          <Badge tone="neutral" icon={false}>{t('calendar.scopes.national')}</Badge>
        ),
    },
    ...(canManage
      ? [{
          id: 'act',
          header: t('calendar.action'),
          align: 'end' as const,
          priority: 2 as const,
          hideable: false,
          cell: (h: Holiday) => (
            <Button size="sm" variant="ghost" onClick={() => setDeleting(h)} aria-label={t('calendar.deleteFor', { name: pickText(h.name, locale) })}>
              <Trash2 className="size-3.5" aria-hidden />
              {t('calendar.delete')}
            </Button>
          ),
        }]
      : []),
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => url.set({ year: String(year - 1) })} aria-label={t('calendar.prevYear')}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="tabular min-w-14 text-center text-lg font-semibold text-fg">{getFormatPrefs().bnDigits ? toBnDigits(String(year)) : year}</span>
        <Button size="icon" variant="ghost" onClick={() => url.set({ year: String(year + 1) })} aria-label={t('calendar.nextYear')}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        {year !== thisYear && <Button size="sm" variant="ghost" onClick={() => url.set({ year: null })}>{t('calendar.thisYear')}</Button>}
        <span className="text-sm text-fg-secondary">{t('calendar.holidayCount', { count: q.data?.length ?? 0, n: formatNumber(q.data?.length ?? 0) })}</span>
        {canManage && (
          <Button variant="primary" className="ms-auto" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            {t('calendar.addHoliday')}
          </Button>
        )}
      </div>
      <DataTable
        tableId="holidays"
        caption={t('calendar.tabs.holidays')}
        columns={columns}
        rows={q.data}
        rowKey={(h) => h.id ?? `${h.date}-${h.name?.bn}`}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        empty={<span className="inline-flex items-center gap-2"><CalendarOff className="size-4" aria-hidden />{t('calendar.noHolidays')}</span>}
      />
      <HolidayDialog open={adding} onOpenChange={setAdding} year={year} existing={q.data ?? []} />
      <DeleteHolidayDialog holiday={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </>
  );
}

function Shifts() {
  const { t } = useTranslation('attendance');
  useUi((s) => s.bnDigits);
  const canManage = useCan('settings.manage');
  const q = useShifts();
  const [editing, setEditing] = useState<Shift | 'new' | null>(null);
  const off = (s: Shift) => (s.weeklyOff?.length ? [...s.weeklyOff].sort((a, b) => a - b).map((d) => t(`calendar.weekday.${d}`)).join(', ') : t('calendar.noWeeklyOff'));

  const columns: Column<Shift>[] = [
    { id: 'name', header: t('calendar.shiftName'), priority: 1, mobile: 'title', cell: (s) => <span className="font-medium">{s.name}</span> },
    {
      id: 'hours',
      header: t('calendar.hours'),
      priority: 1,
      mobile: 'subtitle',
      cell: (s) => (
        <span className="tabular whitespace-nowrap">
          {s.start} – {s.end} <span className="text-fg-secondary">· {formatDuration(shiftMinutes(s))}</span>
        </span>
      ),
    },
    { id: 'off', header: t('calendar.weeklyOff'), priority: 2, mobile: 'meta', cell: (s) => off(s) },
    { id: 'grace', header: t('calendar.lateGrace'), align: 'end', priority: 3, cell: (s) => <span className="tabular">{formatDuration(s.lateGraceMin ?? 0)}</span> },
    { id: 'break', header: t('calendar.maxBreak'), align: 'end', priority: 3, cell: (s) => <span className="tabular">{formatDuration(s.maxBreakMin ?? 0)}</span> },
    ...(canManage
      ? [{
          id: 'act',
          header: t('calendar.action'),
          align: 'end' as const,
          priority: 2 as const,
          hideable: false,
          cell: (s: Shift) => (
            <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label={t('calendar.editShift', { name: s.name })}>
              <PencilLine className="size-3.5" aria-hidden />
              {t('calendar.edit')}
            </Button>
          ),
        }]
      : []),
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 text-sm text-fg-secondary">
          <Clock className="size-4" aria-hidden />
          {t('calendar.shiftHelp')}
        </p>
        {canManage && (
          <Button variant="primary" className="ms-auto" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            {t('calendar.addShift')}
          </Button>
        )}
      </div>
      <DataTable
        tableId="shifts"
        caption={t('calendar.tabs.shifts')}
        columns={columns}
        rows={q.data}
        rowKey={(s) => s.id ?? s.name ?? ''}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        empty={t('calendar.noShifts')}
      />
      <ShiftDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} shift={editing === 'new' ? null : editing} />
    </>
  );
}
