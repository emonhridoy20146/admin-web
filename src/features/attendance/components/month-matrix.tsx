'use client';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatDuration, formatNumber, formatWeekday } from '@/shared/lib/format';
import { Tooltip } from '@/shared/ui/primitives';
import type { AttendanceDay, SummaryRow } from '../api/attendance';
import type { Status } from '../model/attendance';

/** Cell colour + letter: colour is never the only signal (03 §1). */
export const CELL: Record<Status, string> = {
  present: 'bg-success-bg text-success',
  off_duty: 'bg-success-bg text-success',
  on_duty: 'bg-success-bg text-success',
  on_break: 'bg-info-bg text-info',
  late: 'bg-warning-bg text-warning',
  absent: 'bg-danger-bg text-danger',
  leave: 'bg-info-bg text-info',
  holiday: 'bg-surface-hover text-fg-secondary',
  weekly_off: 'bg-surface-hover text-fg-secondary',
  not_started: 'bg-st-pending-bg text-st-pending',
};
export const LEGEND: Status[] = ['present', 'late', 'absent', 'leave', 'weekly_off', 'holiday'];

export function MonthMatrix({ staff, days, byUser, summary, today, onPick }: {
  staff: { id: string; name: string }[];
  days: string[];
  byUser: Map<string, Map<string, AttendanceDay>>;
  summary: Map<string, SummaryRow>;
  today: string;
  onPick: (date: string) => void;
}) {
  const { t } = useTranslation('attendance');
  const locale = useUi((s) => s.locale);
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface shadow-e1">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{t('view.month')}</caption>
          <thead>
            <tr className="bg-surface-subtle text-xs text-fg-secondary">
              <th scope="col" className="sticky start-0 z-10 min-w-44 border-b border-line bg-surface-subtle px-4 py-2 text-start font-medium">{t('col.staff')}</th>
              {days.map((d) => (
                <th key={d} scope="col" className={cn('border-b border-line px-0.5 py-1.5 text-center font-medium', d === today && 'text-primary')}>
                  <button type="button" onClick={() => onPick(d)} className="mx-auto grid w-7 rounded-xs py-0.5 hover:bg-surface-hover" aria-label={formatDate(d)}>
                    <span className="text-[10px] leading-3 text-fg-tertiary" aria-hidden>{formatWeekday(d)}</span>
                    <span className="tabular" aria-hidden>{formatNumber(Number(d.slice(8)))}</span>
                  </button>
                </th>
              ))}
              {(['present', 'late', 'absent', 'leave'] as const).map((k) => (
                <th key={k} scope="col" className="border-b border-s border-line px-2.5 py-2 text-end font-medium whitespace-nowrap">{t(`status.${k}`)}</th>
              ))}
              <th scope="col" className="border-b border-line px-3 py-2 text-end font-medium whitespace-nowrap">{t('col.lateMin')}</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => {
              const row = byUser.get(u.id);
              const s = summary.get(u.id);
              return (
                <tr key={u.id} className="group">
                  <th scope="row" className="sticky start-0 z-10 max-w-52 truncate border-b border-line bg-surface px-4 py-1.5 text-start font-medium text-fg group-last:border-0" lang={locale}>{u.name}</th>
                  {days.map((d) => {
                    const day = row?.get(d);
                    const st = day?.status;
                    return (
                      <td key={d} className="border-b border-line px-0.5 py-1 text-center group-last:border-0">
                        {st ? (
                          <Tooltip content={`${formatDate(d, { withYear: false })} · ${t(`status.${st}`)}${(day.lateMin ?? 0) > 0 ? ` · ${t('lateBy', { d: formatDuration(day.lateMin ?? 0) })}` : ''}${day.corrected ? ` · ${t('corrected')}` : ''}`}>
                            <span tabIndex={0} className={cn('mx-auto grid size-7 place-items-center rounded-xs text-[11px] font-semibold', CELL[st], day.corrected && 'ring-1 ring-line-strong')}>
                              <span aria-hidden>{t(`short.${st}`)}</span>
                              <span className="sr-only">{t(`status.${st}`)}</span>
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-fg-tertiary" aria-hidden>·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="tabular border-b border-s border-line px-2.5 py-1.5 text-end group-last:border-b-0">{formatNumber(s?.present ?? 0)}</td>
                  <td className={cn('tabular border-b border-line px-2.5 py-1.5 text-end group-last:border-0', (s?.late ?? 0) > 0 && 'font-medium text-warning')}>{formatNumber(s?.late ?? 0)}</td>
                  <td className={cn('tabular border-b border-line px-2.5 py-1.5 text-end group-last:border-0', (s?.absent ?? 0) > 0 && 'font-medium text-danger')}>{formatNumber(s?.absent ?? 0)}</td>
                  <td className="tabular border-b border-line px-2.5 py-1.5 text-end group-last:border-0">{formatNumber(s?.leave ?? 0)}</td>
                  <td className="tabular border-b border-line px-3 py-1.5 text-end whitespace-nowrap group-last:border-0">{(s?.lateMin ?? 0) > 0 ? formatDuration(s?.lateMin ?? 0) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-xs text-fg-secondary">
        {LEGEND.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={cn('grid size-5 place-items-center rounded-xs text-[10px] font-semibold', CELL[s])} aria-hidden>{t(`short.${s}`)}</span>
            {t(`status.${s}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
