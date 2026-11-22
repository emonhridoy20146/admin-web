'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Check, MapPinned, X } from 'lucide-react';
import { useBranches } from '@/features/shell';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatNumber, pickText } from '@/shared/lib/format';
import { useUrlState } from '@/shared/lib/url-state';
import { boundsOf } from '@/shared/map/geo';
import { MapView } from '@/shared/map/map-view';
import { PageHeader } from '@/shared/ui/page';
import { Button } from '@/shared/ui/button';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { useMoveRequests, type Place } from '../api/places';
import { placeMarkers } from '../model/places';
import { PlaceKind } from '../components/place-icon';
import { PlaceDrawer } from '../components/place-drawer';
import { ApproveMoveDialog, RejectMoveDialog } from '../components/place-actions';

/** FR-PLC-005: staff asked to move these markers; each card shows where it is, where they want it and why. */
export function MoveRequestsPage() {
  const { t } = useTranslation('places');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const branches = useBranches();
  const url = useUrlState();
  const q = useMoveRequests();
  const [act, setAct] = useState<{ kind: 'approve' | 'reject'; place: Place } | null>(null);
  const items = q.data ?? [];
  const openId = url.get('drawer');
  const open = items.find((x) => x.id === openId) ?? null;

  return (
    <>
      <PageHeader title={t('moves.title')} crumbs={[{ label: t('title'), href: '/places/' }, { label: t('moves.title') }]}>
        <span>{t('moves.subtitle')}</span>
      </PageHeader>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : !items.length ? (
        <EmptyState icon={MapPinned} title={t('moves.empty')} body={t('moves.emptyBody')} action={<Link href="/places/" className="text-sm font-medium text-primary hover:underline">{t('moves.toPlaces')}</Link>} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2" aria-label={t('moves.title')}>
          {items.map((p) => (
            <MoveCard key={p.id} place={p} branch={pickText(branches.data?.find((b) => b.id === p.branchId)?.name, locale)} onOpen={() => url.set({ drawer: p.id }, { push: true })} onAct={(kind) => setAct({ kind, place: p })} />
          ))}
        </ul>
      )}
      <PlaceDrawer place={open} onClose={() => url.set({ drawer: null })} />
      {act && <ApproveMoveDialog place={act.place} open={act.kind === 'approve'} onOpenChange={(o) => !o && setAct(null)} />}
      {act && <RejectMoveDialog place={act.place} open={act.kind === 'reject'} onOpenChange={(o) => !o && setAct(null)} />}
    </>
  );
}

function MoveCard({ place, branch, onOpen, onAct }: { place: Place; branch: string; onOpen: () => void; onAct: (k: 'approve' | 'reject') => void }) {
  const { t } = useTranslation('places');
  const locale = useUi((s) => s.locale);
  const pm = place.pendingMove!;
  const map = useMemo(() => placeMarkers([place], { selectedId: place.id, movedTitle: (p) => t('map.requestedPoint', { name: p.name }) }), [place, t]);
  const fit = useMemo(() => boundsOf([place.location, pm.location], 0.0015), [place.location, pm.location]);
  return (
    <li className="flex flex-col overflow-hidden rounded-md border border-line bg-surface shadow-e1">
      <div className="h-56">
        <MapView label={t('moves.mapLabel', { name: place.name })} center={place.location} zoom={17} markers={map.markers} lines={map.lines} fit={fit} className="rounded-none border-0" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-h-11 text-start text-base font-semibold text-fg hover:text-primary" lang={locale}>{place.name}</button>
          <PlaceKind icon={place.icon} />
        </div>
        <p className="text-sm text-fg-secondary">{t('drawer.moveRequestBy', { who: pm.requestedBy.name, at: formatDateTime(pm.requestedAt), n: formatNumber(pm.distanceM) })}</p>
        {pm.reason ? <p className="whitespace-pre-line text-sm text-fg" lang={locale}>“{pm.reason}”</p> : <p className="text-sm text-fg-tertiary">{t('moves.noReason')}</p>}
        <p className="text-xs text-fg-tertiary" lang={locale}>{branch}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button variant="primary" onClick={() => onAct('approve')}>
            <Check className="size-4" aria-hidden />
            {t('actions.approve')}
          </Button>
          <Button onClick={() => onAct('reject')}>
            <X className="size-4" aria-hidden />
            {t('actions.reject')}
          </Button>
        </div>
      </div>
    </li>
  );
}
