'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatMoney } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { Field, Input, Select, Textarea } from '@/shared/ui/form';
import { CustomerPicker } from '@/shared/ui/customer-picker';
import { useCreateCollection } from '../api/collections';
import type { components } from '@/shared/api/schema';

const METHODS: components['schemas']['PaymentMethod'][] = ['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'other_mobile'];

export function CollectDialog({ open, onOpenChange, initialCustomer }: { open: boolean; onOpenChange: (o: boolean) => void; initialCustomer?: { id: string; name: string } }) {
  const { t } = useTranslation('collections');
  const { t: tc } = useTranslation();
  const create = useCreateCollection();

  const [customerId, setCustomerId] = useState(initialCustomer?.id ?? '');
  const [customerName, setCustomerName] = useState(initialCustomer?.name ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<components['schemas']['PaymentMethod']>('cash');
  const [receipt, setReceipt] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [plan, setPlan] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const reset = () => {
    setCustomerId(initialCustomer?.id ?? '');
    setCustomerName(initialCustomer?.name ?? '');
    setAmount('');
    setMethod('cash');
    setReceipt('');
    setTxnRef('');
    setPlan('');
    setNote('');
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = t('collectValidation.customer');
    if (!amount || Number(amount) <= 0) e.amount = t('collectValidation.amount');
    if (!method) e.method = t('collectValidation.method');
    if (!receipt.trim()) e.receipt = t('collectValidation.receipt');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    await create.mutateAsync({
      key: idempotencyKey,
      body: {
        customerId,
        amountPoisha: Math.round(Number(amount) * 100),
        method,
        receiptNo: receipt.trim(),
        transactionRef: txnRef.trim() || undefined,
        erpPlanId: plan.trim() || undefined,
        note: note.trim() || undefined,
      },
    });
    toast.success(t('collected'));
    reset();
    onOpenChange(false);
  };

  const confirmLabel = useMemo(() => {
    if (!amount || Number(amount) <= 0) return t('collect');
    return `${t('collect')} · ${formatMoney(Math.round(Number(amount) * 100))}`;
  }, [amount, t]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={t('collectTitle')}
      description={t('collectDesc')}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { reset(); onOpenChange(false); }}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 pb-2">
        <Field label={t('collectField.customer')} help={t('collectField.customerHelp')} error={errors.customer} required>
          {(id) => (
            <CustomerPicker
              id={id}
              value={customerId}
              displayName={customerName}
              onChange={(cId, name) => { setCustomerId(cId); setCustomerName(name); }}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('collectField.amount')} error={errors.amount} required>
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

          <Field label={t('collectField.method')} error={errors.method} required>
            {(id, desc) => (
              <Select
                id={id}
                aria-describedby={desc}
                value={method}
                onChange={(e) => setMethod(e.target.value as components['schemas']['PaymentMethod'])}
                aria-invalid={!!errors.method}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{tc(`method.${m}`)}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label={t('collectField.receipt')} error={errors.receipt} required>
          {(id, desc) => (
            <Input
              id={id}
              aria-describedby={desc}
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              aria-invalid={!!errors.receipt}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('collectField.txnRef')}>
            {(id) => <Input id={id} value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />}
          </Field>

          <Field label={t('collectField.plan')}>
            {(id) => <Input id={id} value={plan} onChange={(e) => setPlan(e.target.value)} />}
          </Field>
        </div>

        <Field label={t('collectField.note')}>
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />}
        </Field>
      </div>
    </Dialog>
  );
}
