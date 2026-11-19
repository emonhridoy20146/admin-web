'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ClipboardPlus, Save } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Input, Select, Textarea } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useCreateTask, useEditTask, useStaffOf, type Task } from '../api/tasks';
import { emptyTask, formOf, NOTE_MAX, TITLE_MAX, toCreate, toEdit, validateTask, type TaskForm } from '../model/tasks';

/** FR-TASK-001: give a staff member a job with a note (not tied to a customer); or edit one that is still open. */
export function TaskDialog({ open, onOpenChange, task, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; task?: Task | null; onDone?: (t: Task) => void }) {
  const { t } = useTranslation('tasks');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const branchId = useUi((s) => s.branchId);
  const editing = !!task;
  const branches = useBranches();
  const create = useCreateTask();
  const edit = useEditTask();
  const [v, setV] = useState<TaskForm>(emptyTask());
  const [errors, setErrors] = useState<Partial<Record<keyof TaskForm, string>>>({});
  const [error, setError] = useState<unknown>(null);
  // One id per opening: a double click or a retry after a lost answer returns the same task instead of making a second one.
  const clientId = useRef('');
  const staff = useStaffOf(editing ? undefined : v.branchId || undefined);
  const today = todayDhaka();

  // Reset only when the dialog opens: a refetch of the branches or the task while typing must not wipe the form.
  useEffect(() => {
    if (!open) return;
    clientId.current = crypto.randomUUID();
    setV(task ? formOf(task) : emptyTask(branchId || ''));
    setErrors({});
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // No branch picked in the top bar: start with the first one the person can see, once the list is there.
  const firstBranch = branches.data?.[0]?.id;
  useEffect(() => {
    if (open && !editing && !v.branchId && firstBranch) setV((s) => (s.branchId ? s : { ...s, branchId: firstBranch }));
  }, [open, editing, v.branchId, firstBranch]);

  const set = <K extends keyof TaskForm>(k: K, val: TaskForm[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: keyof TaskForm) => (errors[k] ? t(errors[k]!) : undefined);
  const busy = create.isPending || edit.isPending;

  const submit = async () => {
    const e = validateTask(v, today, editing);
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    try {
      if (task) {
        const body = toEdit(v, task);
        if (!Object.keys(body).length) {
          setError(new Error(t('form.unchanged')));
          return;
        }
        const r = await edit.mutateAsync({ id: task.id, body });
        toast.success(t('toast.edited'));
        onDone?.(r);
      } else {
        const r = await create.mutateAsync(toCreate(v, clientId.current));
        toast.success(t('toast.created', { who: r.assignee.name }));
        onDone?.(r);
      }
      onOpenChange(false);
    } catch (x) {
      setError(x);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      wide
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      description={editing ? t('form.editDesc') : t('form.newDesc')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={busy}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={() => void submit()} loading={busy}>
            {editing ? <Save className="size-4" aria-hidden /> : <ClipboardPlus className="size-4" aria-hidden />}
            {editing ? t('form.save') : t('form.submit')}
          </Button>
        </>
      }
    >
      <form className="grid gap-4 py-1 sm:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {!editing && (
          <>
            <Field label={t('form.branch')} required error={err('branchId')} help={t('form.branchHelp')}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} aria-invalid={!!errors.branchId} value={v.branchId} onChange={(e) => setV((s) => ({ ...s, branchId: e.target.value, assigneeId: '' }))}>
                  <option value="" disabled>—</option>
                  {(branches.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{pickText(b.name, locale)}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('form.assignee')} required error={err('assigneeId')} help={v.branchId && staff.data && staff.data.length === 0 ? t('form.noStaff') : undefined}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} aria-invalid={!!errors.assigneeId} value={v.assigneeId} onChange={(e) => set('assigneeId', e.target.value)} disabled={!v.branchId}>
                  <option value="" disabled>{t('form.pickAssignee')}</option>
                  {(staff.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>{pickText(u.name, locale)} · {u.employeeCode}</option>
                  ))}
                </Select>
              )}
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label={t('form.title')} required error={err('title')} counter={`${formatNumber(v.title.length)}/${formatNumber(TITLE_MAX)}`}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} lang={locale} value={v.title} placeholder={t('form.titlePlaceholder')} onChange={(e) => set('title', e.target.value)} autoFocus />}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('form.note')} error={err('note')} help={t('form.noteHelp')} counter={`${formatNumber(v.note.length)}/${formatNumber(NOTE_MAX)}`}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.note} lang={locale} rows={5} value={v.note} onChange={(e) => set('note', e.target.value)} />}
          </Field>
        </div>
        <Field label={t('form.due')} error={err('dueDate')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.dueDate} type="date" min={today} value={v.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="sm:w-52" />}
        </Field>
        {error ? <div className="sm:col-span-2"><ErrorBanner error={error} /></div> : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
