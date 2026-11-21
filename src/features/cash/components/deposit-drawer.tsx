'use client';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { Drawer } from '@/shared/ui/overlay';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { StatusBadge } from '@/shared/ui/badge';
import { useDepositCollections, type DepositCoverage } from '../api/cash';
import { CashLines } from './cash-lines';

/**
 * FR-W-048 (master FR-CASH-008): which cash collections one deposit covered. Deposits pay off the oldest
 * collections first, the same rule the cash-on-hand drawer uses, so the two never overlap.
 */
export function DepositDrawer({ depositId, onClose }: { depositId: string | null; onClose: () => void }) {
  const { t } = useTranslation('cash');
  useUi((s) => s.bnDigits);
  const q = useDepositCollections(depositId);
  const d = q.data;
  const dep = d?.deposit;
  return (
    <Drawer
      open={!!depositId}
      onOpenChange={(o) => !o && onClose()}
      title={dep ? t('depositDetail.title', { name: dep.userName ?? '' }) : t('depositDetail.loading')}
      subtitle={t('depositDetail.subtitle')}
    >
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
      ) : d && dep ? (
        <>
          <div className="mb-4 rounded-md border border-line bg-surface-subtle px-3 py-2.5" data-testid="deposit-head">
            <div className="flex items-start justify-between gap-3">
              <div>
                <MoneyText poisha={dep.amountPoisha} className="text-lg font-semibold text-fg" />
                <p className="text-xs text-fg-tertiary">
                  {t(`destination.${dep.destination}`)}
                  {dep.reference ? <> · <span className="font-mono">{dep.reference}</span></> : null}
                  {' · '}
                  <span className="tabular">{formatDateTime(dep.depositedAt)}</span>
                </p>
              </div>
              <StatusBadge status={dep.status ?? 'pending'} />
            </div>
            {dep.rejectReason && <p className="mt-1 text-xs text-fg-tertiary">{t('rejectReason', { reason: dep.rejectReason })}</p>}
          </div>
          <dl className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-line bg-surface-subtle px-3 py-2.5">
              <dt className="text-xs text-fg-tertiary">{t('depositDetail.covered')}</dt>
              <dd><MoneyText poisha={d.coveredPoisha} className="text-md font-semibold text-fg" /></dd>
              <dd className="text-xs text-fg-tertiary">{t('inHand.count', { count: d.items.length, n: formatNumber(d.items.length) })}</dd>
            </div>
            <div className="rounded-md border border-line bg-surface-subtle px-3 py-2.5">
              <dt className="text-xs text-fg-tertiary">{t('depositDetail.unmatched')}</dt>
              <dd><MoneyText poisha={d.unmatchedPoisha} className="text-md font-semibold text-fg" /></dd>
              <dd className="text-xs text-fg-tertiary">{t('depositDetail.unmatchedNote')}</dd>
            </div>
          </dl>
          {d.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-fg-tertiary">{dep.status === 'rejected' ? t('depositDetail.rejectedEmpty') : t('depositDetail.empty')}</p>
          ) : (
            <CashLines items={d.items} label={t('depositDetail.list')} shown={(c) => (c as DepositCoverage['items'][number]).coveredPoisha} partLabel={t('depositDetail.partOf')} />
          )}
          <p className="mt-4 text-xs text-fg-tertiary">{t('depositDetail.how')}</p>
        </>
      ) : null}
    </Drawer>
  );
}
