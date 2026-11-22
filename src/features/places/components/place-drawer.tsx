'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Move, Pencil, Trash2, X } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useCan, useSession } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatNumber, pickText } from '@/shared/lib/format';
import { formatCoords } from '@/shared/map/geo';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DescList } from '@/shared/ui/page';
import { Drawer } from '@/shared/ui/overlay';
import type { Place } from '../api/places';
import { actionsFor } from '../model/places';
import { PlaceKind } from './place-icon';
import { PlaceDialog } from './place-dialog';
import { ApproveMoveDialog, DeletePlaceDialog, RejectMoveDialog } from './place-actions';

type Act = 'edit' | 'move' | 'approve' | 'reject' | 'delete' | null;

/** One place: words, where it is, an open move request (FR-PLC-004/005) and its history. Actions follow permission and ownership. */
export function PlaceDrawer({ place, onClose }: { place: Place | null; onClose: () => void }) {
  const { t } = useTranslation('places');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branches = useBranches();
  const me = useSession((s) => s.user?.id);
  const canCreate = useCan('place.create');
  const canManage = useCan('place.manage');
  const [act, setAct] = useState<Act>(null);
  const can = place ? actionsFor(place, { id: me, canCreate, canManage }) : null;
  const branch = pickText(branches.data?.find((b) => b.id === place?.branchId)?.name, locale) || place?.branchId;
  const pm = place?.pendingMove ?? null;
  const last = place?.lastMoveDecision ?? null;

  const footer =
    place && can && (can.edit || can.move || can.remove || can.decide) ? (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {can.decide && (
            <>
              <Button variant="primary" onClick={() => setAct('approve')}>
                <Check className="size-4" aria-hidden />
                {t('actions.approve')}
              </Button>
              <Button onClick={() => setAct('reject')}>
                <X className="size-4" aria-hidden />
                {t('actions.reject')}
              </Button>
            </>
          )}
          {can.edit && (
            <Button onClick={() => setAct('edit')}>
              <Pencil className="size-4" aria-hidden />
              {t('actions.edit')}
            </Button>
          )}
          {can.move && (
            <Button onClick={() => setAct('move')}>
              <Move className="size-4" aria-hidden />
              {t('actions.move')}
            </Button>
          )}
        </div>
        {can.remove && (
          <Button variant="destructive" onClick={() => setAct('delete')}>
            <Trash2 className="size-4" aria-hidden />
            {t('actions.delete')}
          </Button>
        )}
      </div>
    ) : undefined;

  return (
    <>
      <Drawer
        open={!!place}
        onOpenChange={(o) => !o && onClose()}
        title={place ? <span lang={locale}>{place.name}</span> : ''}
        subtitle={place ? <span>{t('drawer.addedBy', { who: place.createdBy.name, at: formatDateTime(place.createdAt) })}</span> : undefined}
        width={520}
        footer={footer}
      >
        {place && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <PlaceKind icon={place.icon} />
              {place.status === 'deleted' && <Badge tone="danger">{t('status.deleted')}</Badge>}
              {pm && <Badge tone="warning">{t('status.movePending')}</Badge>}
            </div>
            <DescList
              items={[
                { label: t('drawer.branch'), value: <span lang={locale}>{branch}</span> },
                { label: t('drawer.point'), value: <span className="tabular font-mono">{formatCoords(place.location)}</span> },
                { label: t('drawer.updated'), value: <span>{t('drawer.updatedBy', { who: place.updatedBy.name, at: formatDateTime(place.updatedAt) })}</span> },
              ]}
            />
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-fg">{t('drawer.note')}</h3>
              {place.note ? <p className="whitespace-pre-line rounded-md border border-line bg-surface p-3 text-base text-fg" lang={locale}>{place.note}</p> : <p className="text-sm text-fg-tertiary">{t('drawer.noNote')}</p>}
            </section>

            {pm && (
              <section className="space-y-1.5 rounded-md border border-warning/40 bg-warning-bg p-3">
                <h3 className="text-sm font-semibold text-fg">{t('drawer.moveRequest')}</h3>
                <p className="text-sm text-fg">{t('drawer.moveRequestBy', { who: pm.requestedBy.name, at: formatDateTime(pm.requestedAt), n: formatNumber(pm.distanceM) })}</p>
                <p className="tabular font-mono text-xs text-fg-secondary">{formatCoords(place.location)} → {formatCoords(pm.location)}</p>
                {pm.reason ? <p className="whitespace-pre-line text-sm text-fg" lang={locale}>“{pm.reason}”</p> : null}
              </section>
            )}

            {!pm && last && (
              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold text-fg">{t('drawer.lastDecision')}</h3>
                <p className="text-sm text-fg-secondary">{t(last.decision === 'approve' ? 'drawer.lastApproved' : 'drawer.lastRejected', { who: last.by.name, by: last.requestedBy.name, at: formatDateTime(last.at) })}</p>
                {last.reason ? <p className="whitespace-pre-line text-sm text-fg-secondary" lang={locale}>“{last.reason}”</p> : null}
              </section>
            )}

            {place.status === 'deleted' && place.deleteReason ? (
              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold text-fg">{t('drawer.deleteReason')}</h3>
                <p className="text-sm text-fg-secondary" lang={locale}>{place.deleteReason}</p>
              </section>
            ) : null}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg">{t('drawer.history')}</h3>
              <ol className="space-y-3 border-s border-line ps-4">
                {[...place.events].reverse().map((e, i) => (
                  <li key={`${e.type}-${e.at}-${i}`} className="relative">
                    <span className="absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                    <p className="text-sm text-fg">{t(`history.${e.type}`, { who: e.by.name })}</p>
                    <p className="tabular text-xs text-fg-tertiary">{formatDateTime(e.at)}</p>
                    {e.note && <p className="mt-1 whitespace-pre-line text-sm text-fg-secondary" lang={locale}>“{e.note}”</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Drawer>
      {place && (
        <>
          <PlaceDialog open={act === 'edit'} onOpenChange={(o) => !o && setAct(null)} place={place} mode="edit" canMove={false} />
          <PlaceDialog open={act === 'move'} onOpenChange={(o) => !o && setAct(null)} place={place} mode="move" canMove />
          <ApproveMoveDialog place={place} open={act === 'approve'} onOpenChange={(o) => !o && setAct(null)} />
          <RejectMoveDialog place={place} open={act === 'reject'} onOpenChange={(o) => !o && setAct(null)} />
          <DeletePlaceDialog place={place} open={act === 'delete'} onOpenChange={(o) => !o && setAct(null)} onDone={onClose} />
        </>
      )}
    </>
  );
}
