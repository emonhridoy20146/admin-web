'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useBranches } from '@/features/shell';
import { useUi } from '@/shared/lib/ui-store';
import { pickText } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Input, Select, Textarea } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Segmented } from '@/shared/ui/primitives';
import { CustomerPicker } from '@/shared/ui/customer-picker';
import { useCreateRequest, useRequestAction, useRequestPeople, type Request } from '../api/requests';
import { dueAtOf, validateCreate, type CreateErrors, type CreateForm } from '../model/requests';

const TYPES = ['request', 'report', 'inform', 'complaint'] as const;

/** FR-W-070: office users send a request (request.create). One clientId per opening, so a retry never sends it twice. */
export function CreateRequestDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (r: Request) => void }) {
  const { t } = useTranslation('requests');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const branchId = useUi((s) => s.branchId);
  const branches = useBranches();
  const create = useCreateRequest();
  const clientId = useRef('');
  const empty = (): CreateForm => ({ type: 'request', priority: 'normal', title: '', body: '', customerId: '', customerName: '', due: '', branchId: branchId || '' });
  const [v, setV] = useState<CreateForm>(empty);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      clientId.current = crypto.randomUUID();
      setV(empty());
      setErrors({});
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    // with "All branches" chosen, start on the first branch the user can see
    if (open && !v.branchId && branches.data?.[0]?.id) setV((s) => ({ ...s, branchId: branches.data![0]!.id! }));
  }, [open, v.branchId, branches.data]);

  const set = <K extends keyof CreateForm>(k: K, val: CreateForm[K]) => setV((s) => ({ ...s, [k]: val }));
  const submit = async () => {
    const e = validateCreate(v);
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    try {
      const r = await create.mutateAsync({
        clientId: clientId.current, type: v.type, priority: v.priority, title: v.title.trim(), body: v.body.trim(),
        customerId: v.customerId || undefined, dueAt: dueAtOf(v.due), branchId: v.branchId,
      });
      toast.success(t('form.created'));
      onOpenChange(false);
      onCreated?.(r);
    } catch (x) {
      setError(x);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !create.isPending && onOpenChange(o)}
      wide
      title={t('form.title')}
      description={t('form.desc')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={create.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={create.isPending}>{t('form.submit')}</Button>
        </>
      }
    >
      <form className="grid gap-4 py-1 sm:grid-cols-2" noValidate onSubmit={(e) => (e.preventDefault(), void submit())}>
        {error ? <div className="sm:col-span-2"><ErrorBanner error={error} /></div> : null}
        <Field label={t('form.type')} required>
          {(id) => (
            <Select id={id} value={v.type} onChange={(e) => set('type', e.target.value as CreateForm['type'])}>
              {TYPES.map((x) => <option key={x} value={x}>{t(`type.${x}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('form.priority')} required help={t(`form.priorityHelp.${v.priority}`)}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={v.priority} onChange={(e) => set('priority', e.target.value as CreateForm['priority'])}>
              <option value="normal">{t('priority.normal')}</option>
              <option value="important">{t('priority.important')}</option>
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('form.titleLabel')} required error={errors.title ? t(errors.title) : undefined} counter={`${v.title.length}/160`}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} value={v.title} maxLength={160} onChange={(e) => set('title', e.target.value)} />}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('form.body')} required error={errors.body ? t(errors.body) : undefined}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.body} rows={5} value={v.body} maxLength={4000} onChange={(e) => set('body', e.target.value)} />}
          </Field>
        </div>
        <Field label={t('form.customer')}>
          {(id) => <CustomerPicker id={id} value={v.customerId} displayName={v.customerName} onChange={(cid, name) => setV((s) => ({ ...s, customerId: cid, customerName: name }))} />}
        </Field>
        <Field label={t('form.due')}>
          {(id) => <Input id={id} type="date" className="tabular" value={v.due} onChange={(e) => set('due', e.target.value)} />}
        </Field>
        <Field label={t('form.branch')} required error={errors.branchId ? t(errors.branchId) : undefined}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={v.branchId} onChange={(e) => set('branchId', e.target.value)}>
              {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{pickText(b.name, locale)}</option>)}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}

function PersonSelect({ id, value, onChange, describedBy, invalid }: { id: string; value: string; onChange: (v: string) => void; describedBy?: string; invalid?: boolean }) {
  const { t } = useTranslation('requests');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const people = useRequestPeople(true);
  return (
    <Select id={id} aria-describedby={describedBy} aria-invalid={invalid} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('forward.pickPerson')}</option>
      {(people.data ?? []).map((u) => (
        <option key={u.id} value={u.id}>{pickText(u.name, locale)} · {tc(`role.${u.role}`, { defaultValue: u.role ?? '' })}</option>
      ))}
    </Select>
  );
}

/** Forward to a queue or a person, with a note (required; it goes on the timeline). */
export function ForwardDialog({ r, open, onOpenChange, allowSuperAdminQueue }: { r: Request; open: boolean; onOpenChange: (o: boolean) => void; allowSuperAdminQueue: boolean }) {
  const { t } = useTranslation('requests');
  const { t: tc } = useTranslation();
  const act = useRequestAction();
  const [to, setTo] = useState<'queue' | 'person'>('queue');
  const [queue, setQueue] = useState<'area_manager' | 'super_admin'>('super_admin');
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open) {
      setTo('queue');
      // the obvious move is to the other queue
      setQueue(r.currentQueue === 'super_admin' ? 'area_manager' : allowSuperAdminQueue || r.currentQueue !== 'area_manager' ? 'super_admin' : 'area_manager');
      setUserId('');
      setNote('');
      setTouched(false);
      setError(null);
    }
  }, [open, r.currentQueue, allowSuperAdminQueue]);
  const noteErr = touched && !note.trim() ? t('form.errors.note') : undefined;
  const personErr = touched && to === 'person' && !userId ? t('form.errors.person') : undefined;
  const submit = async () => {
    setTouched(true);
    if (!note.trim() || (to === 'person' && !userId)) return;
    setError(null);
    try {
      await act.mutateAsync({ id: r.id, kind: 'forward', body: to === 'queue' ? { queue, note: note.trim() } : { userId, note: note.trim() } });
      toast.success(t('forward.done'));
      onOpenChange(false);
    } catch (x) {
      setError(x);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !act.isPending && onOpenChange(o)}
      title={t('forward.title')}
      description={t('forward.desc')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={act.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={act.isPending}>{t('forward.submit')}</Button>
        </>
      }
    >
      <form className="space-y-4 py-1" noValidate onSubmit={(e) => (e.preventDefault(), void submit())}>
        {error ? <ErrorBanner error={error} /> : null}
        <Segmented label={t('forward.to')} value={to} onChange={setTo} options={[{ value: 'queue', label: t('forward.toQueue') }, { value: 'person', label: t('forward.toPerson') }]} />
        {to === 'queue' ? (
          <Field label={t('forward.queue')} required>
            {(id) => (
              <Select id={id} value={queue} onChange={(e) => setQueue(e.target.value as 'area_manager' | 'super_admin')}>
                <option value="area_manager">{t('queue.area_manager')}</option>
                <option value="super_admin">{t('queue.super_admin')}</option>
              </Select>
            )}
          </Field>
        ) : (
          <Field label={t('forward.person')} required error={personErr}>
            {(id, d) => <PersonSelect id={id} describedBy={d} invalid={!!personErr} value={userId} onChange={setUserId} />}
          </Field>
        )}
        <Field label={t('forward.note')} required error={noteErr} counter={`${note.length}/1000`}>
          {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!noteErr} rows={3} maxLength={1000} placeholder={t('forward.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </form>
    </Dialog>
  );
}

/** Give the request to one person (note optional). */
export function AssignDialog({ r, open, onOpenChange }: { r: Request; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('requests');
  const { t: tc } = useTranslation();
  const act = useRequestAction();
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open) {
      setUserId(r.assignee?.id ?? '');
      setNote('');
      setTouched(false);
      setError(null);
    }
  }, [open, r.assignee?.id]);
  const personErr = touched && !userId ? t('form.errors.person') : undefined;
  const submit = async () => {
    setTouched(true);
    if (!userId) return;
    setError(null);
    try {
      await act.mutateAsync({ id: r.id, kind: 'assign', body: { userId, note: note.trim() || undefined } });
      toast.success(t('assign.done'));
      onOpenChange(false);
    } catch (x) {
      setError(x);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !act.isPending && onOpenChange(o)}
      title={t('assign.title')}
      description={t('assign.desc')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={act.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={act.isPending}>{t('assign.submit')}</Button>
        </>
      }
    >
      <form className="space-y-4 py-1" noValidate onSubmit={(e) => (e.preventDefault(), void submit())}>
        {error ? <ErrorBanner error={error} /> : null}
        <Field label={t('assign.person')} required error={personErr}>
          {(id, d) => <PersonSelect id={id} describedBy={d} invalid={!!personErr} value={userId} onChange={setUserId} />}
        </Field>
        <Field label={t('assign.note')} counter={`${note.length}/1000`}>
          {(id) => <Textarea id={id} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </form>
    </Dialog>
  );
}
