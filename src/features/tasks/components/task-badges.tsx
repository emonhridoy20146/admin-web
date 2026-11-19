'use client';
import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle2, CircleDashed, Hourglass, type LucideIcon } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import { dueKind } from '../model/tasks';
import type { Task, TaskStatus } from '../api/tasks';

const STATUS: Record<TaskStatus, { tone: Tone; icon: LucideIcon }> = {
  open: { tone: 'info', icon: CircleDashed },
  resolve_requested: { tone: 'warning', icon: Hourglass },
  resolved: { tone: 'success', icon: CheckCircle2 },
  cancelled: { tone: 'neutral', icon: Ban },
};

/** Status = colour + icon + label, never colour alone (03 §status). */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation('tasks');
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {t(`status.${status}`)}
    </Badge>
  );
}

/** "Late" and "Today" next to a due date; plain text for the rest. */
export function DueBadge({ task, today }: { task: Pick<Task, 'dueDate' | 'status'>; today: string }) {
  const { t } = useTranslation('tasks');
  const k = dueKind(task, today);
  if (k === 'late') return <Badge tone="overdue">{t('due.late')}</Badge>;
  if (k === 'today') return <Badge tone="dueToday">{t('due.today')}</Badge>;
  return null;
}
