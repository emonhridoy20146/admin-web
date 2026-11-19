'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BadgeCheck } from 'lucide-react';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Textarea } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useCancelTask, useRejectTask, useVerifyTask, type Task } from '../api/tasks';
import { REASON_MIN } from '../model/tasks';

interface P {
  task: Task;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** FR-TASK-003: the admin agrees the work is done. Names the person and the task, with an optional note they will see. */
export function VerifyDialog({ task, open, onOpenChange }: P) {
  const { t } = useTranslation('tasks');
  const { t: tc } = useTranslation();
  const verify = useVerifyTask();
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    try {
      await verify.mutateAsync({ id: task.id, note: note.trim() || undefined });
      toast.success(t('toast.verified'));
      onOpenChange(false);
    } catch (x) {
      setError(x);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !verify.isPending && onOpenChange(o)}
      title={t('verify.title')}
      description={t('verify.desc', { who: task.assignee.name, task: task.title })}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={verify.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={() => void submit()} loading={verify.isPending}>
            <BadgeCheck className="size-4" aria-hidden />
            {t('verify.confirm')}
          </Button>
        </>
      }
    >
      <form className="space-y-4 py-1" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {task.resolveNote && <p className="whitespace-pre-line rounded-md border border-line bg-surface p-3 text-sm text-fg-secondary">{task.resolveNote}</p>}
        <Field label={t('verify.note')}>{(id, d) => <Textarea id={id} aria-describedby={d} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        {error ? <ErrorBanner error={error} /> : null}
      </form>
    </Dialog>
  );
}

/** Sending a request back needs a reason the staff member sees (same rule as rejecting leave). */
export function RejectDialog({ task, open, onOpenChange }: P) {
  const { t } = useTranslation('tasks');
  const reject = useRejectTask();
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('reject.title')}
      description={t('reject.desc', { who: task.assignee.name, task: task.title })}
      minLength={REASON_MIN}
      confirmLabel={t('reject.confirm')}
      onSubmit={async (v) => {
        await reject.mutateAsync({ id: task.id, reason: v.reason });
        toast.success(t('toast.rejected'));
      }}
    />
  );
}

/** Cancelling withdraws the task for good and tells the staff member, so it is a destructive confirm that names both. */
export function CancelDialog({ task, open, onOpenChange }: P) {
  const { t } = useTranslation('tasks');
  const cancel = useCancelTask();
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('cancel.title')}
      description={t('cancel.desc', { who: task.assignee.name, task: task.title })}
      minLength={REASON_MIN}
      confirmLabel={t('cancel.confirm')}
      destructive
      onSubmit={async (v) => {
        await cancel.mutateAsync({ id: task.id, note: v.reason });
        toast.success(t('toast.cancelled'));
      }}
    />
  );
}
