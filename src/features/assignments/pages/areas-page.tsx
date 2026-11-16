'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MapPinned, PencilLine, Plus, TriangleAlert, UserPlus, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useCan } from '@/shared/auth/session';
import { formatNumber, pickText } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/page';
import { Card } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Input, Select } from '@/shared/ui/form';
import { Switch } from '@/shared/ui/primitives';
import { useAreas, useAssignArea, useAssignments, useEndAssignment, useSaveArea, useStaff, type Area } from '../api/assignments';
import { assignmentFor, coverage, emptyForm, fromArea, sortAreas, toBody, validate, type AreaErrors, type AreaForm } from '../model/area';

export function AreasPage() {
  const { t } = useTranslation('assignments');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branchId = useUi((s) => s.branchId);
  const canManage = useCan('assignment.manage');
  const areas = useAreas();
  const assignments = useAssignments();
  const staff = useStaff();
  const end = useEndAssignment();
  const [form, setForm] = useState<{ area: Area | null } | null>(null);
  const [assignTo, setAssignTo] = useState<Area | null>(null);
  const [remove, setRemove] = useState<{ area: Area; userId: string } | null>(null);

  const names = useMemo(() => new Map((staff.data ?? []).map((u) => [u.id, pickText(u.name, locale)])), [staff.data, locale]);
  const list = useMemo(() => sortAreas(areas.data ?? []), [areas.data]);
  const cov = coverage(areas.data);
  const nameOf = (id: string) => names.get(id) ?? t('unknownStaff');

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setForm({ area: null })} disabled={!branchId} title={!branchId ? t('pickBranch') : undefined}>
              <Plus className="size-4" aria-hidden />
              {t('new')}
            </Button>
          ) : undefined
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      {areas.error ? <ErrorBanner error={areas.error} onRetry={() => areas.refetch()} /> : null}
      {!areas.isLoading && cov.uncovered > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-warning-bg px-4 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t('uncovered', { areas: formatNumber(cov.uncovered), customers: formatNumber(cov.uncoveredCustomers) })}{' '}
            <Link href="/customers/?filter=unassigned" className="font-medium underline underline-offset-2">{t('seeUnassigned')}</Link>
          </span>
        </p>
      )}

      {areas.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-md" />)}</div>
      ) : !list.length ? (
        <Card><EmptyState icon={MapPinned} title={t('empty')} body={t('emptyBody')} /></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const bare = !a.assignees?.length && a.active !== false;
            const name = pickText(a.name, locale);
            return (
              <li key={a.id} className={cn('flex flex-col rounded-md border bg-surface shadow-e1', bare ? 'border-warning' : 'border-line', a.active === false && 'opacity-70')}>
                <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
                  <div className="min-w-0">
                    <h2 className="truncate text-md font-semibold text-fg" lang={locale}>{name}</h2>
                    <p className="font-mono text-xs text-fg-tertiary">{a.code}</p>
                  </div>
                  {a.active === false ? <Badge tone="neutral" icon={false}>{t('inactive')}</Badge> : bare ? <Badge tone="warning">{t('noOne')}</Badge> : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-px border-y border-line bg-line [&>*]:bg-surface">
                  <div className="px-4 py-2.5">
                    <dt className="text-xs text-fg-tertiary">{t('customers')}</dt>
                    <dd className="tabular text-md font-semibold text-fg">{formatNumber(a.customerCount ?? 0)}</dd>
                  </div>
                  <div className="min-w-0 px-4 py-2.5">
                    <dt className="text-xs text-fg-tertiary">{t('erpCodes')}</dt>
                    <dd className="truncate font-mono text-sm text-fg">{(a.erpAreaCodes ?? []).join(', ') || '—'}</dd>
                  </div>
                </dl>
                <div className="flex-1 px-4 py-3">
                  <p className="mb-1.5 text-xs font-medium text-fg-tertiary">{t('assignees')}</p>
                  {a.assignees?.length ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {a.assignees.map((uid) => (
                        <li key={uid} className="inline-flex items-center gap-1 rounded-full bg-surface-hover py-0.5 ps-2.5 pe-1 text-sm text-fg">
                          <span lang={locale}>{nameOf(uid)}</span>
                          {canManage && (
                            <button type="button" onClick={() => setRemove({ area: a, userId: uid })} className="grid size-6 place-items-center rounded-full text-fg-secondary hover:bg-surface hover:text-danger [@media(pointer:coarse)]:size-9" aria-label={t('removeFrom', { name: nameOf(uid), area: name })}>
                              <X className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-fg-tertiary">{t('nobody')}</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex justify-end gap-2 border-t border-line px-4 py-2.5">
                    <Button size="sm" variant="ghost" onClick={() => setForm({ area: a })} aria-label={t('editArea', { area: name })}>
                      <PencilLine className="size-3.5" aria-hidden />
                      {t('edit')}
                    </Button>
                    {a.active !== false && (
                      <Button size="sm" onClick={() => setAssignTo(a)} aria-label={t('assignIn', { area: name })}>
                        <UserPlus className="size-3.5" aria-hidden />
                        {t('assign')}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AreaFormDialog target={form} onClose={() => setForm(null)} areas={areas.data ?? []} branchId={form?.area?.branchId ?? branchId ?? ''} />
      <AssignDialog area={assignTo} onClose={() => setAssignTo(null)} staff={(staff.data ?? []).map((u) => ({ id: u.id!, name: pickText(u.name, locale), code: u.employeeCode ?? '' }))} />
      <Dialog
        open={!!remove}
        onOpenChange={(o) => !o && !end.isPending && setRemove(null)}
        title={t('removeTitle')}
        description={remove ? t('removeDesc', { name: nameOf(remove.userId), area: pickText(remove.area.name, locale), n: formatNumber(remove.area.customerCount ?? 0) }) : undefined}
        footer={
          <>
            <Button onClick={() => setRemove(null)} disabled={end.isPending}>{t('keep')}</Button>
            <Button
              variant="destructive"
              loading={end.isPending}
              disabled={!remove || !assignmentFor(assignments.data, remove.area.id!, remove.userId)}
              onClick={() => end.mutate(assignmentFor(assignments.data, remove!.area.id!, remove!.userId)!.id!, { onSuccess: () => (toast.success(t('removed')), setRemove(null)) })}
            >
              {t('remove')}
            </Button>
          </>
        }
      >
        {end.error ? <ErrorBanner error={end.error} /> : null}
        {remove && remove.area.assignees?.length === 1 && (
          <p className="flex items-start gap-2 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('lastOne')}
          </p>
        )}
      </Dialog>
    </>
  );
}

function AssignDialog({ area, onClose, staff }: { area: Area | null; onClose: () => void; staff: { id: string; name: string; code: string }[] }) {
  const { t } = useTranslation('assignments');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const assign = useAssignArea();
  const [userId, setUserId] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (area) {
      setUserId('');
      setMissing(false);
      assign.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area]);
  const free = staff.filter((u) => !area?.assignees?.includes(u.id));
  const name = pickText(area?.name, locale);
  return (
    <Dialog
      open={!!area}
      onOpenChange={(o) => !o && !assign.isPending && onClose()}
      title={t('assignTitle', { area: name })}
      description={t('assignDesc')}
      footer={
        <>
          <Button onClick={onClose} disabled={assign.isPending}>{tc('actions.cancel')}</Button>
          <Button
            variant="primary"
            loading={assign.isPending}
            onClick={() => {
              if (!userId) return setMissing(true);
              assign.mutate({ userId, areaId: area!.id! }, { onSuccess: () => (toast.success(t('assigned')), onClose()) });
            }}
          >
            {t('assign')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
        <Field label={t('staff')} required error={missing && !userId ? t('errors.required') : undefined}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">{t('pick')}</option>
              {free.map((u) => <option key={u.id} value={u.id}>{`${u.name} · ${u.code}`}</option>)}
            </Select>
          )}
        </Field>
        {assign.error ? <ErrorBanner error={assign.error} /> : null}
      </div>
    </Dialog>
  );
}

function AreaFormDialog({ target, onClose, areas, branchId }: { target: { area: Area | null } | null; onClose: () => void; areas: Area[]; branchId: string }) {
  const { t } = useTranslation('assignments');
  const { t: tc } = useTranslation();
  const save = useSaveArea();
  const [v, setV] = useState<AreaForm>(emptyForm());
  const [errors, setErrors] = useState<AreaErrors>({});
  const area = target?.area ?? null;
  useEffect(() => {
    if (target) {
      setV(target.area ? fromArea(target.area) : emptyForm());
      setErrors({});
      save.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const set = <K extends keyof AreaForm>(k: K, val: AreaForm[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: keyof AreaForm) => (errors[k] ? t(errors[k]!) : undefined);
  const submit = () => {
    const e = validate(v, areas, area?.id);
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate({ id: area?.id, version: area?.version, body: toBody(v, branchId, area ?? undefined) }, { onSuccess: () => (toast.success(t('saved')), onClose()) });
  };
  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => !o && !save.isPending && onClose()}
      wide
      title={area ? t('form.editTitle') : t('form.createTitle')}
      description={t('form.desc')}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={save.isPending}>{t('form.save')}</Button>
        </>
      }
    >
      <form className="grid gap-4 py-1 sm:grid-cols-2" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
        <Field label={t('form.nameBn')} required error={err('nameBn')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.nameBn} lang="bn" value={v.nameBn} onChange={(e) => set('nameBn', e.target.value)} />}
        </Field>
        <Field label={t('form.nameEn')} required error={err('nameEn')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.nameEn} lang="en" value={v.nameEn} onChange={(e) => set('nameEn', e.target.value)} />}
        </Field>
        <Field label={t('form.code')} required error={err('code')} help={t('form.codeHelp')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.code} className="font-mono uppercase" value={v.code} onChange={(e) => set('code', e.target.value)} />}
        </Field>
        <Field label={t('erpCodes')} required error={err('erpCodes')} help={t('form.erpHelp')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.erpCodes} className="font-mono uppercase" value={v.erpCodes} onChange={(e) => set('erpCodes', e.target.value)} />}
        </Field>
        {area && (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-sm border border-line px-3 text-base font-medium text-fg sm:col-span-2">
            {t('form.active')}
            <Switch checked={v.active} onCheckedChange={(c) => set('active', c)} />
          </label>
        )}
        {save.error ? <div className="sm:col-span-2"><ErrorBanner error={save.error} /></div> : null}
      </form>
    </Dialog>
  );
}
