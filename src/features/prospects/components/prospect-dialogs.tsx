'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { Field, Input, Textarea } from '@/shared/ui/form';
import { CustomerPicker } from '@/shared/ui/customer-picker';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Segmented } from '@/shared/ui/primitives';
import { useConvertProspect, useCreateProspect, type Prospect } from '../api/prospects';

/**
 * Convert: link the prospect to the customer they became, found by search (FOS customer) or by ERP customer code when
 * the customer is not synced yet. Not optimistic: the drawer changes when the server answers.
 */
export function ConvertDialog({ prospect, onClose }: { prospect: Prospect | null; onClose: () => void }) {
  const { t } = useTranslation('prospects');
  const convert = useConvertProspect();
  const [by, setBy] = useState<'search' | 'code'>('search');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const close = () => {
    setCustomerId('');
    setCustomerName('');
    setCode('');
    setNote('');
    convert.reset();
    onClose();
  };
  const ready = by === 'search' ? !!customerId : code.trim().length >= 2;
  return (
    <Dialog
      open={!!prospect}
      onOpenChange={(o) => !o && !convert.isPending && close()}
      title={t('convert.title')}
      description={prospect ? t('convert.desc', { name: prospect.name }) : undefined}
      footer={
        <>
          <Button onClick={close} disabled={convert.isPending}>{t('back')}</Button>
          <Button
            variant="primary"
            disabled={!ready}
            loading={convert.isPending}
            onClick={() =>
              convert.mutate(
                { id: prospect!.id, ...(by === 'search' ? { customerId } : { erpCustomerCode: code.trim() }), note: note.trim() || undefined },
                { onSuccess: () => (toast.success(t('convert.done')), close()) },
              )
            }
          >
            {by === 'search' && customerName ? t('convert.confirmTo', { name: customerName }) : t('convert.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 px-5 pb-2">
        {convert.error ? <ErrorBanner error={convert.error} /> : null}
        <Segmented
          label={t('convert.by')}
          value={by}
          onChange={setBy}
          options={[
            { value: 'search', label: t('convert.bySearch') },
            { value: 'code', label: t('convert.byCode') },
          ]}
        />
        {by === 'search' ? (
          <Field label={t('convert.customer')} help={t('convert.customerHelp')} required>
            {(id) => <CustomerPicker id={id} value={customerId} displayName={customerName} onChange={(cId, name) => (setCustomerId(cId), setCustomerName(name))} />}
          </Field>
        ) : (
          <Field label={t('convert.code')} help={t('convert.codeHelp')} required>
            {(id, d) => <Input id={id} aria-describedby={d} value={code} onChange={(e) => setCode(e.target.value)} maxLength={64} className="font-mono" />}
          </Field>
        )}
        <Field label={t('convert.note')}>
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />}
        </Field>
      </div>
    </Dialog>
  );
}

/** A new possible customer recorded from the office (prospect.create). */
export function CreateProspectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation('prospects');
  const create = useCreateProspect();
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const phoneOk = !phone.trim() || /^(\+?880|0)1\d{9}$/.test(phone.replace(/[\s-]/g, ''));
  const close = () => {
    setName('');
    setPhone('');
    setAddress('');
    setNote('');
    setTried(false);
    setClientId(crypto.randomUUID());
    create.reset();
    onOpenChange(false);
  };
  const submit = () => {
    setTried(true);
    if (!name.trim() || !phoneOk) return;
    create.mutate(
      { clientId, name: name.trim(), phones: phone.trim() ? [{ number: phone.replace(/[\s-]/g, '') }] : [], address: address.trim() || undefined, note: note.trim() || undefined },
      { onSuccess: (p) => (toast.success(t('create.done')), onCreated(p.id), close()) },
    );
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : !create.isPending && close())}
      title={t('create.title')}
      description={t('create.desc')}
      footer={
        <>
          <Button onClick={close} disabled={create.isPending}>{t('back')}</Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>{t('create.confirm')}</Button>
        </>
      }
    >
      <div className="space-y-4 px-5 pb-2">
        {create.error ? <ErrorBanner error={create.error} /> : null}
        <Field label={t('col.name')} required error={tried && !name.trim() ? t('create.nameRequired') : undefined}>
          {(id, d) => <Input id={id} aria-describedby={d} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={tried && !name.trim()} />}
        </Field>
        <Field label={t('col.phones')} help={t('create.phoneHelp')} error={tried && !phoneOk ? t('create.phoneBad') : undefined}>
          {(id, d) => <Input id={id} aria-describedby={d} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="tabular" aria-invalid={tried && !phoneOk} />}
        </Field>
        <Field label={t('col.address')}>
          {(id) => <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} />}
        </Field>
        <Field label={t('col.note')}>
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />}
        </Field>
      </div>
    </Dialog>
  );
}
