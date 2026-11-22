'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Crosshair } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { cn } from '@/shared/lib/cn';
import { formatNumber } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { DEFAULT_POINT, formatCoords, haversineM, inBangladesh, type LatLng } from '@/shared/map/geo';
import { MapPicker } from '@/shared/map/map-picker';
import type { MapViewState } from '@/shared/map/map-view';
import { useMapLayers } from '@/shared/feature/map-layers';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';
import { Field, Input, Textarea } from '@/shared/ui/form';
import { Dialog } from '@/shared/ui/overlay';
import { useCreatePlace, useEditPlace, type Place } from '../api/places';
import { formOf, NAME_MAX, NOTE_MAX, PLACE_ICONS, toCreate, toEdit, validatePlace, type PlaceForm } from '../model/places';
import { PlaceGlyph } from './place-icon';

/**
 * FR-PLC-002/003: put a place on the map, or change one. The point is picked by moving the map under a fixed pin.
 * `mode="move"` shows only the map (the office moves the marker directly). Staff edits never send a point.
 */
export function PlaceDialog({ open, onOpenChange, place, mode = place ? 'edit' : 'create', canMove, onDone }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  place?: Place | null;
  mode?: 'create' | 'edit' | 'move';
  canMove: boolean;
  onDone?: (p: Place) => void;
}) {
  const { t } = useTranslation('places');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const branchId = useUi((s) => s.branchId);
  useUi((s) => s.bnDigits);
  const branches = useBranches();
  const create = useCreatePlace();
  const edit = useEditPlace();
  const busy = create.isPending || edit.isPending;
  const start = useMemo<LatLng>(() => {
    if (place) return place.location;
    const b = branches.data?.find((x) => x.id === branchId) ?? branches.data?.[0];
    return b?.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : DEFAULT_POINT;
  }, [place, branches.data, branchId]);
  const [form, setForm] = useState<PlaceForm>({ name: '', icon: 'shop', note: '', point: start });
  const [clientId, setClientId] = useState('');
  const [touched, setTouched] = useState(false);
  // FR-PLC-001: the places already there, so nobody adds the same one twice (shown only, under the pin)
  const [view, setView] = useState<MapViewState | null>(null);
  const layers = useMapLayers({ view, passive: true });

  useEffect(() => {
    if (!open) return;
    setForm(place ? formOf(place) : { name: '', icon: 'shop', note: '', point: start });
    setClientId(crypto.randomUUID());
    setTouched(false);
    create.reset();
    edit.reset();
    // a dialog starts from the place (or the branch point) each time it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = validatePlace(form, inBangladesh);
  const showMap = mode !== 'edit' || canMove;
  const showWords = mode !== 'move';
  const moved = place ? haversineM(place.location, form.point) : null;
  const set = <K extends keyof PlaceForm>(k: K, v: PlaceForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    try {
      let saved: Place;
      if (!place) saved = await create.mutateAsync(toCreate(form, clientId));
      else {
        const body = toEdit(place, form, canMove);
        if (!Object.keys(body).length) return onOpenChange(false);
        saved = await edit.mutateAsync({ id: place.id, body, version: place.version });
      }
      toast.success(t(place ? (mode === 'move' ? 'toast.moved' : 'toast.saved') : 'toast.created', { name: saved.name }));
      onDone?.(saved);
      onOpenChange(false);
    } catch {
      // shown below by ErrorBanner
    }
  };

  const title = mode === 'move' ? t('dialog.moveTitle', { name: place?.name }) : place ? t('dialog.editTitle', { name: place.name }) : t('dialog.createTitle');
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      wide={showMap}
      title={<span lang={locale}>{title}</span>}
      description={mode === 'move' ? t('dialog.moveDesc') : t('dialog.desc')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={busy}>{tc('actions.cancel')}</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {mode === 'move' ? t('dialog.moveSave') : place ? t('dialog.save') : t('dialog.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
        {showWords && (
          <>
            <Field label={t('form.name')} required counter={`${formatNumber(form.name.trim().length)}/${formatNumber(NAME_MAX)}`} error={touched && errors.name ? t(`form.error.${errors.name}`) : undefined}>
              {(id, d) => <Input id={id} aria-describedby={d} value={form.name} maxLength={NAME_MAX + 10} onChange={(e) => set('name', e.target.value)} placeholder={t('form.namePlaceholder')} autoComplete="off" />}
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-base font-medium text-fg">{t('form.icon')}</legend>
              <div role="radiogroup" aria-label={t('form.icon')} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {PLACE_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    role="radio"
                    aria-checked={form.icon === ic}
                    onClick={() => set('icon', ic)}
                    className={cn('flex min-h-11 items-center gap-2 rounded-sm border px-2.5 py-2 text-start text-sm', form.icon === ic ? 'border-primary bg-primary-subtle text-fg' : 'border-line bg-surface text-fg-secondary hover:bg-surface-hover')}
                  >
                    <PlaceGlyph icon={ic} className="size-5" />
                    {t(`icon.${ic}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label={t('form.note')} counter={`${formatNumber(form.note.trim().length)}/${formatNumber(NOTE_MAX)}`} error={touched && errors.note ? t(`form.error.${errors.note}`) : undefined}>
              {(id, d) => <Textarea id={id} aria-describedby={d} rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t('form.notePlaceholder')} />}
            </Field>
          </>
        )}
        {showMap && (
          <>
            <MapPicker
              value={form.point}
              onChange={(p) => set('point', p)}
              zoom={17}
              reference={place?.location ?? null}
              referenceLabel={t('dialog.currentPoint')}
              markers={layers.markers}
              onView={setView}
              label={t('dialog.mapLabel')}
              className={mode === 'move' ? 'h-[50dvh] min-h-56 sm:h-[400px]' : 'h-[34dvh] min-h-48 sm:h-[280px]'}
            />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm" aria-live="polite">
              <span className="inline-flex items-center gap-1.5 text-fg">
                <Crosshair className="size-4 text-primary" aria-hidden />
                <span className="sr-only">{t('dialog.pointAt')}</span>
                <span className="tabular font-mono">{formatCoords(form.point)}</span>
              </span>
              {moved != null && <span className="text-fg-secondary">{t('dialog.moved', { n: formatNumber(Math.round(moved)) })}</span>}
            </div>
            {errors.point ? <p role="alert" className="text-sm text-danger">{t('form.error.outside')}</p> : null}
          </>
        )}
        {create.error || edit.error ? <ErrorBanner error={create.error ?? edit.error} /> : null}
      </div>
      {showMap && open ? layers.element : null}
    </Dialog>
  );
}
