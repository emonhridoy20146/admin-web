'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Pencil, Undo2, XCircle } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatDateTime, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { DescList } from '@/shared/ui/page';
import { Drawer } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { actionsFor, history } from '../model/tasks';
import type { Task } from '../api/tasks';
import { DueBadge, TaskStatusBadge } from './task-badges';
import { TaskDialog } from './task-dialog';
import { CancelDialog, RejectDialog, VerifyDialog } from './task-actions';

type Act = 'edit' | 'verify' | 'reject' | 'cancel' | null;

/** One task: what was asked, what the staff member says, what the admin decided, and the history. Actions follow the state. */
export function TaskDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { t } = useTranslation('tasks');
  const locale = useUi((s) => s.locale);
  const branches = useBranches();
  const canManage = useCan('task.manage');
  const [act, setAct] = useState<Act>(null);
  const today = todayDhaka();
  const can = task ? actionsFor(task.status) : null;
  const branch = pickText(branches.data?.find((b) => b.id === task?.branchId)?.name, locale) || task?.branchId;

  const footer =
    task && canManage && can && (can.edit || can.verify || can.reject || can.cancel) ? (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {can.verify && (
            <Button variant="primary" onClick={() => setAct('verify')}>
              <BadgeCheck className="size-4" aria-hidden />
              {t('actions.verify')}
            </Button>
          )}
          {can.reject && (
            <Button onClick={() => setAct('reject')}>
              <Undo2 className="size-4" aria-hidden />
              {t('actions.reject')}
            </Button>
          )}
          {can.edit && (
            <Button onClick={() => setAct('edit')}>
              <Pencil className="size-4" aria-hidden />
              {t('actions.edit')}
            </Button>
          )}
        </div>
        {can.cancel && (
          <Button variant="destructive" onClick={() => setAct('cancel')}>
            <XCircle className="size-4" aria-hidden />
            {t('actions.cancel')}
          </Button>
        )}
      </div>
    ) : undefined;

  return (
    <>
      <Drawer
        open={!!task}
        onOpenChange={(o) => !o && onClose()}
        title={task ? <span lang={locale}>{task.title}</span> : ''}
        subtitle={task ? <span>{t('drawer.givenBy')}: {task.createdBy.name} · {formatDateTime(task.createdAt)}</span> : undefined}
        width={560}
        footer={footer}
      >
        {task && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <DueBadge task={task} today={today} />
            </div>

            <DescList
              items={[
                { label: t('drawer.givenTo'), value: <span lang={locale}>{task.assignee.name} <span className="font-mono text-xs text-fg-tertiary">{task.assignee.employeeCode}</span></span> },
                { label: t('drawer.branch'), value: <span lang={locale}>{branch}</span> },
                { label: t('drawer.due'), value: task.dueDate ? <span className="tabular">{formatDate(task.dueDate)}</span> : <span className="text-fg-tertiary">{t('due.none')}</span> },
              ]}
            />

            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-fg">{t('drawer.note')}</h3>
              {task.note ? <p className="whitespace-pre-line rounded-md border border-line bg-surface p-3 text-base text-fg" lang={locale}>{task.note}</p> : <p className="text-sm text-fg-tertiary">{t('drawer.noNote')}</p>}
            </section>

            {task.status === 'resolve_requested' && (
              <section className="space-y-1.5 rounded-md border border-warning/40 bg-warning-bg p-3">
                <h3 className="text-sm font-semibold text-fg">{t('drawer.staffSays')}</h3>
                <p className="whitespace-pre-line text-sm text-fg" lang={locale}>{task.resolveNote || t('drawer.noStaffNote')}</p>
                {task.resolveRequestedAt && <p className="text-xs text-fg-secondary">{t('drawer.staffSaysAt', { at: formatDateTime(task.resolveRequestedAt) })}</p>}
              </section>
            )}

            {task.decisionNote && (
              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold text-fg">{task.status === 'open' ? t('drawer.rejectedReason') : t('drawer.decision')}</h3>
                <p className="whitespace-pre-line rounded-md border border-line bg-surface p-3 text-sm text-fg-secondary" lang={locale}>{task.decisionNote}</p>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg">{t('drawer.history')}</h3>
              <ol className="space-y-3 border-s border-line ps-4">
                {history(task).map((e, i) => (
                  <li key={`${e.type}-${e.at}-${i}`} className="relative">
                    <span className="absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                    <p className="text-sm text-fg">{t(`history.${e.type}`, { who: e.by.name })}</p>
                    <p className="tabular text-xs text-fg-tertiary">{formatDateTime(e.at)}</p>
                    {e.note && <p className="mt-1 whitespace-pre-line text-sm text-fg-secondary" lang={locale}>“{e.note}”</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Drawer>
      {task && (
        <>
          <TaskDialog open={act === 'edit'} onOpenChange={(o) => !o && setAct(null)} task={task} />
          <VerifyDialog task={task} open={act === 'verify'} onOpenChange={(o) => !o && setAct(null)} />
          <RejectDialog task={task} open={act === 'reject'} onOpenChange={(o) => !o && setAct(null)} />
          <CancelDialog task={task} open={act === 'cancel'} onOpenChange={(o) => !o && setAct(null)} />
        </>
      )}
    </>
  );
}
