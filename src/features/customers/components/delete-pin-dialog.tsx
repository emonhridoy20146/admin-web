'use client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MapPinOff } from 'lucide-react';
import { pickText } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { formatCoords } from '@/shared/map/geo';
import { ConfirmTypeDialog } from '@/shared/ui/confirm-type-dialog';
import { useDeleteLocation, type CustomerDetail } from '../api/customers';
import { currentPin } from '../model/pin';

/**
 * FR-CUS-014: delete a customer's map pin. The dialog names the customer and where the pin is, and the user must
 * type the confirm word before the button turns on. The server keeps the pin deleted across ERP syncs (ADR-036).
 */
export function DeletePinDialog({ open, customer, onClose }: { open: boolean; customer: CustomerDetail; onClose: () => void }) {
  const { t } = useTranslation('customers');
  const locale = useUi((s) => s.locale);
  const del = useDeleteLocation(customer.id ?? '');
  const name = pickText(customer.name, locale);
  const pin = currentPin(customer);

  return (
    <ConfirmTypeDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('deletePin.title', { name })}
      description={t('deletePin.desc')}
      word={t('deletePin.word')}
      confirmLabel={t('deletePin.confirm')}
      onConfirm={async () => {
        const r = await del.mutateAsync();
        toast.success(t(r.removed ? 'deletePin.deleted' : 'deletePin.already', { name }));
      }}
    >
      <div className="rounded-md border border-line bg-surface-subtle px-3 py-2.5 text-sm">
        <div className="flex items-center gap-2 font-medium text-fg">
          <MapPinOff className="size-4 shrink-0 text-danger" aria-hidden />
          <span lang={locale}>{name}</span>
        </div>
        {pin ? <div className="tabular mt-1 font-mono text-fg-secondary">{t('deletePin.where', { coords: formatCoords(pin) })}</div> : null}
        <p className="mt-2 text-fg-secondary">{t('deletePin.keep')}</p>
      </div>
    </ConfirmTypeDialog>
  );
}
