'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatMoney } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { Field, Input, Textarea } from '@/shared/ui/form';
import { CustomerPicker } from '@/shared/ui/customer-picker';
import { useCreatePromise } from '../api/promises';

export function CreatePromiseDialog({ open, onOpenChange, initialCustomer }: { open: boolean; onOpenChange: (o: boolean) => void; initialCustomer?: { id: string; name: string } }) {
  const { t } = useTranslation('promises');
  const create = useCreatePromise();
  const today = todayDhaka();

  const [customerId, setCustomerId] = useState(initialCustomer?.id ?? '');
  const [customerName, setCustomerName] = useState(initialCustomer?.name ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [plan, setPlan] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setCustomerId(initialCustomer?.id ?? '');
    setCustomerName(initialCustomer?.name ?? '');
    setAmount('');
    setDate(today);
    setPlan('');
    setNote('');
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = t('validation.customer');
    if (!amount || Number(amount) <= 0) e.amount = t('validation.amount');
    if (!date) e.date = t('validation.date');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    await create.mutateAsync({
      customerId,
      promisedDate: date,
      promisedAmountPoisha: Math.round(Number(amount) * 100),
      erpPlanId: plan || undefined,
      note: note || undefined,
    });
    toast.success(t('created'));
    reset();
    onOpenChange(false);
  };

  const confirmLabel = useMemo(() => {
    if (!amount || Number(amount) <= 0) return t('create');
    return `${t('create')} · ${formatMoney(Math.round(Number(amount) * 100))}`;
  }, [amount, t]);

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
            {t('cancel', { ns: 'translation' }) ?? 'Cancel'}
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            {confirmLabel}
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

        <Field label={t('field.amount')} error={errors.amount} required>
          {(id, desc) => (
            <Input
              id={id}
              aria-describedby={desc}
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!errors.amount}
            />
          )}
        </Field>

        <Field label={t('field.date')} error={errors.date} required>
          {(id, desc) => (
            <Input
              id={id}
              aria-describedby={desc}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.date}
            />
          )}
        </Field>

        <Field label={t('field.plan')}>
          {(id) => <Input id={id} value={plan} onChange={(e) => setPlan(e.target.value)} />}
        </Field>

        <Field label={t('field.note')}>
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />}
        </Field>
      </div>
    </Dialog>
  );
}
