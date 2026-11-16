'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CameraOff, ImageOff, MapPinOff, PencilLine, ShieldAlert, TimerReset, UploadCloud, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatDate, formatNumber, formatTime } from '@/shared/lib/format';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Dialog, Drawer } from '@/shared/ui/overlay';
import { useEvents, useSelfieUrl, type AttendanceEvent } from '../api/attendance';
import { eventFlags, summariseEvents, type EventFlag } from '../model/attendance';

const FLAG_ICON: Record<EventFlag, LucideIcon> = { no_selfie: CameraOff, no_location: MapPinOff, mock_location: ShieldAlert, clock_skew: TimerReset, late_sync: UploadCloud };
const FLAG_TONE: Record<EventFlag, 'danger' | 'warning' | 'neutral'> = { no_selfie: 'danger', no_location: 'warning', mock_location: 'danger', clock_skew: 'warning', late_sync: 'neutral' };

/** FR-ATT-001: every attendance event of one staff member on one day, each with the photo taken at that moment. */
export function DayDrawer({ target, onClose }: { target: { userId: string; name: string; date: string } | null; onClose: () => void }) {
  const { t } = useTranslation('attendance');
  useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const q = useEvents(target?.userId ?? null, target?.date ?? '');
  const [zoom, setZoom] = useState<AttendanceEvent | null>(null);
  const sum = summariseEvents(q.data);

  return (
    <>
      <Drawer open={!!target} onOpenChange={(o) => !o && onClose()} title={target?.name ?? ''} subtitle={target ? formatDate(target.date, { withYear: true }) : undefined}>
        {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
        {q.isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-md" />)}</div>
        ) : q.data && !q.data.length ? (
          <p className="py-10 text-center text-sm text-fg-tertiary">{t('events.empty')}</p>
        ) : q.data ? (
          <>
            <p className={cn('mb-3 text-sm', sum.noPhoto > 0 ? 'text-danger' : 'text-fg-secondary')}>
              {sum.noPhoto > 0 ? t('events.summaryMissing', { n: formatNumber(sum.noPhoto), total: formatNumber(sum.total) }) : t('events.summary', { n: formatNumber(sum.withPhoto), total: formatNumber(sum.total) })}
            </p>
            <ol className="space-y-3">
              {q.data.map((e) => (
                <li key={e.id} className={cn('flex gap-3 rounded-md border border-line bg-surface p-3', e.replaced && 'opacity-60')}>
                  <Selfie event={e} label={t('events.openPhoto', { event: t(`event.${e.type}`) })} onOpen={() => setZoom(e)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-base font-medium text-fg', e.replaced && 'line-through')}>{t(`event.${e.type}`)}</p>
                    <p className="tabular text-sm text-fg-secondary">{formatTime(e.at)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {e.source === 'correction' && <Badge tone="neutral" icon={PencilLine}>{t('corrected')}</Badge>}
                      {e.replaced && <Badge tone="neutral" icon={false}>{t('events.replaced')}</Badge>}
                      {eventFlags(e).map((f) => <Badge key={f} tone={FLAG_TONE[f]} icon={FLAG_ICON[f]}>{t(`events.flag.${f}`)}</Badge>)}
                    </div>
                    {e.geo && typeof e.geo.accuracyM === 'number' ? <p className="tabular mt-1 text-xs text-fg-tertiary">{t('events.accuracy', { n: formatNumber(Math.round(e.geo.accuracyM)) })}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </Drawer>

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)} title={zoom && target ? t('events.photoTitle', { name: target.name, event: t(`event.${zoom.type}`), time: formatTime(zoom.at) }) : ''}>
        <ZoomPhoto id={zoom?.selfieMediaId ?? null} alt={zoom && target ? t('events.photoAlt', { name: target.name, event: t(`event.${zoom.type}`) }) : ''} />
      </Dialog>
    </>
  );
}

function Selfie({ event, label, onOpen }: { event: AttendanceEvent; label: string; onOpen: () => void }) {
  const { t } = useTranslation('attendance');
  const q = useSelfieUrl(event.selfieMediaId);
  const box = 'grid size-20 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-subtle';
  if (!event.selfieMediaId)
    return (
      <div className={cn(box, 'text-fg-tertiary')}>
        <span className="flex flex-col items-center gap-1 text-center text-xs">
          <CameraOff className="size-5" aria-hidden />
          {t('events.noPhoto')}
        </span>
      </div>
    );
  return (
    <button type="button" onClick={onOpen} aria-label={label} className={cn(box, 'hover:border-primary focus-visible:outline-2 focus-visible:outline-primary')}>
      {q.isLoading ? (
        <Skeleton className="size-full" />
      ) : q.data?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned storage URL, static export has no image optimizer
        <img src={q.data.url} alt="" className="size-full object-cover" />
      ) : (
        <ImageOff className="size-5 text-fg-tertiary" aria-hidden />
      )}
    </button>
  );
}

function ZoomPhoto({ id, alt }: { id: string | null; alt: string }) {
  const { t } = useTranslation('attendance');
  const q = useSelfieUrl(id);
  return (
    <div className="grid min-h-64 place-items-center overflow-hidden rounded-md bg-surface-subtle">
      {q.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : q.data?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned storage URL, static export has no image optimizer
        <img src={q.data.url} alt={alt} className="max-h-[70vh] w-auto max-w-full object-contain" />
      ) : (
        <p className="flex flex-col items-center gap-2 py-10 text-sm text-fg-tertiary">
          <ImageOff className="size-6" aria-hidden />
          {t('events.photoFailed')}
        </p>
      )}
    </div>
  );
}
