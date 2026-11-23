'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Camera, MapPin, MapPinCheck, MapPinOff, Plus, ShieldAlert, TriangleAlert, Users, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { useGate } from '@/shared/feature/useGate';
import { formatDate, formatDateTime, formatDuration, formatNumber, formatTime, pickText } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, DescList } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Select } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { Drawer } from '@/shared/ui/overlay';
import { useCan } from '@/shared/auth/session';
import { useVisits, type Visit } from '../api/visits';
import { CreateVisitDialog } from '../components/create-visit-dialog';
import { coWorkState, durationMin, geoState, KINDS, OUTCOMES, type GeoState } from '../model/visit';
import { DateRangeFilter, useDateRange } from '@/shared/ui/date-range-filter';
import { StaffSelect } from '@/shared/ui/staff-select';
import { PhotoLightbox } from '../components/photo-lightbox';
import { VisitOutcomeBadge } from '../components/outcome-badge';
const GEO: Record<GeoState, { icon: LucideIcon; cls: string }> = {
  ok: { icon: MapPinCheck, cls: 'text-success' },
  far: { icon: MapPin, cls: 'text-warning' },
  mock: { icon: ShieldAlert, cls: 'text-st-mock' },
  none: { icon: MapPinOff, cls: 'text-fg-tertiary' },
};

export function VisitsPage() {
  const { t } = useTranslation('visits');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const url = useUrlState();
  const range = useDateRange({ reset: ['cursor'] });
  const outcome = oneOf(url.get('outcome'), ['', ...OUTCOMES] as const, '');
  const userId = url.get('userId');
  const cursor = url.get('cursor');
  const gate = useGate();
  const coworkOn = gate.flag('module.cowork');
  const canSessions = coworkOn && gate.can('cowork.view');
  // FR-CW-004: single vs joint visits, and the visits of one co-work session (any day, so the period is not sent)
  const kind = coworkOn ? oneOf(url.get('kind'), ['', ...KINDS] as const, '') : '';
  const session = coworkOn ? url.get('session') : '';
  const [limit, setLimit] = useState(25);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const q = useVisits({
    ...(session ? { coWorkSessionId: session } : { from: range.from, to: range.to }),
    outcome: outcome || undefined,
    userId: userId || undefined,
    coWork: kind === 'joint' ? 'true' : kind === 'single' ? 'false' : undefined,
    cursor: cursor || undefined,
    limit,
  });
  const openId = url.get('drawer');
  const open = q.data?.items.find((v) => v.id === openId) ?? null;
  const [photo, setPhoto] = useState<number | null>(null);
  const canRecord = useCan('visit.record');
  const [createOpen, setCreateOpen] = useState(false);

  const geoCell = (v: Visit) => {
    const s = geoState(v);
    const { icon: Icon, cls } = GEO[s];
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm', cls, s !== 'ok' && s !== 'none' && 'font-medium')}>
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {s === 'ok' || s === 'far' ? (v.distanceToPinM != null ? t('metres', { n: formatNumber(v.distanceToPinM) }) : t('geo.ok')) : t(`geo.${s}`)}
      </span>
    );
  };

  const columns: Column<Visit>[] = [
    {
      id: 'customer',
      header: t('col.customer'),
      priority: 1,
      mobile: 'title',
      cell: (v) => (
        <button type="button" onClick={() => url.set({ drawer: v.id ?? null }, { push: true })} className="block min-w-0 text-start">
          <span className="block max-w-[240px] truncate font-medium text-fg hover:text-primary" lang={locale}>{pickText(v.customer?.name, locale)}</span>
          <span className="block font-mono text-xs text-fg-tertiary">{v.customer?.code}</span>
        </button>
      ),
    },
    { id: 'outcome', header: t('col.outcome'), priority: 1, mobile: 'badges', cell: (v) => <VisitOutcomeBadge outcome={v.outcome} /> },
    { id: 'user', header: t('col.user'), priority: 2, mobile: 'subtitle', cell: (v) => v.user?.name ?? <span className="text-fg-tertiary">—</span> },
    ...(coworkOn ? [{ id: 'with', header: t('col.with'), priority: 2 as const, mobile: 'badges' as const, cell: (v: Visit) => <CoWorkCell v={v} /> }] : []),
    { id: 'time', header: t('col.time'), priority: 1, mobile: 'meta', cell: (v) => <span className="tabular whitespace-nowrap"><span className="text-fg">{formatDate(v.checkInAt, { withYear: false })}</span> <span className="text-fg-secondary">{formatTime(v.checkInAt)}</span></span> },
    {
      id: 'duration',
      header: t('col.duration'),
      align: 'end',
      priority: 3,
      cell: (v) => {
        const m = durationMin(v);
        return m == null ? <span className="text-fg-tertiary">{t('ongoing')}</span> : <span className="tabular">{formatDuration(Math.max(1, m))}</span>;
      },
    },
    { id: 'geo', header: t('col.geo'), priority: 2, mobile: 'meta', cell: geoCell },
    {
      id: 'photos',
      header: t('col.photos'),
      align: 'end',
      priority: 4,
      cell: (v) =>
        v.photoMediaIds?.length ? (
          <span className="inline-flex items-center gap-1 text-fg-secondary">
            <Camera className="size-3.5" aria-hidden />
            <span className="tabular">{formatNumber(v.photoMediaIds.length)}</span>
          </span>
        ) : (
          <span className="text-fg-tertiary">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        print
        actions={
          canRecord ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              {t('create')}
            </Button>
          ) : undefined
        }
      >
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {session ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-info-bg px-3 py-1.5 text-sm text-info">
            <Users className="size-4 shrink-0" aria-hidden />
            <span className="font-medium">{t('cowork.sessionFilter')}</span>
            {canSessions && (
              <Link href={`/cowork/?drawer=${session}`} className="font-medium underline underline-offset-2">{t('cowork.openSession')}</Link>
            )}
            <Button size="sm" variant="ghost" onClick={() => (pager.reset(), url.set({ session: null, cursor: null }))} aria-label={t('cowork.clearSession')}>
              <X className="size-4" aria-hidden />
              {t('cowork.clearSession')}
            </Button>
          </div>
        ) : (
          <DateRangeFilter value={range} onChange={(c, r) => (pager.reset(), range.set(c, r))} label={t('range.label')} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <StaffSelect value={userId} onChange={(id) => (pager.reset(), url.set({ userId: id, cursor: null }))} knownName={q.data?.items.find((v) => (v.user?.id ?? v.userId) === userId)?.user?.name} />
          {coworkOn && !session && (
            <Select aria-label={t('cowork.kind')} value={kind} onChange={(e) => (pager.reset(), url.set({ kind: e.target.value || null, cursor: null }))} className="h-9 sm:w-44">
              <option value="">{t('cowork.allKinds')}</option>
              {KINDS.map((k) => <option key={k} value={k}>{t(`cowork.kinds.${k}`)}</option>)}
            </Select>
          )}
          <Select aria-label={t('col.outcome')} value={outcome} onChange={(e) => (pager.reset(), url.set({ outcome: e.target.value || null, cursor: null }))} className="h-9 sm:w-56">
            <option value="">{t('allOutcomes')}</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{t(`outcome.${o}`)}</option>)}
          </Select>
        </div>
      </div>

      <DataTable
        tableId="visits"
        caption={t('title')}
        columns={columns}
        rows={q.data?.items}
        rowKey={(v) => v.id ?? v.clientId}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        empty={<EmptyState icon={MapPinCheck} title={t('empty')} body={t('emptyBody')} />}
        pager={{ page: pager.page, hasPrev: pager.hasPrev, hasNext: !!q.data?.nextCursor, onPrev: pager.prev, onNext: () => pager.next(q.data?.nextCursor), pageSize: limit, onPageSize: (n) => (pager.reset(), setLimit(n)) }}
      />

      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && (setPhoto(null), url.set({ drawer: null }))}
        title={open ? <span lang={locale}>{pickText(open.customer?.name, locale)}</span> : ''}
        subtitle={open ? formatDateTime(open.checkInAt) : undefined}
        headerExtra={open ? <VisitOutcomeBadge outcome={open.outcome} /> : undefined}
        footer={
          open ? (
            <>
              <Button variant="ghost" onClick={() => (pager.reset(), url.set({ userId: open.user?.id ?? open.userId ?? null, drawer: null, cursor: null }))}>{t('onlyStaff')}</Button>
              <Link href={`/customers/${open.customer?.id ?? open.customerId}/`} className="ms-auto inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-primary hover:bg-surface-hover">
                {t('openCustomer')}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </>
          ) : undefined
        }
      >
        {open && (
          <div className="space-y-5 p-5">
            {coworkOn && coWorkState(open) === 'invalid' && (
              <p className="flex items-start gap-2 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('cowork.invalidHint')}
              </p>
            )}
            {geoState(open) === 'mock' && (
              <p className="flex items-start gap-2 rounded-sm bg-st-mock-bg px-3 py-2 text-sm text-st-mock">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('mockHint')}
              </p>
            )}
            <DescList
              items={[
                { label: coworkOn && open.coWork ? t('cowork.recordedBy') : t('col.user'), value: open.user?.name ?? '—' },
                ...(coworkOn && open.coWork
                  ? [
                      {
                        label: t('col.with'),
                        value: (
                          <span className="flex flex-col gap-0.5">
                            <span lang={locale}>{open.coWork.participants?.map((p) => p.name).join(', ') || t('cowork.partners', { n: formatNumber(open.coWork.participantIds?.length ?? 0) })}</span>
                            {canSessions && open.coWork.sessionId && (
                              <Link href={`/cowork/?drawer=${open.coWork.sessionId}`} className="text-sm font-medium text-primary hover:underline">{t('cowork.openSession')}</Link>
                            )}
                          </span>
                        ),
                      },
                    ]
                  : []),
                { label: t('col.duration'), value: durationMin(open) == null ? t('ongoing') : formatDuration(Math.max(1, durationMin(open)!)) },
                { label: t('checkIn'), value: formatTime(open.checkInAt) },
                { label: t('checkOut'), value: open.checkOutAt ? formatTime(open.checkOutAt) : '—' },
                { label: t('col.geo'), value: geoCell(open) },
                { label: t('accuracy'), value: open.geo ? t('metres', { n: formatNumber(Math.round(open.geo.accuracyM)) }) : open.geoUnavailableReason ? t(`geoReason.${open.geoUnavailableReason}`) : '—' },
                { label: t('source'), value: t(`sourceOf.${open.source ?? 'manual'}`) },
                { label: t('day'), value: formatDate(open.checkInAt) },
              ]}
            />
            <section>
              <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{t('col.photos')}</h3>
              {open.photoMediaIds?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {open.photoMediaIds.map((id, i) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setPhoto(i)}
                        className="grid size-20 place-items-center rounded-md border border-line bg-surface-subtle text-fg-secondary hover:border-primary hover:text-primary"
                        aria-label={t('photo.open', { n: formatNumber(i + 1) })}
                      >
                        <Camera className="size-5" aria-hidden />
                        <span className="tabular text-xs">{formatNumber(i + 1)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-tertiary">{t('noPhotos')}</p>
              )}
            </section>
          </div>
        )}
      </Drawer>
      <PhotoLightbox ids={open?.photoMediaIds ?? []} index={photo} onIndex={setPhoto} />
      <CreateVisitDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

/** FR-CW-003: who else was there, or a warning when the visit claimed co-work that the server could not confirm. */
function CoWorkCell({ v }: { v: Visit }) {
  const { t } = useTranslation('visits');
  const locale = useUi((s) => s.locale);
  const state = coWorkState(v);
  if (state === 'invalid') return <Badge tone="warning">{t('cowork.invalid')}</Badge>;
  if (state === 'single') return <span className="text-fg-tertiary">—</span>;
  const names = v.coWork?.participants?.map((p) => p.name).filter(Boolean) ?? [];
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Badge tone="info" icon={Users}>{t('cowork.joint')}</Badge>
      <span className="max-w-[180px] truncate text-sm text-fg-secondary" lang={locale}>
        {names.length ? names.join(', ') : t('cowork.partners', { n: formatNumber(v.coWork?.participantIds?.length ?? 0) })}
      </span>
    </span>
  );
}
