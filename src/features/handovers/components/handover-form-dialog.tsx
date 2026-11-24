'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { TriangleAlert, Users } from 'lucide-react';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Input, Select, Textarea } from '@/shared/ui/form';
import { Checkbox, Switch } from '@/shared/ui/primitives';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useCreateHandover, type Area, type User } from '../api/handovers';
import { areasOf, customersIn, emptyForm, REASON_MIN, toBody, validate, type HandoverErrors, type HandoverForm } from '../model/handover';

/** FR-HO-001/006: from, to, areas, effective date, optional end date (temporary cover), reason. */
export function HandoverFormDialog({ open, onOpenChange, staff, areas }: { open: boolean; onOpenChange: (o: boolean) => void; staff: User[]; areas: Area[] }) {
  const { t } = useTranslation('handovers');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const create = useCreateHandover();
  const today = todayDhaka();
  const [v, setV] = useState<HandoverForm>(emptyForm(today));
  const [errors, setErrors] = useState<HandoverErrors>({});
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setV(emptyForm(todayDhaka()));
      setErrors({});
      setError(null);
    }
  }, [open]);

  const set = <K extends keyof HandoverForm>(k: K, val: HandoverForm[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: keyof HandoverForm) => (errors[k] ? t(errors[k]!, { min: formatNumber(REASON_MIN) }) : undefined);
  const active = staff.filter((u) => u.active !== false);
  const held = useMemo(() => (v.fromUserId ? areasOf(v.fromUserId, areas) : []), [v.fromUserId, areas]);
  // The giver can be picked before the areas have loaded (slow link); tick the giver's areas once they arrive, as a
  // pick after loading does (no box could have been ticked or cleared before the areas were there).
  const areasLoaded = (areas?.length ?? 0) > 0;
  useEffect(() => {
    if (areasLoaded) setV((s) => (s.fromUserId && s.areaIds.length === 0 ? { ...s, areaIds: areasOf(s.fromUserId, areas).map((a) => a.id!) } : s));
  }, [areasLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const customers = customersIn(v.areaIds, areas);
  const label = (u: User) => `${pickText(u.name, locale)} · ${u.employeeCode ?? ''}`;

  const submit = async () => {
    const e = validate(v, today);
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    try {
      await create.mutateAsync(toBody(v));
      toast.success(t('created'));
      onOpenChange(false);
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
        <Field label={t('form.from')} required error={err('fromUserId')}>
          {(id, d) => (
            <Select
              id={id}
              aria-describedby={d}
              aria-invalid={!!errors.fromUserId}
              value={v.fromUserId}
              onChange={(e) => {
                const from = e.target.value;
                setV((s) => ({ ...s, fromUserId: from, toUserId: s.toUserId === from ? '' : s.toUserId, areaIds: areasOf(from, areas).map((a) => a.id!) }));
              }}
            >
              <option value="">{t('form.pick')}</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{label(u)}{u.active === false ? ` (${tc('status.inactive')})` : ''}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('form.to')} required error={err('toUserId')}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} aria-invalid={!!errors.toUserId} value={v.toUserId} onChange={(e) => set('toUserId', e.target.value)}>
              <option value="">{t('form.pick')}</option>
              {active.filter((u) => u.id !== v.fromUserId).map((u) => <option key={u.id} value={u.id}>{label(u)}</option>)}
            </Select>
          )}
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-base font-medium text-fg">{t('form.areas')}<span className="ms-0.5 text-danger" aria-hidden>*</span></legend>
          {!v.fromUserId ? (
            <p className="rounded-sm border border-dashed border-line px-3 py-4 text-center text-sm text-fg-tertiary">{t('form.areasPickFrom')}</p>
          ) : !held.length ? (
            <p className="rounded-sm border border-dashed border-line px-3 py-4 text-center text-sm text-fg-tertiary">{t('form.areasNone')}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {held.map((a) => {
                const on = v.areaIds.includes(a.id!);
                return (
                  <li key={a.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-line px-3 py-2 hover:bg-surface-hover has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-subtle/40">
                      <Checkbox checked={on} onCheckedChange={(c) => set('areaIds', c ? [...v.areaIds, a.id!] : v.areaIds.filter((x) => x !== a.id))} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" lang={locale}>{pickText(a.name, locale)}</span>
                      <span className="tabular text-xs text-fg-tertiary">{t('nCustomers', { n: formatNumber(a.customerCount ?? 0) })}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {errors.areaIds && v.fromUserId && held.length > 0 ? <p className="mt-1.5 text-xs text-danger">{err('areaIds')}</p> : null}
          {v.areaIds.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-secondary">
              <Users className="size-4" aria-hidden />
              {t('form.preview', { areas: formatNumber(v.areaIds.length), customers: formatNumber(customers) })}
            </p>
          )}
        </fieldset>

        <Field label={t('form.effective')} required error={err('effectiveDate')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.effectiveDate} type="date" min={today} value={v.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} />}
        </Field>
        <div className="space-y-1.5">
          <label className="flex min-h-9 items-center justify-between gap-3 text-base font-medium text-fg">
            {t('form.temporary')}
            <Switch checked={v.temporary} onCheckedChange={(c) => set('temporary', c)} />
          </label>
          {v.temporary ? (
            <Field label={t('form.end')} required error={err('endDate')} help={t('form.endHelp')}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.endDate} type="date" min={v.effectiveDate || today} value={v.endDate} onChange={(e) => set('endDate', e.target.value)} />}
            </Field>
          ) : (
            <p className="text-xs text-fg-secondary">{t('form.temporaryHelp')}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Field label={t('form.reason')} required error={err('reason')} counter={`${formatNumber(v.reason.trim().length)} / ${formatNumber(REASON_MIN)}+`}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.reason} rows={3} maxLength={500} value={v.reason} onChange={(e) => set('reason', e.target.value)} />}
          </Field>
        </div>

        <p className="flex items-start gap-2 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning sm:col-span-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('cashWarning')}
        </p>
        {error ? <div className="sm:col-span-2"><ErrorBanner error={error} /></div> : null}
      </form>
    </Dialog>
  );
}
