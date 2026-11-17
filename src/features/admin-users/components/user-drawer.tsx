'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { KeyRound, Pencil, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useShifts } from '@/features/attendance';
import { useUi } from '@/shared/lib/ui-store';
import { useCan, useSession } from '@/shared/auth/session';
import { formatDateTime, formatMoney, formatRelative, pickText } from '@/shared/lib/format';
import { Drawer, Dialog } from '@/shared/ui/overlay';
import { DescList } from '@/shared/ui/page';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useResetPassword, useSetActive, useUser } from '../api/users';
import { UserFormDialog } from './user-form-dialog';
import { TempPasswordDialog } from './temp-password-dialog';

export function UserDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation('admin-users');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const me = useSession((s) => s.user?.id);
  const canManage = useCan('user.manage');
  const canRbac = useCan('rbac.view');
  const q = useUser(id);
  const branches = useBranches();
  const shifts = useShifts();
  const reset = useResetPassword();
  const setActive = useSetActive();
  const [edit, setEdit] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [deactivate, setDeactivate] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const u = q.data;
  const name = u ? pickText(u.name, locale) : '';
  const self = !!u && u.id === me;

  return (
    <>
      <Drawer
        open={!!id}
        onOpenChange={(o) => !o && onClose()}
        title={u ? <span lang={locale}>{name}</span> : <Skeleton className="h-6 w-40" />}
        subtitle={
          u ? (
            <span className="font-mono">
              {u.employeeCode}
              {u.username ? ` · ${u.username}` : ''}
            </span>
          ) : undefined
        }
        footer={
          u && canManage ? (
            <div className="flex w-full flex-wrap gap-2">
              <Button variant="primary" onClick={() => setEdit(true)}>
                <Pencil className="size-4" aria-hidden />
                {t('drawer.edit')}
              </Button>
              <Button onClick={() => setConfirmReset(true)} disabled={!u.active}>
                <KeyRound className="size-4" aria-hidden />
                {t('drawer.reset')}
              </Button>
              {u.active ? (
                <Button
                  variant="ghost"
                  className="ms-auto text-danger hover:text-danger"
                  onClick={() => setDeactivate(true)}
                  disabled={self}
                >
                  <UserX className="size-4" aria-hidden />
                  {t('drawer.deactivate')}
                </Button>
              ) : (
                <Button
                  className="ms-auto"
                  loading={setActive.isPending}
                  onClick={() =>
                    setActive.mutate(
                      { id: u.id!, active: true },
                      { onSuccess: () => (void q.refetch(), toast.success(t('drawer.activated'))) },
                    )
                  }
                >
                  <UserCheck className="size-4" aria-hidden />
                  {t('drawer.activate')}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="p-5">
          {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
          {q.isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {u && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={u.role === 'super_admin' ? 'info' : 'neutral'} icon={false}>
                  {tc(`role.${u.role}`)}
                </Badge>
                {u.active ? (
                  <Badge tone="success">{t('status.active')}</Badge>
                ) : (
                  <Badge tone="danger">{t('status.inactive')}</Badge>
                )}
                {u.mustChangePassword && <Badge tone="warning">{t('mustChange')}</Badge>}
              </div>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                  {t('drawer.profile')}
                </h3>
                <DescList
                  items={[
                    { label: t('form.nameBn'), value: <span lang="bn">{u.name?.bn}</span> },
                    { label: t('form.nameEn'), value: <span lang="en">{u.name?.en}</span> },
                    { label: t('col.phone'), value: <span className="font-mono">{u.phone}</span> },
                    {
                      label: t('form.erpId'),
                      value: <span className="font-mono">{u.erpEmployeeId ?? '—'}</span>,
                    },
                  ]}
                />
              </section>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                  {t('drawer.access')}
                </h3>
                <DescList
                  items={[
                    {
                      label: t('col.branches'),
                      value:
                        u.role === 'super_admin'
                          ? t('allBranches')
                          : (u.branchIds ?? [])
                              .map((b) => pickText(branches.data?.find((x) => x.id === b)?.name, locale) || b)
                              .join(', '),
                    },
                    ...(u.role === 'field_staff'
                      ? [
                          {
                            label: t('col.cashLimit'),
                            value:
                              u.cashLimitPoisha != null ? formatMoney(u.cashLimitPoisha) : t('defaultLimit'),
                          },
                          {
                            label: t('form.shift'),
                            value: (() => {
                              const sh = shifts.data?.find((x) => x.id === u.shiftId);
                              return sh ? `${sh.name} · ${sh.start}–${sh.end}` : t('form.noShift');
                            })(),
                          },
                        ]
                      : []),
                    {
                      label: t('drawer.lastLogin'),
                      value: u.lastLoginAt ? (
                        <span title={formatDateTime(u.lastLoginAt)}>{formatRelative(u.lastLoginAt)}</span>
                      ) : (
                        <span className="text-fg-tertiary">{t('never')}</span>
                      ),
                    },
                  ]}
                />
                {canRbac && (
                  <Link
                    href={`/admin/permissions/?user=${u.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ShieldCheck className="size-4" aria-hidden />
                    {t('drawer.permissions')}
                  </Link>
                )}
              </section>
            </div>
          )}
        </div>
      </Drawer>

      {u && (
        <>
          <UserFormDialog open={edit} onOpenChange={(o) => (setEdit(o), !o && void q.refetch())} user={u} />
          <Dialog
            open={confirmReset}
            onOpenChange={(o) => !reset.isPending && setConfirmReset(o)}
            title={t('drawer.resetTitle', { name })}
            description={t('drawer.resetDesc')}
            footer={
              <>
                <Button onClick={() => setConfirmReset(false)} disabled={reset.isPending}>
                  {tc('actions.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  loading={reset.isPending}
                  onClick={() =>
                    reset.mutate(u.id!, {
                      onSuccess: (r) => (setConfirmReset(false), setTemp(r.temporaryPassword ?? null)),
                    })
                  }
                >
                  {t('drawer.resetConfirm')}
                </Button>
              </>
            }
          >
            {reset.error ? <ErrorBanner error={reset.error} /> : null}
          </Dialog>
          <ReasonDialog
            open={deactivate}
            onOpenChange={setDeactivate}
            title={t('drawer.deactivateTitle', { name })}
            description={t('drawer.deactivateDesc')}
            codes={(['left', 'leave', 'security', 'other'] as const).map((c) => [
              c,
              t(`deactivateCodes.${c}`),
            ])}
            minLength={5}
            destructive
            confirmLabel={t('drawer.deactivate')}
            onSubmit={async ({ reasonCode, reason }) => {
              await setActive.mutateAsync({
                id: u.id!,
                active: false,
                reason: `${t(`deactivateCodes.${reasonCode}`, { lng: 'en' })}: ${reason}`,
              });
              void q.refetch();
              toast.success(t('drawer.deactivated'));
            }}
          />
          <TempPasswordDialog value={temp} name={name} onClose={() => setTemp(null)} />
        </>
      )}
    </>
  );
}
