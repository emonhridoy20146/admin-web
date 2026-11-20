'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { Field, Select, Textarea } from '@/shared/ui/form';
import { CustomerPicker } from '@/shared/ui/customer-picker';
import { useCreateVisit, type VisitOutcome } from '../api/visits';
import { OUTCOMES } from '../model/visit';

export function CreateVisitDialog({ open, onOpenChange, initialCustomer }: { open: boolean; onOpenChange: (o: boolean) => void; initialCustomer?: { id: string; name: string } }) {
  const { t } = useTranslation('visits');

  const create = useCreateVisit();
  const [customerId, setCustomerId] = useState(initialCustomer?.id ?? '');
  const [customerName, setCustomerName] = useState(initialCustomer?.name ?? '');
  const [outcome, setOutcome] = useState<VisitOutcome | ''>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setCustomerId(initialCustomer?.id ?? '');
    setCustomerName(initialCustomer?.name ?? '');
    setOutcome('');
    setNote('');
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = t('validation.customer');
    if (!outcome) e.outcome = t('validation.outcome');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    await create.mutateAsync({
      customerId,
      outcome: outcome as VisitOutcome,
      note: note.trim() || undefined,
    });
    toast.success(t('created'));
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={t('createTitle')}
      description={t('createDesc')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { reset(); onOpenChange(false); }}>
            {t('actions.cancel', { ns: 'translation' })}
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            {t('create')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 pb-2">
        <Field label={t('field.customer')} help={t('field.customerHelp')} error={errors.customer} required>
          {(id) => (
            <CustomerPicker
              id={id}
              value={customerId}
              displayName={customerName}
              onChange={(cId, name) => { setCustomerId(cId); setCustomerName(name); }}
            />
          )}
        </Field>

        <Field label={t('field.outcome')} error={errors.outcome} required>
          {(id, desc) => (
            <Select
              id={id}
              aria-describedby={desc}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as VisitOutcome)}
              aria-invalid={!!errors.outcome}
            >
              <option value="">{t('allOutcomes')}</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>{t(`outcome.${o}`)}</option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('field.note')}>
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />}
        </Field>
      </div>
    </Dialog>
  );
}
