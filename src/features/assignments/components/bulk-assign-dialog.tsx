'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUi } from '@/shared/lib/ui-store';
import { formatNumber, pickText } from '@/shared/lib/format';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Button } from '@/shared/ui/button';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Select, Textarea } from '@/shared/ui/form';
import { BULK_MAX, useBulkAssign, useStaff } from '../api/assignments';

/** Extension point for lists of customers: assign the selected customers to one staff member. */
export function BulkAssignDialog({ open, customerIds, onClose, onDone }: { open: boolean; customerIds: string[]; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation('assignments');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const staff = useStaff();
  const assign = useBulkAssign();
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (open) {
      setUserId('');
      setReason('');
      setMissing(false);
      assign.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const tooMany = customerIds.length > BULK_MAX;
  const name = pickText(staff.data?.find((u) => u.id === userId)?.name, locale);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !assign.isPending && onClose()}
      title={t('bulk.title', { n: formatNumber(customerIds.length) })}
      description={t('bulk.desc')}
      footer={
        <>
          <Button onClick={onClose} disabled={assign.isPending}>{tc('actions.cancel')}</Button>
          <Button
            variant="primary"
            loading={assign.isPending}
            disabled={tooMany}
            onClick={() => {
              if (!userId) return setMissing(true);
              assign.mutate(
                { userId, customerIds, reason: reason.trim() || undefined },
                {
                  onSuccess: (r) => {
                    toast.success(t('bulk.done', { n: formatNumber(r.assigned ?? 0), name }), (r.skipped ?? 0) > 0 ? { description: t('bulk.skipped', { n: formatNumber(r.skipped ?? 0) }) } : undefined);
                    onDone?.();
                    onClose();
                  },
                },
              );
            }}
          >
            {t('bulk.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
        <Field label={t('staff')} required error={missing && !userId ? t('errors.required') : undefined}>
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
        {tooMany ? <p role="alert" className="text-sm text-danger">{t('bulk.tooMany', { n: formatNumber(BULK_MAX) })}</p> : null}
        {assign.error ? <ErrorBanner error={assign.error} /> : null}
      </div>
    </Dialog>
  );
}
