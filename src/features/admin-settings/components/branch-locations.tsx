'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Crosshair, LocateFixed, MapPinOff, MapPinPlus, MapPinned, Warehouse } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { formatNumber, pickText } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { formatCoords, inBangladesh, parseCoords, type LatLng } from '@/shared/map/geo';
import { MapPicker } from '@/shared/map/map-picker';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Field, Input } from '@/shared/ui/form';
import { Dialog } from '@/shared/ui/overlay';
import type { components } from '@/shared/api/schema';
import { useSetBranchLocation } from '../api/settings';

type Branch = components['schemas']['Branch'];
/** Map centre when a branch has no point yet (Barishal). */
const FALLBACK: LatLng = { lat: 22.7022, lng: 90.3696 };

/**
 * FR-BR-002 (contract 1.13.0): the ERP keeps no branch coordinates, so the map point of each branch is set here.
 * It centres maps and drives the data-quality "far from branch" check. ERP sync never clears it.
 */
export function BranchLocations({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('admin-settings');
  const locale = useUi((s) => s.locale);
  const q = useBranches();
  const [editing, setEditing] = useState<Branch | null>(null);
  const list = q.data ?? [];
  const missing = list.filter((b) => b.lat == null || b.lng == null).length;
  return (
    <Card id="set-branches" className="scroll-mt-20 p-0">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-md font-semibold text-fg">{t('sections.branches.title')}</h2>
        <p className="mt-0.5 text-sm text-fg-secondary">{t('sections.branches.desc')}</p>
        {missing > 0 && <p className="mt-1.5 text-sm text-warning">{t('branchPoint.missingCount', { count: missing, n: formatNumber(missing) })}</p>}
      </div>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.isLoading ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((b) => {
            const has = b.lat != null && b.lng != null;
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg" lang={locale}>{pickText(b.name, locale)}</span>
                    <span className="font-mono text-xs text-fg-tertiary">{b.code}</span>
                    {b.kind === 'warehouse' && <Badge tone="neutral" icon={Warehouse}>{t('branchPoint.warehouse')}</Badge>}
                    {b.active === false && <Badge tone="neutral" icon={false}>{t('branchPoint.inactive')}</Badge>}
                  </div>
                  <div className={has ? 'tabular font-mono text-xs text-fg-tertiary' : 'text-xs text-warning'}>
                    {has ? formatCoords({ lat: b.lat!, lng: b.lng! }) : t('branchPoint.none')}
                  </div>
                </div>
                {canManage && (
                  <Button size="sm" className="max-sm:h-11" onClick={() => setEditing(b)} aria-label={`${has ? t('branchPoint.move') : t('branchPoint.set')} · ${pickText(b.name, locale)}`}>
                    {has ? <MapPinned className="size-4" aria-hidden /> : <MapPinPlus className="size-4" aria-hidden />}
                    {has ? t('branchPoint.move') : t('branchPoint.set')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <BranchPointDialog branch={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function BranchPointDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const { t } = useTranslation('admin-settings');
  const { t: tc } = useTranslation();
  const locale = useUi((s) => s.locale);
  const save = useSetBranchLocation();
  const current = branch && branch.lat != null && branch.lng != null ? { lat: branch.lat, lng: branch.lng } : null;
  const [point, setPoint] = useState<LatLng>(FALLBACK);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState(false);

  useEffect(() => {
    if (!branch) return;
    setPoint(current ?? FALLBACK);
    setTyped('');
    setTypedError(false);
    save.reset();
    // each opening starts from the branch's point (or Barishal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id]);

  if (!branch) return null;
  const name = pickText(branch.name, locale);
  const outside = !inBangladesh(point);
  const send = (body: { lat: number | null; lng: number | null }, msg: string) =>
    save.mutate({ id: branch.id!, body }, { onSuccess: () => (toast.success(msg), onClose()) });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !save.isPending && onClose()}
      wide
      title={t('branchPoint.title', { name })}
      description={t('branchPoint.desc')}
      footer={
        <>
          {current && (
            <Button className="me-auto" onClick={() => send({ lat: null, lng: null }, t('branchPoint.removed', { name }))} disabled={save.isPending}>
              <MapPinOff className="size-4" aria-hidden />
              {t('branchPoint.remove')}
            </Button>
          )}
          <Button onClick={onClose} disabled={save.isPending}>{tc('actions.cancel')}</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={outside}
            onClick={() => send({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) }, t('branchPoint.saved', { name }))}
          >
            {t('branchPoint.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
        <MapPicker
          value={point}
          onChange={setPoint}
          zoom={current ? 17 : 13}
          reference={current}
          referenceLabel={t('branchPoint.current')}
          label={t('branchPoint.mapLabel', { name })}
          className="h-[44dvh] min-h-56 sm:h-[340px]"
        />
        <p className="inline-flex items-center gap-1.5 text-sm text-fg" aria-live="polite">
          <Crosshair className="size-4 text-primary" aria-hidden />
          <span className="sr-only">{t('branchPoint.pinAt')}</span>
          <span className="tabular font-mono">{formatCoords(point)}</span>
        </p>
        {outside ? <p role="alert" className="text-sm text-danger">{t('branchPoint.outside')}</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const p = parseCoords(typed);
            setTypedError(!p);
            if (p) setPoint(p);
          }}
        >
          <Field label={t('branchPoint.paste')} help={t('branchPoint.pasteHelp')} error={typedError ? t('branchPoint.pasteError') : undefined}>
            {(id, d) => (
              <div className="flex gap-2">
                <Input id={id} aria-describedby={d} autoComplete="off" value={typed} onChange={(e) => (setTyped(e.target.value), setTypedError(false))} placeholder="22.70123, 90.37011" className="min-w-0 flex-1" />
                <Button type="submit" className="shrink-0" disabled={!typed.trim()}>
                  <LocateFixed className="size-4" aria-hidden />
                  {t('branchPoint.go')}
                </Button>
              </div>
            )}
          </Field>
        </form>
        {save.error ? <ErrorBanner error={save.error} /> : null}
      </div>
    </Dialog>
  );
}
