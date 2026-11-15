'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CheckCheck } from 'lucide-react';
import { Card, CardHeader } from '@/shared/ui/card';
import { EmptyState, ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { formatNumber } from '@/shared/lib/format';
import { useInbox } from '../api/inbox';
import { InboxRow } from './inbox-item';

/** Dashboard extension point: top open exceptions. */
export function InboxWidget() {
  const { t } = useTranslation('inbox');
  const { t: tc } = useTranslation();
  const q = useInbox('open', 6);
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {t('widgetTitle')}
            {q.data?.counts?.open != null && <span className="tabular rounded-full bg-danger-bg px-2 text-xs font-semibold text-danger">{formatNumber(q.data.counts.open)}</span>}
          </span>
        }
        actions={<Link href="/inbox/" className="text-sm font-medium text-primary hover:underline">{tc('actions.viewAll')}</Link>}
      />
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} className="m-3" /> : null}
      {q.isLoading ? (
        <div className="space-y-4 p-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
        </div>
      ) : q.data?.items?.length ? (
        <ul className="divide-y divide-line">
          {q.data.items.slice(0, 6).map((i) => <InboxRow key={i.id} item={i} compact />)}
        </ul>
      ) : (
        <EmptyState icon={CheckCheck} title={t('emptyTitle')} body={t('emptyBody')} />
      )}
    </Card>
  );
}
