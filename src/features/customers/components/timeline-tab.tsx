'use client';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Flag, Handshake, MapPinCheck, Receipt, StickyNote, Wallet, Clock, MapPin, Route, type LucideIcon } from 'lucide-react';
import { formatDateTime, formatMoney, pickText } from '@/shared/lib/format';
import { useUi } from '@/shared/lib/ui-store';
import { StatusBadge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { useTimeline } from '../api/customers';

const ICON: Record<string, LucideIcon> = {
  erp_payment: Receipt, collection: Wallet, visit: MapPinCheck, note: StickyNote, promise: Handshake, tag: Flag,
  handover: ArrowLeftRight, assignment: ArrowLeftRight, location_correction: MapPin, attendance: Clock, stop: Route,
};

export function TimelineTab({ customerId }: { customerId: string }) {
  const { t } = useTranslation('customers');
  const locale = useUi((s) => s.locale);
  const q = useTimeline(customerId);
  const items = q.data?.pages.flatMap((p) => p.items ?? []) ?? [];
  if (q.isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (q.error) return <ErrorBanner error={q.error} onRetry={() => q.refetch()} />;
  if (!items.length) return <EmptyState icon={Clock} title={t('timeline.empty')} />;
  return (
    <div>
      <ol className="relative ms-4 border-s border-line">
        {items.map((it, i) => {
          const Icon = ICON[it.kind ?? ''] ?? Clock;
          const amount = typeof it.data?.amountPoisha === 'number' ? (it.data.amountPoisha as number) : null;
          // FR-W-073 (1.53.0): an ERP payment to a returned invoice is tagged; the server's summary says so too
          const returned = it.kind === 'erp_payment' && it.data?.returned === true;
          return (
            <li key={`${it.refId}-${i}`} className="ms-6 pb-5 last:pb-0">
              <span className="absolute -start-[15px] grid size-[30px] place-items-center rounded-full border border-line bg-surface text-fg-secondary">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-base text-fg" lang={locale}>
                  {pickText(it.summary, locale)}
                  {returned && <StatusBadge status="returned_payment" className="ms-2 align-middle" testId="returned-payment-tag" />}
                </p>
                {amount != null && <span className={returned ? 'tabular text-base font-medium text-fg-secondary' : 'tabular text-base font-medium'}>{formatMoney(amount)}</span>}
              </div>
              <p className="text-xs text-fg-tertiary">{formatDateTime(it.at!)}{it.actor?.name ? ` · ${it.actor.name}` : ''}</p>
            </li>
          );
        })}
      </ol>
      {q.hasNextPage && (
        <Button className="mt-4" size="sm" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>{t('timeline.more')}</Button>
      )}
    </div>
  );
}
