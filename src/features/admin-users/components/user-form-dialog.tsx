'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useBranches } from '@/features/shell';
import { useUi } from '@/shared/lib/ui-store';
import { pickText } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Input, Select } from '@/shared/ui/form';
import { Checkbox } from '@/shared/ui/primitives';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useCreateUser, useUpdateUser, type User } from '../api/users';
import {
  changedKeys,
  emptyForm,
  fromUser,
  ROLES,
  toCreate,
  toUpdate,
  validate,
  type UserFormErrors,
  type UserFormValues,
} from '../model/user-form';

/** Create (user = null) or edit a user. Edit asks for a reason and sends only changed fields with If-Match. */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: User | null;
  onCreated?: (r: { user?: User; temporaryPassword?: string }) => void;
}) {
  const { t } = useTranslation('admin-users');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const branchId = useUi((s) => s.branchId);
  const branches = useBranches();
  const create = useCreateUser();
  const update = useUpdateUser();
  const [v, setV] = useState<UserFormValues>(emptyForm());
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [reasonOpen, setReasonOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setV(user ? fromUser(user) : emptyForm(branchId || undefined));
      setErrors({});
      setError(null);
    }
  }, [open, user, branchId]);

  const set = <K extends keyof UserFormValues>(k: K, val: UserFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));
  const err = (k: keyof UserFormValues) => (errors[k] ? t(errors[k]!) : undefined);
  const pending = user ? toUpdate(user, v, '') : null;

  const submit = async () => {
    const e = validate(v);
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    if (!user) {
      try {
        const r = await create.mutateAsync(toCreate(v));
        toast.success(t('created'));
        onOpenChange(false);
        onCreated?.(r);
      } catch (x) {
        setError(x);
      }
      return;
    }
    if (!pending || changedKeys(pending).length === 0) {
      toast.info(t('form.noChanges'));
      return;
    }
    setReasonOpen(true);
  };

  const busy = create.isPending || update.isPending;
  const name = user ? pickText(user.name, locale) : '';

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !busy && onOpenChange(o)}
        wide
        title={user ? t('form.editTitle', { name }) : t('form.createTitle')}
        footer={
          <>
            <Button onClick={() => onOpenChange(false)} disabled={busy}>
              {tc('actions.cancel')}
            </Button>
            <Button variant="primary" onClick={submit} loading={busy}>
              {user ? t('form.save') : t('form.create')}
            </Button>
          </>
        }
      >
        <form
          className="grid gap-4 py-1 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label={t('form.nameBn')} required error={err('nameBn')}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!errors.nameBn}
                lang="bn"
                value={v.nameBn}
                onChange={(e) => set('nameBn', e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Field label={t('form.nameEn')} required error={err('nameEn')}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!errors.nameEn}
                lang="en"
                value={v.nameEn}
                onChange={(e) => set('nameEn', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('form.phone')} required error={err('phone')} help={t('form.phoneHelp')}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!errors.phone}
                inputMode="tel"
                autoComplete="off"
                className="font-mono"
                value={v.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('form.username')} error={err('username')} help={t('form.usernameHelp')}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!errors.username}
                autoComplete="off"
                className="font-mono"
                value={v.username}
                disabled={!!user}
                onChange={(e) => set('username', e.target.value.toLowerCase())}
              />
            )}
          </Field>
          <Field label={t('form.role')} required help={t(`form.roleHelp.${v.role}`)}>
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                value={v.role}
                onChange={(e) => set('role', e.target.value as UserFormValues['role'])}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tc(`role.${r}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('form.code')} required error={err('employeeCode')}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!errors.employeeCode}
                className="font-mono"
                value={v.employeeCode}
                disabled={!!user}
                onChange={(e) => set('employeeCode', e.target.value)}
              />
            )}
          </Field>
          {v.role !== 'super_admin' && (
            <fieldset
              className="sm:col-span-2"
              aria-describedby={errors.branchIds ? 'branch-err' : undefined}
            >
              <legend className="mb-1.5 text-base font-medium text-fg">
                {t('form.branches')}
                <span className="ms-0.5 text-danger" aria-hidden>
                  *
                </span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(branches.data ?? []).map((b) => {
                  const checked = v.branchIds.includes(b.id!);
                  return (
                    <label
                      key={b.id}
                      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border border-line px-3 py-2 hover:bg-surface-hover has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary-subtle"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) =>
                          set(
                            'branchIds',
                            c ? [...v.branchIds, b.id!] : v.branchIds.filter((x) => x !== b.id),
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium" lang={locale}>
                          {pickText(b.name, locale)}
                        </span>
                        <span className="block font-mono text-xs text-fg-tertiary">{b.code}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.branchIds && (
                <p id="branch-err" className="mt-1.5 text-xs text-danger">
                  {t(errors.branchIds)}
                </p>
              )}
            </fieldset>
          )}
          <Field label={t('form.erpId')} help={t('form.erpIdHelp')}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                className="font-mono"
                value={v.erpEmployeeId}
                disabled={!!user}
                onChange={(e) => set('erpEmployeeId', e.target.value)}
              />
            )}
          </Field>
          {v.role === 'field_staff' && (
            <Field label={t('form.cashLimit')} error={err('cashLimitTaka')} help={t('form.cashLimitHelp')}>
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  aria-invalid={!!errors.cashLimitTaka}
                  inputMode="numeric"
                  className="tabular"
                  value={v.cashLimitTaka}
                  onChange={(e) => set('cashLimitTaka', e.target.value)}
                />
              )}
            </Field>
          )}
          {error ? (
            <div className="sm:col-span-2">
              <ErrorBanner error={error} />
            </div>
          ) : null}
          <button type="submit" hidden />
        </form>
      </Dialog>

      {user && pending && (
        <ReasonDialog
          open={reasonOpen}
          onOpenChange={setReasonOpen}
          title={t('form.saveTitle', { name })}
          description={t('form.saveDesc', {
            fields: changedKeys(pending)
              .map((k) => t(`fields.${k}`))
              .join(', '),
          })}
          minLength={5}
          confirmLabel={t('form.save')}
          onSubmit={async ({ reason }) => {
            await update.mutateAsync({ id: user.id!, version: user.version, body: { ...pending, reason } });
            toast.success(t('form.saved'));
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
