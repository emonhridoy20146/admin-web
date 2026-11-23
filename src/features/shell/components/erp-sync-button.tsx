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
import { useErpSync, type ErpSyncSummary } from '../api/queries';

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
        const problems = syncProblems(r, t);
        if (r.partial) toast.message(t('erp.syncMore'), problems ? { description: problems } : undefined);
        else if (problems) toast.warning(r.customers > 0 ? t('erp.syncDone', { n: formatNumber(r.customers) }) : t('erp.syncUpToDate'), { description: problems });
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

/**
 * Contract 1.44.0: what the sync could not do, shown only when there is something: ERP customer rows left out
 * (`skipped`) and branches whose pull failed (`failedBranches`, tried again by the next sync). Null when both are 0.
 */
export function syncProblems(r: Pick<ErpSyncSummary, 'skipped' | 'failedBranches'>, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  const parts = [r.skipped > 0 ? t('erp.syncSkipped', { n: formatNumber(r.skipped) }) : null, r.failedBranches > 0 ? t('erp.syncFailedBranches', { n: formatNumber(r.failedBranches) }) : null].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}
