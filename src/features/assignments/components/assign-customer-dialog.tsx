'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { UserMinus } from 'lucide-react';
import { useUi } from '@/shared/lib/ui-store';
import { pickText } from '@/shared/lib/format';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Button } from '@/shared/ui/button';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Select, Textarea } from '@/shared/ui/form';
import type { components } from '@/shared/api/schema';
import { useAssignCustomer, useCustomerAssignment, useEndAssignment, useStaffOf } from '../api/assignments';

type Customer = Pick<components['schemas']['CustomerListItem'], 'id' | 'name' | 'branchId' | 'assignee' | 'areaName'>;

/**
 * Extension point for one customer (FR-ASG-002): give the customer to a staff member of its branch, or end a direct
 * assignment so the customer goes back to the area's staff member (or to nobody). The server recomputes the primary
 * assignee; the staff member's phone gets or loses the customer on its next sync.
 */
export function AssignCustomerDialog({ open, customer, onClose }: { open: boolean; customer: Customer; onClose: () => void }) {
  const { t } = useTranslation('assignments');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const staff = useStaffOf(customer.branchId);
  const direct = useCustomerAssignment(open ? customer.id : null);
  const assign = useAssignCustomer();
  const end = useEndAssignment();
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (open) {
      setUserId('');
      setReason('');
      setMissing(false);
      assign.reset();
      end.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const name = pickText(customer.name, locale);
  const now = customer.assignee?.name;
  const busy = assign.isPending || end.isPending;
  const staffName = (id: string) => pickText(staff.data?.find((u) => u.id === id)?.name, locale) || t('unknownStaff');
  const sameAsNow = !!userId && userId === customer.assignee?.id && !!direct.data;
  const area = customer.areaName ? pickText(customer.areaName, locale) : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={now ? t('one.titleChange', { name }) : t('one.title', { name })}
      description={t('one.desc')}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>{tc('actions.cancel')}</Button>
          <Button
            variant="primary"
            loading={assign.isPending}
            disabled={end.isPending || sameAsNow}
            onClick={() => {
              if (!userId) return setMissing(true);
              assign.mutate(
                { userId, customerId: customer.id!, reason: reason.trim() || undefined },
                { onSuccess: () => (toast.success(t('one.done', { name, staff: staffName(userId) })), onClose()) },
              );
            }}
          >
            {t('one.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1">
        <div className="rounded-md border border-line bg-surface-subtle px-4 py-3 text-sm">
          <p className="text-xs text-fg-tertiary">{t('one.now')}</p>
          {direct.isLoading ? (
            <Skeleton className="mt-1 h-5 w-48" />
          ) : (
            <>
              <p className="mt-0.5 font-medium text-fg">{now ?? t('nobody')}</p>
              <p className="mt-0.5 text-fg-secondary">
                {direct.data ? t('one.viaDirect') : now ? (area ? t('one.viaArea', { area }) : t('one.viaAreaUnnamed')) : t('one.viaNone')}
              </p>
            </>
          )}
          {direct.data ? (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 -ms-2 text-danger"
              loading={end.isPending}
              disabled={assign.isPending}
              onClick={() => end.mutate(direct.data!.id!, { onSuccess: () => (toast.success(t('one.ended', { name })), onClose()) })}
            >
              <UserMinus className="size-4" aria-hidden />
              {t('one.end')}
            </Button>
          ) : null}
          {direct.data ? <p className="text-xs text-fg-tertiary">{t('one.endHelp')}</p> : null}
        </div>
        <Field label={t('staff')} required error={missing && !userId ? t('errors.required') : sameAsNow ? t('one.same') : undefined}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">{t('pick')}</option>
              {(staff.data ?? []).map((u) => <option key={u.id} value={u.id}>{`${pickText(u.name, locale)} · ${u.employeeCode ?? ''}`}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('bulk.reason')}>
          {(id) => <Textarea id={id} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        {staff.error ? <ErrorBanner error={staff.error} onRetry={() => staff.refetch()} /> : null}
        {assign.error ? <ErrorBanner error={assign.error} /> : null}
        {end.error ? <ErrorBanner error={end.error} /> : null}
      </div>
    </Dialog>
  );
}
