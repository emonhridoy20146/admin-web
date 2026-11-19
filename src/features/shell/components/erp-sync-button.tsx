'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useCan } from '@/shared/auth/session';
import { formatNumber } from '@/shared/lib/format';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/shared/ui/primitives';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useErpSync } from '../api/queries';

/**
 * "Sync from ERP" in the top right of the header (FR-ERP-007). Success is a toast; a failure is an inline banner in a
 * popover under the button (errors are never toasts, FR-W-011), with a retry.
 */
export function ErpSyncButton() {
  const { t } = useTranslation();
  const allowed = useCan('erp.sync');
  const sync = useErpSync();
  const [progress, setProgress] = useState(0);
  const [errorOpen, setErrorOpen] = useState(false);
  if (!allowed) return null;

  const run = () => {
    if (sync.isPending) return;
    setProgress(0);
    setErrorOpen(false);
    sync.mutate(setProgress, {
      onSuccess: (r) => {
        if (r.partial) toast.message(t('erp.syncMore'));
        else toast.success(r.customers > 0 ? t('erp.syncDone', { n: formatNumber(r.customers) }) : t('erp.syncUpToDate'));
      },
      onError: () => setErrorOpen(true),
    });
  };

  return (
    <Popover open={errorOpen && !!sync.error} onOpenChange={setErrorOpen}>
      <Tooltip content={t('erp.syncTip')}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault(); // the popover only opens to show an error, not on click
              run();
            }}
            aria-busy={sync.isPending}
            aria-label={t('erp.syncAria')}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 text-sm font-medium text-fg-secondary shadow-e1 transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-60 [@media(pointer:coarse)]:h-11"
            disabled={sync.isPending}
          >
            <RefreshCw className={cn('size-4', sync.isPending && 'animate-spin motion-reduce:animate-none')} aria-hidden />
            <span className="hidden sm:inline">{sync.isPending ? t('erp.syncing') : t('erp.sync')}</span>
          </button>
        </PopoverTrigger>
      </Tooltip>
      <span className="sr-only" role="status" aria-live="polite">
        {sync.isPending ? t('erp.syncProgress', { n: formatNumber(progress) }) : ''}
      </span>
      <PopoverContent className="w-80 p-3">
        <p className="mb-2 text-sm font-semibold text-fg">{t('erp.syncFailed')}</p>
        <ErrorBanner error={sync.error} onRetry={run} />
      </PopoverContent>
    </Popover>
  );
}
