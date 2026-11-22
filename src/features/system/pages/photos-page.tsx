'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, HardDrive, ImageOff, Images, Trash2, TriangleAlert } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUi } from '@/shared/lib/ui-store';
import { formatBytes, formatDate, formatMonth, formatNumber } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/page';
import { Card, CardHeader } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/primitives';
import { ConfirmTypeDialog } from '@/shared/ui/confirm-type-dialog';
import { useHealth } from '../api/system';
import { usePurgeCall, usePurgePreview, type PurgePreview } from '../api/photos';
import { confirmTextFor, progressShare, runPurge, type PurgeProgress } from '../model/photos';

/**
 * FR-W-054 (master FR-MED-002/003, field-api ADR-050): where staff photos are kept, and deleting every photo of the
 * previous months in one go after typing `DELETE <YYYY-MM>`. The server deletes 200 per call; this page repeats the call
 * and shows the progress. Money proofs (deposit slips, refund proofs) only when ticked.
 */
export function PhotosPage() {
  const { t } = useTranslation('system');
  useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const [withProofs, setWithProofs] = useState(false);
  const preview = usePurgePreview(withProofs);
  const health = useHealth();
  const call = usePurgeCall();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<PurgeProgress | null>(null);
  const [done, setDone] = useState<PurgeProgress | null>(null);
  const p = preview.data;
  const total = p?.total.count ?? 0;
  const inCloud = health.data?.cloudStorage === 'cloudinary';

  const start = async (typed: string) => {
    if (!p) return;
    setDone(null);
    setProgress({ deleted: 0, bytes: 0, remaining: total });
    try {
      const r = await runPurge(() => call.mutateAsync({ before: p.before, includeMoneyProofs: withProofs, confirmText: typed }), setProgress);
      setDone(r);
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <PageHeader title={t('photos.title')}>
        <span>{t('photos.subtitle')}</span>
      </PageHeader>

      <Card className="mb-4">
        <CardHeader title={t('photos.store.title')} />
        {health.isLoading ? (
          <div className="p-4"><Skeleton className="h-5" /></div>
        ) : (
          <div className="flex items-start gap-3 p-4">
            {inCloud ? <Cloud className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <HardDrive className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
            <div className="min-w-0">
              <p className="text-base font-medium text-fg" data-testid="photo-store">{inCloud ? t('photos.store.cloudinary') : t('photos.store.fallback')}</p>
              <p className="text-sm text-fg-secondary">{inCloud ? t('photos.store.cloudinaryHelp') : t('photos.store.fallbackHelp')}</p>
            </div>
          </div>
        )}
      </Card>

      {p?.suggest ? <PurgeAlert preview={p} /> : null}

      <Card>
        <CardHeader
          title={t('photos.old.title')}
          subtitle={p ? t('photos.old.subtitle', { date: formatDate(`${p.before}-01`, { withYear: true }) }) : undefined}
          actions={
            <Button variant="destructive" disabled={!total || !!progress} onClick={() => setOpen(true)}>
              <Trash2 className="size-4" aria-hidden />
              {t('photos.old.delete')}
            </Button>
          }
        />
        <div className="border-b border-line px-4 py-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <Checkbox checked={withProofs} onCheckedChange={(c) => setWithProofs(c === true)} aria-describedby={withProofs ? 'proofs-warning' : undefined} />
            <span className="text-sm font-medium text-fg">{t('photos.old.moneyProofs')}</span>
          </label>
          {withProofs ? (
            <p id="proofs-warning" className="mt-1 flex gap-2 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('photos.old.moneyProofsWarning')}
            </p>
          ) : null}
        </div>
        {preview.error ? <div className="p-4"><ErrorBanner error={preview.error} onRetry={() => preview.refetch()} /></div> : null}
        {done ? (
          <p role="status" className="border-b border-line bg-success-bg px-4 py-3 text-sm font-medium text-success" data-testid="purge-done">
            {t('photos.old.done', { n: formatNumber(done.deleted), size: formatBytes(done.bytes) })}
          </p>
        ) : null}
        {preview.isLoading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
        ) : p && !p.months.length ? (
          <EmptyState icon={ImageOff} title={t('photos.old.empty')} />
        ) : p ? (
          <table className="w-full text-sm" data-testid="purge-months">
            <caption className="sr-only">{t('photos.old.title')}</caption>
            <thead>
              <tr className="text-fg-secondary">
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('photos.old.month')}</th>
                <th scope="col" className="px-4 py-2 text-end font-semibold">{t('photos.old.count')}</th>
                <th scope="col" className="px-4 py-2 text-end font-semibold">{t('photos.old.size')}</th>
              </tr>
            </thead>
            <tbody>
              {p.months.map((m) => (
                <tr key={m.month} className="border-t border-line">
                  <td className="px-4 py-2.5 text-fg">{formatMonth(m.month)}</td>
                  <td className="tabular px-4 py-2.5 text-end">{formatNumber(m.count)}</td>
                  <td className="tabular px-4 py-2.5 text-end text-fg-secondary">{formatBytes(m.bytes)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong font-semibold">
                <th scope="row" className="px-4 py-2.5 text-start">{t('photos.old.total')}</th>
                <td className="tabular px-4 py-2.5 text-end">{formatNumber(p.total.count)}</td>
                <td className="tabular px-4 py-2.5 text-end">{formatBytes(p.total.bytes)}</td>
              </tr>
            </tfoot>
          </table>
        ) : null}
      </Card>

      {p ? (
        <ConfirmTypeDialog
          open={open}
          onOpenChange={(o) => !progress && setOpen(o)}
          title={t('photos.confirm.title')}
          word={confirmTextFor(p.before)}
          exact
          confirmLabel={t('photos.confirm.button', { n: formatNumber(total) })}
          onConfirm={start}
        >
          <p className="text-sm text-fg">{t('photos.confirm.body', { n: formatNumber(total), size: formatBytes(p.total.bytes), date: formatDate(`${p.before}-01`, { withYear: true }) })}</p>
          <p className="text-sm text-fg-secondary">{t('photos.confirm.where')}</p>
          {withProofs ? <Badge tone="warning" icon={TriangleAlert}>{t('photos.confirm.withProofs')}</Badge> : null}
          {progress ? <PurgeBar progress={progress} total={total} /> : null}
        </ConfirmTypeDialog>
      ) : null}
    </>
  );
}

function PurgeBar({ progress, total }: { progress: PurgeProgress; total: number }) {
  const { t } = useTranslation('system');
  const share = progressShare(progress, total);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div role="progressbar" aria-label={t('photos.confirm.progressLabel')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} className="h-2 overflow-hidden rounded-full bg-surface-subtle">
        <div className="h-full rounded-full bg-danger transition-[width]" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="tabular text-sm text-fg-secondary">{t('photos.confirm.progress', { n: formatNumber(progress.deleted), total: formatNumber(progress.deleted + progress.remaining) })}</p>
    </div>
  );
}

/** Shown from the 5th of the month when there is something to delete (also as a dashboard card). */
export function PurgeAlert({ preview, className, link }: { preview: PurgePreview; className?: string; link?: React.ReactNode }) {
  const { t } = useTranslation('system');
  return (
    <div role="status" data-testid="purge-alert" className={cn('mb-4 flex flex-wrap items-start gap-3 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning', className)}>
      <Images className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 font-medium">{t('photos.alert', { n: formatNumber(preview.total.count), size: formatBytes(preview.total.bytes), month: formatMonth(preview.before) })}</span>
      {link}
    </div>
  );
}
