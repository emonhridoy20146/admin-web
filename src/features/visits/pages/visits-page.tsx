'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Camera, MapPin, MapPinCheck, MapPinOff, ShieldAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatDateTime, formatDuration, formatNumber, formatTime, pickText } from '@/shared/lib/format';
import { todayDhaka } from '@/shared/lib/time';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { PageHeader, DescList } from '@/shared/ui/page';
import { DataTable, useCursorPager, type Column } from '@/shared/ui/data-table';
import { EmptyState } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import { Segmented } from '@/shared/ui/primitives';
import { Select } from '@/shared/ui/form';
import { Button } from '@/shared/ui/button';
import { Drawer } from '@/shared/ui/overlay';
import { useVisits, type Visit } from '../api/visits';
import { durationMin, geoState, OUTCOMES, rangeFor, RANGES, type GeoState } from '../model/visit';
import { PhotoLightbox } from '../components/photo-lightbox';

const TONE: Record<string, Tone> = {
  paid: 'paid', partial_paid: 'dueToday', promised: 'promised', not_home: 'neutral', refused: 'danger',
  shifted_address: 'warning', customer_dead: 'neutral', product_returned_request: 'warning', other: 'neutral',
};
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
  const today = todayDhaka();
  const range = oneOf(url.get('range'), RANGES, 'today');
  const outcome = oneOf(url.get('outcome'), ['', ...OUTCOMES] as const, '');
  const userId = url.get('userId');
  const cursor = url.get('cursor');
  const [limit, setLimit] = useState(25);
  const pager = useCursorPager(cursor, (c) => url.set({ cursor: c }));
  const q = useVisits({ ...rangeFor(range, today), outcome: outcome || undefined, userId: userId || undefined, cursor: cursor || undefined, limit });
  const openId = url.get('drawer');
  const open = q.data?.items.find((v) => v.id === openId) ?? null;
  const [photo, setPhoto] = useState<number | null>(null);
  const multiDay = range === '7d' || range === '30d';

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
    { id: 'outcome', header: t('col.outcome'), priority: 1, mobile: 'badges', cell: (v) => <Badge tone={TONE[v.outcome] ?? 'neutral'}>{t(`outcome.${v.outcome}`)}</Badge> },
    { id: 'user', header: t('col.user'), priority: 2, mobile: 'subtitle', cell: (v) => v.user?.name ?? <span className="text-fg-tertiary">—</span> },
    { id: 'time', header: t('col.time'), priority: 1, mobile: 'meta', cell: (v) => <span className="tabular">{multiDay ? formatDateTime(v.checkInAt) : formatTime(v.checkInAt)}</span> },
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
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label={t('range.label')}
          value={range}
          onChange={(v) => (pager.reset(), url.set({ range: v === 'today' ? null : v, cursor: null }))}
          options={RANGES.map((r) => ({ value: r, label: t(`range.${r}`) }))}
        />
        <div className="flex items-center gap-2">
          {userId && (
            <Button size="sm" variant="ghost" onClick={() => (pager.reset(), url.set({ userId: null, cursor: null }))}>{t('clearStaff')}</Button>
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
        headerExtra={open ? <Badge tone={TONE[open.outcome] ?? 'neutral'}>{t(`outcome.${open.outcome}`)}</Badge> : undefined}
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
            {geoState(open) === 'mock' && (
              <p className="flex items-start gap-2 rounded-sm bg-st-mock-bg px-3 py-2 text-sm text-st-mock">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('mockHint')}
              </p>
            )}
            <DescList
              items={[
                { label: t('col.user'), value: open.user?.name ?? '—' },
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
    </>
  );
}
