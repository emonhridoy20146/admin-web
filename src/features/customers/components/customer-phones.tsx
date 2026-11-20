'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useGate } from '@/shared/feature/useGate';
import { formatDate, formatNumber } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Field, Input } from '@/shared/ui/form';
import { Dialog } from '@/shared/ui/overlay';
import { useAddPhones, useRemovePhone, type CustomerDetail } from '../api/customers';
import { MAX_EXTRA_PHONES, addedCount, checkDrafts, phoneRows, type PhoneDetail, type PhoneDraft } from '../model/phones';

/**
 * FR-CUS-016 (contract 1.23.0): the customer's phone numbers. The ERP's numbers come first and are marked "ERP"
 * (the first one is the office's main number); numbers added in the field system are marked "added", with whose
 * number it is, who added it and when. Users with `customer.phone.manage` add several at once and remove added ones.
 */
export function CustomerPhones({ c }: { c: CustomerDetail }) {
  const { t } = useTranslation('customers');
  useUi((s) => s.bnDigits);
  const gate = useGate();
  const canManage = gate.can('customer.phone.manage');
  const rows = phoneRows(c);
  const room = MAX_EXTRA_PHONES - addedCount(rows);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PhoneDetail | null>(null);

  return (
    <div>
      {rows.length === 0 ? (
        <span className="text-warning">{t('phone.none')}</span>
      ) : (
        <ul className="space-y-1.5" data-testid="customer-phones">
          {rows.map((p) => (
            <li key={p.number} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <a href={`tel:${p.number}`} className="tabular font-mono text-sm text-fg hover:text-primary">{p.number}</a>
              {p.source === 'erp' ? (
                <Badge tone={p.primary ? 'brand' : 'neutral'} icon={false}>{t(p.primary ? 'phone.erpMain' : 'phone.erp')}</Badge>
              ) : (
                <Badge tone="info" icon={false}>{t('phone.added')}</Badge>
              )}
              {p.label && <span className="text-sm text-fg-secondary">{p.label}</span>}
              {p.source === 'field' && canManage && (
                <Button variant="ghost" size="icon-sm" aria-label={t('phone.removeAria', { number: p.number })} onClick={() => setRemoving(p)}>
                  <Trash2 className="size-4 text-danger" aria-hidden />
                </Button>
              )}
              {p.source === 'field' && (p.addedBy?.name || p.addedAt) && (
                <span className="basis-full text-xs text-fg-tertiary">
                  {t('phone.addedBy', { name: p.addedBy?.name || '—', date: p.addedAt ? formatDate(p.addedAt) : '—' })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage &&
        (room > 0 ? (
          <button type="button" onClick={() => setAdding(true)} className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline sm:min-h-8">
            <Plus className="size-4" aria-hidden />
            {t('phone.add')}
          </button>
        ) : (
          <p className="mt-1.5 text-xs text-fg-tertiary">{t('phone.full', { n: formatNumber(MAX_EXTRA_PHONES) })}</p>
        ))}
      {canManage && <AddPhonesDialog open={adding} customer={c} room={room} onClose={() => setAdding(false)} />}
      {canManage && removing && <RemovePhoneDialog customer={c} phone={removing} onClose={() => setRemoving(null)} />}
    </div>
  );
}

const EMPTY: PhoneDraft = { number: '', label: '' };

function AddPhonesDialog({ open, customer, room, onClose }: { open: boolean; customer: CustomerDetail; room: number; onClose: () => void }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  useUi((s) => s.bnDigits);
  const save = useAddPhones(customer.id ?? '');
  const [drafts, setDrafts] = useState<PhoneDraft[]>([EMPTY]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDrafts([EMPTY]);
    setTouched(false);
    save.reset();
    // a fresh form each time the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { errors, phones } = checkDrafts(drafts, phoneRows(customer));
  const hasError = errors.some(Boolean);
  const set = (i: number, patch: Partial<PhoneDraft>) => setDrafts((d) => d.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    setTouched(true);
    if (hasError || !phones.length) return;
    try {
      const r = await save.mutateAsync(phones);
      const added = r.added?.length ?? 0;
      const skipped = r.skipped?.length ?? 0;
      if (added) toast.success(t('phone.savedN', { n: formatNumber(added) }) + (skipped ? ` ${t('phone.skippedN', { n: formatNumber(skipped) })}` : ''));
      else toast.info(t('phone.nothingNew'));
      onClose();
    } catch {
      // shown in the banner below; the form keeps what was typed
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('phone.addTitle')}
      description={t('phone.addDesc')}
      footer={
        <>
          <Button onClick={onClose}>{tc('actions.cancel')}</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => void submit()}>{t('phone.save')}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        {drafts.map((d, i) => {
          const err = touched || d.number.trim().length >= 11 ? errors[i] : null;
          return (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
              <Field label={t('phone.numberN', { n: formatNumber(i + 1) })} error={err ? t(`phone.err.${err}`) : undefined} required={i === 0}>
                {(id, describedBy) => (
                  <Input id={id} aria-describedby={describedBy} aria-invalid={!!err} type="tel" inputMode="tel" autoComplete="off" maxLength={30} placeholder="01XXXXXXXXX" className="tabular font-mono" value={d.number} onChange={(e) => set(i, { number: e.target.value })} />
                )}
              </Field>
              <Field label={t('phone.whose')} help={i === 0 ? t('phone.whoseHelp') : undefined}>
                {(id, describedBy) => <Input id={id} aria-describedby={describedBy} maxLength={30} value={d.label} onChange={(e) => set(i, { label: e.target.value })} />}
              </Field>
              {drafts.length > 1 && (
                <Button variant="ghost" size="icon" className="sm:mt-7" aria-label={t('phone.dropRow', { n: formatNumber(i + 1) })} onClick={() => setDrafts((x) => x.filter((_, k) => k !== i))}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          );
        })}
        {drafts.length < room ? (
          <Button variant="subtle" size="sm" onClick={() => setDrafts((d) => [...d, EMPTY])}>
            <Plus className="size-4" aria-hidden />
            {t('phone.another')}
          </Button>
        ) : (
          <p className="text-xs text-fg-tertiary">{t('phone.roomLeft', { n: formatNumber(room) })}</p>
        )}
        {touched && !phones.length && !hasError && <p className="text-xs text-danger">{t('phone.err.empty')}</p>}
        <p className="rounded-md border border-line bg-surface-subtle px-3 py-2 text-sm text-fg-secondary">{t('phone.keptHere')}</p>
        {save.isError && <ErrorBanner error={save.error} />}
      </div>
    </Dialog>
  );
}

function RemovePhoneDialog({ customer, phone, onClose }: { customer: CustomerDetail; phone: PhoneDetail; onClose: () => void }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const del = useRemovePhone(customer.id ?? '');
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('phone.removeTitle')}
      description={t('phone.removeDesc')}
      footer={
        <>
          <Button onClick={onClose}>{tc('actions.cancel')}</Button>
          <Button
            variant="destructive"
            loading={del.isPending}
            onClick={async () => {
              try {
                await del.mutateAsync(phone.number);
                toast.success(t('phone.removed', { number: phone.number }));
                onClose();
              } catch {
                // shown in the banner
              }
            }}
          >
            {t('phone.removeConfirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 pb-2">
        <div className="rounded-md border border-line bg-surface-subtle px-3 py-2.5">
          <span className="tabular font-mono text-fg">{phone.number}</span>
          {phone.label && <span className="ms-2 text-sm text-fg-secondary">{phone.label}</span>}
        </div>
        {del.isError && <ErrorBanner error={del.error} />}
      </div>
    </Dialog>
  );
}
