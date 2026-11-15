'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CheckCheck } from 'lucide-react';
import { PageHeader } from '@/shared/ui/page';
import { Card } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { FilterChip } from '@/shared/ui/primitives';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { formatNumber } from '@/shared/lib/format';
import { oneOf, useUrlState } from '@/shared/lib/url-state';
import { useInbox, useResolveInbox, useSnooze, type InboxItem } from '../api/inbox';
import { InboxRow } from '../components/inbox-item';

const SEV = ['critical', 'high', 'medium', 'low'] as const;
const STATUSES = ['open', 'snoozed', 'resolved'] as const;

export function InboxPage() {
  const { t } = useTranslation('inbox');
  const { t: tc } = useTranslation();
  const url = useUrlState();
  const status = oneOf(url.get('status'), STATUSES, 'open');
  const sev = url.get('severity');
  const q = useInbox(status, 100);
  const snooze = useSnooze();
  const resolve = useResolveInbox();
  const [resolving, setResolving] = useState<InboxItem | null>(null);
  const items = (q.data?.items ?? []).filter((i) => !sev || i.severity === sev);
  const counts = q.data?.counts ?? {};

  return (
    <>
      <PageHeader title={t('title')}>
        <span>{t('subtitle')}</span>
      </PageHeader>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-md border border-line bg-surface p-0.5 shadow-e1" role="tablist">
          {STATUSES.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              onClick={() => url.set({ status: s === 'open' ? null : s })}
              className={`h-8 rounded-sm px-3 text-sm font-medium transition-colors [@media(pointer:coarse)]:h-10 ${status === s ? 'bg-primary-subtle text-primary-subtle-fg' : 'text-fg-secondary hover:text-fg'}`}
            >
              {t(s)}
              {s === 'open' && counts.open != null && <span className="tabular ms-1.5 text-xs opacity-70">{formatNumber(counts.open)}</span>}
            </button>
          ))}
        </div>
        {status === 'open' && (
          <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <FilterChip selected={!sev} onClick={() => url.set({ severity: null })}>{t('all')}</FilterChip>
            {SEV.map((s) => (
              <FilterChip key={s} selected={sev === s} onClick={() => url.set({ severity: sev === s ? null : s })} count={counts[s]}>
                {tc(`severity.${s}`)}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="mb-4" /> : null}
      <Card className="overflow-hidden">
        {q.isLoading ? (
          <ul className="divide-y divide-line">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-4">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <EmptyState icon={CheckCheck} title={t('emptyTitle')} body={t('emptyBody')} />
        ) : (
          SEV.filter((s) => items.some((i) => i.severity === s)).map((s) => (
            <section key={s} aria-label={tc(`severity.${s}`)}>
              <h2 className="sticky top-14 z-[1] flex items-center gap-2 border-b border-line bg-surface-subtle px-5 py-2 text-xs font-semibold text-fg-secondary">
                {tc(`severity.${s}`)}
                <span className="tabular text-fg-tertiary">{formatNumber(items.filter((i) => i.severity === s).length)}</span>
              </h2>
              <ul className="divide-y divide-line">
                {items.filter((i) => i.severity === s).map((i) => (
                  <InboxRow
                    key={i.id}
                    item={i}
                    onSnooze={status === 'open' ? () => snooze.mutate(i.id!, { onSuccess: () => toast.success(t('snoozedToast')) }) : undefined}
                    onResolve={status !== 'resolved' ? () => setResolving(i) : undefined}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>
      <ReasonDialog
        open={!!resolving}
        onOpenChange={(o) => !o && setResolving(null)}
        title={t('resolveTitle')}
        confirmLabel={t('resolveConfirm')}
        minLength={5}
        onSubmit={async (v) => {
          await resolve.mutateAsync({ id: resolving!.id!, reason: v.reason });
          toast.success(t('resolvedToast'));
        }}
      />
    </>
  );
}
