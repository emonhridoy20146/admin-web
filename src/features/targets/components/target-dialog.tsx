'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { Field, Input, Textarea } from '@/shared/ui/form';
import { ErrorBanner } from '@/shared/ui/feedback';
import { draftFrom, MIN_REASON, parseDraft, type DraftErrors, type TargetDraft } from '../model/targets';
import type { TargetSet } from '../api/targets';

/**
 * Set a daily target (amount + visits) from a start date, with a reason. Used for the branch default and for one
 * person. The confirm button names the amount and the visits (CLAUDE.md §3: money confirms name the amount).
 */
export function TargetDialog({ open, onOpenChange, title, description, current, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  current?: { amountPoisha?: number; visits?: number };
  onSave: (body: TargetSet) => Promise<unknown>;
}) {
  const { t } = useTranslation('targets');
  const { t: tc } = useTranslation();
  const today = todayDhaka();
  const [d, setD] = useState<TargetDraft>(() => draftFrom(current, today));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setD(draftFrom(current, todayDhaka()));
      setErrors({});
      setError(null);
    }
    // reset only when the dialog opens, not on every refetch of `current`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsed = parseDraft(d, today);
  const set = (k: keyof TargetDraft, v: string) => setD((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    setErrors(parsed.errors);
    if (!parsed.body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(parsed.body);
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const err = (k: keyof TargetDraft) => (errors[k] ? t(errors[k]!, { n: formatNumber(MIN_REASON) }) : undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>{tc('actions.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {parsed.body ? t('dialog.confirm', { amount: formatMoney(parsed.body.amountPoisha), visits: formatNumber(parsed.body.visits) }) : t('dialog.save')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('dialog.amount')} required error={err('taka')} help={t('dialog.amountHelp')}>
            {(id, h) => <Input id={id} aria-describedby={h} aria-invalid={!!errors.taka} inputMode="numeric" value={d.taka} onChange={(e) => set('taka', e.target.value)} autoFocus />}
          </Field>
          <Field label={t('dialog.visits')} required error={err('visits')} help={t('dialog.visitsHelp')}>
            {(id, h) => <Input id={id} aria-describedby={h} aria-invalid={!!errors.visits} inputMode="numeric" value={d.visits} onChange={(e) => set('visits', e.target.value)} />}
          </Field>
        </div>
        <Field label={t('dialog.from')} required error={err('effectiveFrom')} help={t('dialog.fromHelp')}>
          {(id, h) => <Input id={id} aria-describedby={h} aria-invalid={!!errors.effectiveFrom} type="date" min={today} value={d.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} className="sm:w-48" />}
        </Field>
        <Field label={tc('reason.text')} required error={err('reason')} counter={`${formatNumber(d.reason.trim().length)} / ${formatNumber(MIN_REASON)}+`}>
          {(id, h) => <Textarea id={id} aria-describedby={h} aria-invalid={!!errors.reason} value={d.reason} onChange={(e) => set('reason', e.target.value)} placeholder={tc('reason.placeholder')} />}
        </Field>
        {error ? <ErrorBanner error={error} /> : null}
      </form>
    </Dialog>
  );
}
