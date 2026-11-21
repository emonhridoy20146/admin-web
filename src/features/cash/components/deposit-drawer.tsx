'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useCan } from '@/shared/auth/session';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format';
import { Drawer } from '@/shared/ui/overlay';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { StatusBadge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ReasonDialog } from '@/shared/ui/reason-dialog';
import { useDeleteDeposit, useDepositCollections, type DepositCoverage } from '../api/cash';
import { CashLines } from './cash-lines';

/**
 * FR-W-048 (master FR-CASH-008): which cash collections one deposit covered. Deposits pay off the oldest
 * collections first, the same rule the cash-on-hand drawer uses, so the two never overlap.
 */
export function DepositDrawer({ depositId, onClose }: { depositId: string | null; onClose: () => void }) {
  const { t } = useTranslation('cash');
  useUi((s) => s.bnDigits);
  const q = useDepositCollections(depositId);
  const canDelete = useCan('cash.deposit.delete');
  const del = useDeleteDeposit();
  const [deleting, setDeleting] = useState(false);
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
            {dep.status === 'deleted' && dep.deleteReason && <p className="mt-1 text-xs text-fg-tertiary">{t('depositDetail.deletedBy', { reason: dep.deleteReason })}</p>}
            {canDelete && (dep.status === 'pending' || dep.status === 'verified') && (
              <Button size="sm" className="mt-3" onClick={() => setDeleting(true)}>
                <Trash2 className="size-4" aria-hidden />
                {t('deleteDeposit')}
              </Button>
            )}
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
            <p className="py-10 text-center text-sm text-fg-tertiary">{dep.status === 'rejected' || dep.status === 'deleted' ? t('depositDetail.rejectedEmpty') : t('depositDetail.empty')}</p>
          ) : (
            <CashLines items={d.items} label={t('depositDetail.list')} shown={(c) => (c as DepositCoverage['items'][number]).coveredPoisha} partLabel={t('depositDetail.partOf')} />
          )}
          <p className="mt-4 text-xs text-fg-tertiary">{t('depositDetail.how')}</p>
        </>
      ) : null}
      {dep && (
        <ReasonDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={t('deleteTitle', { amount: formatMoney(dep.amountPoisha ?? 0), name: dep.userName ?? '' })}
          description={t('deleteDesc')}
          codes={(['duplicate', 'wrong_amount', 'not_received', 'other'] as const).map((c) => [c, t(`deleteCodes.${c}`)])}
          minLength={5}
          destructive
          confirmLabel={t('deleteConfirm')}
          onSubmit={async ({ reasonCode, reason }) => {
            await del.mutateAsync({ id: dep.id!, reason: `${t(`deleteCodes.${reasonCode}`, { lng: 'en' })}: ${reason}` });
            toast.success(t('deleted'));
          }}
        />
      )}
    </Drawer>
  );
}
