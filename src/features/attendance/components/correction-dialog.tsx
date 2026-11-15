'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatDate, formatNumber } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/overlay';
import { Field, Input, Select, Textarea } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useCorrect } from '../api/attendance';
import { CORRECTION_TYPES, dhakaIso, REASON_MIN, validateCorrection, type CorrectionForm } from '../model/attendance';

const EMPTY: CorrectionForm = { type: 'work_in', time: '', reason: '' };

/** FR-ATT-006 manual correction: one event (in, break start/end, out) at a time, always with a reason. */
export function CorrectionDialog({ target, onClose }: { target: { userId: string; name: string; date: string } | null; onClose: () => void }) {
  const { t } = useTranslation('attendance');
  const { t: tc } = useTranslation();
  const correct = useCorrect();
  const [v, setV] = useState<CorrectionForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof CorrectionForm, string>>>({});
  const [error, setError] = useState<unknown>(null);
  const open = !!target;

  useEffect(() => {
    if (open) {
      setV(EMPTY);
      setErrors({});
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!target) return;
    const e = validateCorrection(v, target.date);
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    try {
      await correct.mutateAsync({ userId: target.userId, businessDate: target.date, type: v.type, at: dhakaIso(target.date, v.time), reason: v.reason.trim() });
      toast.success(t('correction.saved'));
      onClose();
    } catch (x) {
      setError(x);
    }
  };
  const err = (k: keyof CorrectionForm) => (errors[k] ? t(errors[k]!, { min: formatNumber(REASON_MIN) }) : undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !correct.isPending && onClose()}
      title={t('correction.title')}
      description={target ? t('correction.desc', { name: target.name, date: formatDate(target.date) }) : undefined}
      footer={
        <>
          <Button onClick={onClose} disabled={correct.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={correct.isPending}>{t('correction.save')}</Button>
        </>
      }
    >
      <form className="grid gap-4 py-1 sm:grid-cols-2" noValidate onSubmit={(e) => (e.preventDefault(), void submit())}>
        <Field label={t('correction.type')} required>
          {(id) => (
            <Select id={id} value={v.type} onChange={(e) => setV((s) => ({ ...s, type: e.target.value as CorrectionForm['type'] }))}>
              {CORRECTION_TYPES.map((x) => <option key={x} value={x}>{t(`event.${x}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('correction.time')} required error={err('time')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.time} type="time" value={v.time} onChange={(e) => setV((s) => ({ ...s, time: e.target.value }))} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('correction.reason')} required error={err('reason')} help={t('correction.reasonHelp')}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.reason} rows={3} maxLength={500} value={v.reason} onChange={(e) => setV((s) => ({ ...s, reason: e.target.value }))} />}
          </Field>
        </div>
        {error ? <div className="sm:col-span-2"><ErrorBanner error={error} /></div> : null}
      </form>
    </Dialog>
  );
}
