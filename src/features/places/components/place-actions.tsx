'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MoveRight, Trash2 } from 'lucide-react';
import { Field, Textarea } from '@/shared/ui/form';
import { formatNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Dialog } from '@/shared/ui/overlay';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useDecideMove, useDeletePlace, type Place } from '../api/places';
import { REASON_MIN } from '../model/places';

interface P {
  place: Place;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** FR-PLC-005: the marker moves to the point the staff member asked for; they are told. */
export function ApproveMoveDialog({ place, open, onOpenChange }: P) {
  const { t } = useTranslation('places');
  const { t: tc } = useTranslation();
  const decide = useDecideMove();
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);
  const pm = place.pendingMove;
  const submit = async () => {
    setError(null);
    try {
      await decide.mutateAsync({ id: place.id, decision: 'approve' });
      toast.success(t('toast.approved', { name: place.name }));
      onOpenChange(false);
    } catch (x) {
      setError(x);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !decide.isPending && onOpenChange(o)}
      title={t('approve.title')}
      description={t('approve.desc', { name: place.name, who: pm?.requestedBy.name ?? '', n: formatNumber(pm?.distanceM ?? 0) })}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={decide.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="primary" loading={decide.isPending} onClick={() => void submit()}>
            <MoveRight className="size-4" aria-hidden />
            {t('approve.confirm')}
          </Button>
        </>
      }
    >
      {error ? <ErrorBanner error={error} /> : null}
    </Dialog>
  );
}

/** FR-PLC-005: the marker stays; the staff member sees the reason (at least 5 characters). */
export function RejectMoveDialog({ place, open, onOpenChange }: P) {
  const { t } = useTranslation('places');
  const decide = useDecideMove();
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('reject.title')}
      description={t('reject.desc', { name: place.name, who: place.pendingMove?.requestedBy.name ?? '' })}
      minLength={REASON_MIN}
      confirmLabel={t('reject.confirm')}
      onSubmit={async (v) => {
        await decide.mutateAsync({ id: place.id, decision: 'reject', reason: v.reason });
        toast.success(t('toast.rejected', { name: place.name }));
      }}
    />
  );
}

/** FR-PLC-006: soft delete with an optional reason; devices drop the place on their next sync. */
export function DeletePlaceDialog({ place, open, onOpenChange, onDone }: P & { onDone?: () => void }) {
  const { t } = useTranslation('places');
  const { t: tc } = useTranslation();
  const del = useDeletePlace();
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) {
      setReason('');
      del.reset();
    }
    // reset when the dialog opens only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const submit = async () => {
    try {
      await del.mutateAsync({ id: place.id, reason: reason.trim() || undefined });
      toast.success(t('toast.deleted', { name: place.name }));
      onOpenChange(false);
      onDone?.();
    } catch {
      // shown below
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !del.isPending && onOpenChange(o)}
      title={t('delete.title', { name: place.name })}
      description={t('delete.desc')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={del.isPending}>{tc('actions.cancel')}</Button>
          <Button variant="destructive" loading={del.isPending} onClick={() => void submit()}>
            <Trash2 className="size-4" aria-hidden />
            {t('delete.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
        <Field label={t('delete.reason')}>
          {(id) => <Textarea id={id} rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('delete.reasonPlaceholder')} />}
        </Field>
        {del.error ? <ErrorBanner error={del.error} /> : null}
      </div>
    </Dialog>
  );
}
