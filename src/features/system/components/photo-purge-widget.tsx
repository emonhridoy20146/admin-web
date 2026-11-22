'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Images } from 'lucide-react';
import { useUi } from '@/shared/lib/ui-store';
import { formatBytes, formatMonth, formatNumber } from '@/shared/lib/format';
import { Card, CardHeader } from '@/shared/ui/card';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { usePurgePreview } from '../api/photos';
import { PurgeAlert } from '../pages/photos-page';

/** Dashboard card (media.delete): photos of the previous months; from the 5th of the month it turns into the alert. */
export function PhotoPurgeWidget() {
  const { t } = useTranslation('system');
  useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const q = usePurgePreview();
  const p = q.data;
  const open = (
    <Link href="/admin/photos/" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
      {t('photos.widget.open')}
    </Link>
  );
  return (
    <Card className="h-full">
      <CardHeader title={t('photos.title')} actions={<Images className="size-4 text-fg-tertiary" aria-hidden />} />
      <div className="p-4">
        {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
        {q.isLoading ? (
          <Skeleton className="h-10" />
        ) : p?.suggest ? (
          <PurgeAlert preview={p} className="mb-0" link={open} />
        ) : p ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-fg-secondary">
              {p.total.count ? t('photos.widget.waiting', { n: formatNumber(p.total.count), size: formatBytes(p.total.bytes), month: formatMonth(p.before) }) : t('photos.widget.none')}
            </span>
            {open}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
