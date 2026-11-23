'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format';
import { ErrorBanner } from '@/shared/ui/feedback';
import { todayDhaka } from '@/shared/lib/time';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { Field, Input, Textarea } from '@/shared/ui/form';
import { CustomerPicker } from '@/shared/ui/customer-picker';
import { useCreatePromise } from '../api/promises';

/** The broken (or partially kept) promise a new promise follows up (FR-PRM-006, 1.45.0). */
export interface FollowUpOf {
  id: string;
  customerId: string;
  customerName: string;
  promisedDate: string;
  promisedAmountPoisha: number;
  paidTowardsPoisha?: number;
  attempt?: number;
  erpPlanId?: string;
}

/**
 * New promise from the office. With `followUp` it is the next promise of a broken one: same customer (fixed), the
 * plan carried over, sent with `followUpOf`; the server numbers it attempt n + 1. Money action: not optimistic, the
 * button names the amount.
 */
export function CreatePromiseDialog({ open, onOpenChange, initialCustomer, followUp, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; initialCustomer?: { id: string; name: string }; followUp?: FollowUpOf | null; onCreated?: (id: string) => void }) {
  const { t } = useTranslation('promises');
  const create = useCreatePromise();
  const today = todayDhaka();

  const first = followUp ? { id: followUp.customerId, name: followUp.customerName } : initialCustomer;
  const [customerId, setCustomerId] = useState(first?.id ?? '');
  const [customerName, setCustomerName] = useState(first?.name ?? '');
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [plan, setPlan] = useState(followUp?.erpPlanId ?? '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // a dialog opened for another broken promise starts from that promise
  const [forId, setForId] = useState(followUp?.id);
  if (followUp?.id !== forId) {
    setForId(followUp?.id);
    setCustomerId(first?.id ?? '');
    setCustomerName(first?.name ?? '');
    setPlan(followUp?.erpPlanId ?? '');
  }

  const reset = () => {
    setCustomerId(first?.id ?? '');
    setCustomerName(first?.name ?? '');
    setAmount('');
    setDate(today);
    setPlan(followUp?.erpPlanId ?? '');
    setClientId(crypto.randomUUID());
    create.reset();
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
    const made = await create.mutateAsync({
      clientId,
      followUpOf: followUp?.id,
      customerId,
      promisedDate: date,
      promisedAmountPoisha: Math.round(Number(amount) * 100),
      erpPlanId: plan || undefined,
      note: note || undefined,
    });
    toast.success(followUp ? t('followUp.created') : t('created'));
    if (made?.id) onCreated?.(made.id);
    reset();
    onOpenChange(false);
  };

  const confirmLabel = useMemo(() => {
    const verb = followUp ? t('followUp.confirm') : t('create');
    if (!amount || Number(amount) <= 0) return verb;
    return `${verb} · ${formatMoney(Math.round(Number(amount) * 100))}`;
  }, [amount, t, followUp]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={followUp ? t('followUp.title') : t('createTitle')}
      description={
        followUp
          ? t('followUp.desc', { name: followUp.customerName, date: formatDate(followUp.promisedDate), amount: formatMoney(followUp.promisedAmountPoisha), n: formatNumber((followUp.attempt ?? 1) + 1) })
          : t('createDesc')
      }
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
        {create.error ? <ErrorBanner error={create.error} /> : null}
        {followUp ? (
          <div className="rounded-md border border-line bg-surface-subtle px-3 py-2.5 text-sm">
            <div className="text-xs text-fg-tertiary">{t('field.customer')}</div>
            <div className="font-medium text-fg">{followUp.customerName}</div>
            <div className="mt-1 text-xs text-fg-secondary">{t('followUp.was', { date: formatDate(followUp.promisedDate), amount: formatMoney(followUp.promisedAmountPoisha), paid: formatMoney(followUp.paidTowardsPoisha ?? 0) })}</div>
          </div>
        ) : (
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
        )}

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
