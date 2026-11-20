'use client';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatNumber, pickText } from '@/shared/lib/format';
import { Drawer } from '@/shared/ui/overlay';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { StatusBadge } from '@/shared/ui/badge';
import { useCashInHand } from '../api/cash';

/**
 * FR-W-044 (master FR-CASH-007): where a collector's cash on hand came from: each cash collection a deposit has
 * not covered yet, with its customer, invoice and receipt. Field-system cash, not an ERP balance.
 */
export function InHandDrawer({ userId, userName, onClose }: { userId: string | null; userName: string; onClose: () => void }) {
  const { t } = useTranslation('cash');
  const locale = useUi((s) => s.locale);
  useUi((s) => s.bnDigits);
  const q = useCashInHand(userId);
  const d = q.data;
  return (
    <Drawer open={!!userId} onOpenChange={(o) => !o && onClose()} title={t('inHand.title', { name: d?.userName ?? userName })} subtitle={t('inHand.subtitle')}>
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
      ) : d ? (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-line bg-surface-subtle px-3 py-2.5">
              <dt className="text-xs text-fg-tertiary">{t('col.onHand')}</dt>
              <dd><MoneyText poisha={d.onHandPoisha} className="text-md font-semibold text-fg" /></dd>
              <dd className="text-xs text-fg-tertiary">{t('inHand.count', { count: d.count, n: formatNumber(d.count) })}</dd>
            </div>
            <div className="rounded-md border border-line bg-surface-subtle px-3 py-2.5">
              <dt className="text-xs text-fg-tertiary">{t('col.pendingDeposits')}</dt>
              <dd><MoneyText poisha={d.pendingDepositsPoisha} className="text-md font-semibold text-fg" /></dd>
              <dd className="text-xs text-fg-tertiary">{t('inHand.pendingNote')}</dd>
            </div>
          </dl>
          {d.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-fg-tertiary">{t('inHand.empty')}</p>
          ) : (
            <ol className="space-y-2" aria-label={t('inHand.list')}>
              {d.items.map((c) => (
                <li key={c.collectionId} className="rounded-md border border-line bg-surface px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/customers/${c.customer.id}/`} className="block truncate font-medium text-fg hover:text-primary" lang={locale}>
                        {pickText(c.customer.name, locale) || c.customer.code}
                      </Link>
                      <p className="text-xs text-fg-tertiary">
                        <span className="font-mono">{c.customer.code}</span> · {t('inHand.invoice', { no: c.erpPlanId })}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <MoneyText poisha={c.inHandPoisha} className="font-semibold text-fg" />
                      {c.inHandPoisha < c.amountPoisha && (
                        <p className="text-xs text-fg-tertiary">
                          {t('inHand.partOf')} <MoneyText poisha={c.amountPoisha} />
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-secondary">
                    <span>
                      <span className="font-mono">{c.receiptNo}</span> · <span className="tabular">{formatDateTime(c.recordedAt)}</span>
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {d.count > d.items.length && <p className="mt-3 text-sm text-fg-secondary">{t('inHand.more', { n: formatNumber(d.count - d.items.length) })}</p>}
          <p className="mt-4 text-xs text-fg-tertiary">{t('inHand.how')}</p>
        </>
      ) : null}
    </Drawer>
  );
}
