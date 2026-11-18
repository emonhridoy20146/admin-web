'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Crosshair, LocateFixed } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { formatNumber, pickText } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { DEFAULT_POINT, formatCoords, haversineM, inBangladesh, parseCoords, type LatLng } from '@/shared/map/geo';
import { MapPicker } from '@/shared/map/map-picker';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Field, Input, Textarea } from '@/shared/ui/form';
import { Dialog } from '@/shared/ui/overlay';
import { useSetLocation, type CustomerDetail } from '../api/customers';
import { currentPin } from '../model/pin';

/** No branch point yet (the ERP has none): start in Patuakhali town (ADR-W18). */
const FALLBACK: LatLng = DEFAULT_POINT;

/**
 * FR-CUS-011: set a customer's pin by moving the map under a fixed pin (ride-app style), or by pasting coordinates.
 * The pin applies at once for the customer (manager action, audited on the server).
 */
export function SetPinDialog({ open, customer, onClose }: { open: boolean; customer: CustomerDetail; onClose: () => void }) {
  const { t } = useTranslation('customers');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branches = useBranches();
  const current = currentPin(customer);
  const branch = branches.data?.find((b) => b.id === customer.branchId);
  const start = useMemo<LatLng>(() => current ?? (branch?.lat != null && branch.lng != null ? { lat: branch.lat, lng: branch.lng } : FALLBACK), [current, branch?.lat, branch?.lng]);
  const save = useSetLocation(customer.id ?? '');
  const [point, setPoint] = useState<LatLng>(start);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState(false);
  const [note, setNote] = useState('');
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    if (!open) return;
    setPoint(start);
    setTyped('');
    setTypedError(false);
    setNote('');
    setClientId(crypto.randomUUID());
    save.reset();
    // a new dialog starts from the customer's pin (or the branch) each time it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const outside = !inBangladesh(point);
  const movedM = current ? haversineM(current, point) : null;
  const name = pickText(customer.name, locale);

  const goTyped = () => {
    const p = parseCoords(typed);
    setTypedError(!p);
    if (p) setPoint(p);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !save.isPending && onClose()}
      wide
      title={current ? t('setPin.titleMove', { name }) : t('setPin.titleNew', { name })}
      description={t('setPin.desc')}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>{tc('actions.cancel')}</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={outside}
            onClick={() =>
              save.mutate(
                { clientId, lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)), note: note.trim() || undefined },
                { onSuccess: () => (toast.success(t('setPin.saved', { name })), onClose()) },
              )
            }
          >
            {t('setPin.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
        <MapPicker
          value={point}
          onChange={setPoint}
          zoom={current ? 17 : 15}
          reference={current}
          referenceLabel={t('setPin.currentPin')}
          label={t('setPin.mapLabel', { name })}
          className="h-[44dvh] min-h-56 sm:h-[360px]"
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm" aria-live="polite">
          <span className="inline-flex items-center gap-1.5 text-fg">
            <Crosshair className="size-4 text-primary" aria-hidden />
            <span className="sr-only">{t('setPin.pinAt')}</span>
            <span className="tabular font-mono">{formatCoords(point)}</span>
          </span>
          {movedM != null ? (
            <span className={movedM > 500 ? 'text-warning' : 'text-fg-secondary'}>{t('setPin.moved', { n: formatNumber(movedM) })}</span>
          ) : (
            <span className="text-fg-secondary">{t('setPin.noPinYet')}</span>
          )}
        </div>
        {outside ? <p role="alert" className="text-sm text-danger">{t('setPin.outside')}</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goTyped();
          }}
        >
          <Field label={t('setPin.paste')} help={t('setPin.pasteHelp')} error={typedError ? t('setPin.pasteError') : undefined}>
            {(id, d) => (
              <div className="flex gap-2">
                <Input id={id} aria-describedby={d} autoComplete="off" value={typed} onChange={(e) => (setTyped(e.target.value), setTypedError(false))} placeholder="22.70123, 90.37011" className="min-w-0 flex-1" />
                <Button type="submit" className="shrink-0" disabled={!typed.trim()}>
                  <LocateFixed className="size-4" aria-hidden />
                  {t('setPin.go')}
                </Button>
              </div>
            )}
          </Field>
        </form>
        <Field label={t('setPin.note')}>
          {(id) => <Textarea id={id} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('setPin.notePlaceholder')} />}
        </Field>
        {save.error ? <ErrorBanner error={save.error} /> : null}
      </div>
    </Dialog>
  );
}
