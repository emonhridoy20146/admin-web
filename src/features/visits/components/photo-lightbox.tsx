'use client';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { formatNumber } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/overlay';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/feedback';
import { useMediaUrl } from '../api/visits';

/** One photo at a time through a presigned URL (FR-VIS-003, FR-W lightbox). Arrow keys move between photos. */
export function PhotoLightbox({ ids, index, onIndex }: { ids: string[]; index: number | null; onIndex: (i: number | null) => void }) {
  const { t } = useTranslation('visits');
  const open = index != null && index >= 0 && index < ids.length;
  const id = open ? ids[index]! : null;
  const q = useMediaUrl(id);
  const many = ids.length > 1;

  useEffect(() => {
    if (!open || !many) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onIndex((index! + 1) % ids.length);
      if (e.key === 'ArrowLeft') onIndex((index! - 1 + ids.length) % ids.length);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, many, index, ids.length, onIndex]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onIndex(null)}
      wide
      title={t('photo.title', { n: formatNumber((index ?? 0) + 1), total: formatNumber(ids.length) })}
      footer={
        many ? (
          <>
            <Button onClick={() => onIndex((index! - 1 + ids.length) % ids.length)}>
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
              {t('photo.prev')}
            </Button>
            <Button onClick={() => onIndex((index! + 1) % ids.length)}>
              {t('photo.next')}
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid min-h-64 place-items-center overflow-hidden rounded-md bg-surface-subtle">
        {q.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : q.data?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned storage URL, static export has no image optimizer
          <img src={q.data.url} alt={t('photo.alt', { n: formatNumber((index ?? 0) + 1) })} className="max-h-[70vh] w-auto max-w-full object-contain" />
        ) : (
          <p className="flex flex-col items-center gap-2 py-10 text-sm text-fg-tertiary">
            <ImageOff className="size-6" aria-hidden />
            {t('photo.failed')}
          </p>
        )}
      </div>
    </Dialog>
  );
}
