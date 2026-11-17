'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useBranches } from '@/features/shell';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, pickText } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Input } from '@/shared/ui/form';
import { Checkbox, Segmented } from '@/shared/ui/primitives';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useCreateHoliday, useDeleteHoliday, useSaveShift, type Holiday, type Shift } from '../api/leave';
import { emptyShift, fromShift, toHolidayCreate, toShift, validateHoliday, validateShift, WEEKDAYS, type HolidayForm, type ShiftForm } from '../model/calendar';

const choiceClass =
  'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border border-line px-3 py-2 hover:bg-surface-hover has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary-subtle';

/** FR-SET-002: add a national holiday or one for some branches. */
export function HolidayDialog({ open, onOpenChange, year, existing }: { open: boolean; onOpenChange: (o: boolean) => void; year: number; existing: Holiday[] }) {
  const { t } = useTranslation('attendance');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const branches = useBranches();
  const create = useCreateHoliday();
  const [v, setV] = useState<HolidayForm>({ date: '', nameBn: '', nameEn: '', branchIds: [] });
  const [scope, setScope] = useState<'national' | 'branch'>('national');
  const [errors, setErrors] = useState<Partial<Record<keyof HolidayForm | 'branchIds', string>>>({});
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setV({ date: '', nameBn: '', nameEn: '', branchIds: [] });
      setScope('national');
      setErrors({});
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const form = { ...v, branchIds: scope === 'branch' ? v.branchIds : [] };
    const e: typeof errors = validateHoliday(form, existing);
    if (scope === 'branch' && !form.branchIds.length) e.branchIds = 'calendar.errors.branch';
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    try {
      await create.mutateAsync(toHolidayCreate(form));
      toast.success(t('calendar.holidayAdded', { date: formatDate(form.date) }));
      onOpenChange(false);
    } catch (x) {
      setError(x);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !create.isPending && onOpenChange(o)}
      title={t('calendar.addHoliday')}
      description={t('calendar.addHolidayDesc')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={create.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={create.isPending}>{t('calendar.save')}</Button>
        </>
      }
    >
      <form className="grid gap-4 py-1" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label={t('calendar.date')} required error={errors.date ? t(errors.date) : undefined}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.date} type="date" min={`${year}-01-01`} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} autoFocus />}
        </Field>
        <Field label={t('calendar.nameBn')} required error={errors.nameBn ? t(errors.nameBn) : undefined}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.nameBn} lang="bn" maxLength={100} value={v.nameBn} onChange={(e) => setV({ ...v, nameBn: e.target.value })} />}
        </Field>
        <Field label={t('calendar.nameEn')} help={t('calendar.nameEnHelp')}>
          {(id, d) => <Input id={id} aria-describedby={d} lang="en" maxLength={100} value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} />}
        </Field>
        <fieldset aria-describedby={errors.branchIds ? 'holiday-branch-err' : undefined}>
          <legend className="mb-1.5 text-base font-medium text-fg">{t('calendar.scope')}</legend>
          <Segmented
            label={t('calendar.scope')}
            value={scope}
            onChange={setScope}
            options={[{ value: 'national', label: t('calendar.scopes.national') }, { value: 'branch', label: t('calendar.scopes.branch') }]}
          />
          {scope === 'branch' && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(branches.data ?? []).map((b) => (
                <label key={b.id} className={choiceClass}>
                  <Checkbox
                    checked={v.branchIds.includes(b.id!)}
                    onCheckedChange={(c) => setV({ ...v, branchIds: c ? [...v.branchIds, b.id!] : v.branchIds.filter((x) => x !== b.id) })}
                  />
                  <span className="truncate text-sm font-medium" lang={locale}>{pickText(b.name, locale)}</span>
                </label>
              ))}
            </div>
          )}
          {errors.branchIds && <p id="holiday-branch-err" className="mt-1.5 text-xs text-danger">{t(errors.branchIds)}</p>}
        </fieldset>
        {error ? <ErrorBanner error={error} /> : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/** Removing a holiday entered by mistake; days already worked out are not changed (field-api 1.12.0). */
export function DeleteHolidayDialog({ holiday, onOpenChange }: { holiday: Holiday | null; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('attendance');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const del = useDeleteHoliday();
  const [error, setError] = useState<unknown>(null);
  return (
    <Dialog
      open={!!holiday}
      onOpenChange={(o) => {
        if (del.isPending) return;
        setError(null);
        onOpenChange(o);
      }}
      title={t('calendar.deleteTitle')}
      description={holiday ? t('calendar.deleteDesc', { name: pickText(holiday.name, locale), date: formatDate(holiday.date!) }) : undefined}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={del.isPending}>{tc('actions.cancel')}</Button>
          <Button
            variant="destructive"
            loading={del.isPending}
            onClick={async () => {
              if (!holiday) return;
              setError(null);
              try {
                await del.mutateAsync(holiday.id!);
                toast.success(t('calendar.holidayDeleted'));
                onOpenChange(false);
              } catch (e) {
                setError(e);
              }
            }}
          >
            {t('calendar.delete')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-secondary">{t('calendar.deleteHelp')}</p>
      {error ? <ErrorBanner error={error} className="mt-3" /> : null}
    </Dialog>
  );
}

/** FR-SET-003: create or edit a work shift (hours, weekly off, late grace, break limit). */
export function ShiftDialog({ open, onOpenChange, shift }: { open: boolean; onOpenChange: (o: boolean) => void; shift: Shift | null }) {
  const { t } = useTranslation('attendance');
  const { t: tc } = useTranslation();
  const save = useSaveShift();
  const [v, setV] = useState<ShiftForm>(emptyShift());
  const [errors, setErrors] = useState<Partial<Record<keyof ShiftForm, string>>>({});
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setV(shift ? fromShift(shift) : emptyShift());
      setErrors({});
      setError(null);
    }
  }, [open, shift]);

  const err = (k: keyof ShiftForm) => (errors[k] ? t(errors[k]!) : undefined);
  const submit = async () => {
    const e = validateShift(v);
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    try {
      await save.mutateAsync({ id: shift?.id, body: toShift(v) });
      toast.success(shift ? t('calendar.shiftSaved') : t('calendar.shiftAdded'));
      onOpenChange(false);
    } catch (x) {
      setError(x);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !save.isPending && onOpenChange(o)}
      wide
      title={shift ? t('calendar.editShift', { name: shift.name }) : t('calendar.addShift')}
      description={t('calendar.shiftDesc')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={save.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={save.isPending}>{t('calendar.save')}</Button>
        </>
      }
    >
      <form className="grid gap-4 py-1 sm:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="sm:col-span-2">
          <Field label={t('calendar.shiftName')} required error={err('name')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} maxLength={60} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />}
          </Field>
        </div>
        <Field label={t('calendar.start')} required error={err('start')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.start} type="time" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} />}
        </Field>
        <Field label={t('calendar.end')} required error={err('end')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.end} type="time" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} />}
        </Field>
        <Field label={t('calendar.lateGrace')} error={err('lateGraceMin')} help={t('calendar.lateGraceHelp')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.lateGraceMin} inputMode="numeric" className="tabular" value={v.lateGraceMin} onChange={(e) => setV({ ...v, lateGraceMin: e.target.value })} />}
        </Field>
        <Field label={t('calendar.maxBreak')} error={err('maxBreakMin')} help={t('calendar.maxBreakHelp')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.maxBreakMin} inputMode="numeric" className="tabular" value={v.maxBreakMin} onChange={(e) => setV({ ...v, maxBreakMin: e.target.value })} />}
        </Field>
        <fieldset className="sm:col-span-2" aria-describedby={errors.weeklyOff ? 'shift-off-err' : undefined}>
          <legend className="mb-1.5 text-base font-medium text-fg">{t('calendar.weeklyOff')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEEKDAYS.map((d) => (
              <label key={d} className={choiceClass}>
                <Checkbox
                  checked={v.weeklyOff.includes(d)}
                  onCheckedChange={(c) => setV({ ...v, weeklyOff: c ? [...v.weeklyOff, d] : v.weeklyOff.filter((x) => x !== d) })}
                />
                <span className="text-sm font-medium">{t(`calendar.weekday.${d}`)}</span>
              </label>
            ))}
          </div>
          {errors.weeklyOff && <p id="shift-off-err" className="mt-1.5 text-xs text-danger">{t(errors.weeklyOff)}</p>}
        </fieldset>
        {error ? <div className="sm:col-span-2"><ErrorBanner error={error} /></div> : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
