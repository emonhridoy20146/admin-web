'use client';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/shared/lib/ui-store';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { Drawer } from '@/shared/ui/overlay';
import { ErrorBanner, Skeleton } from '@/shared/ui/feedback';
import { MoneyText } from '@/shared/ui/money';
import { StatusBadge } from '@/shared/ui/badge';
import { useDepositCollections, type DepositCoverage, type DepositLine } from '../api/cash';
import { erpSplit, isFinalDeposit } from '../model/cash';
import { CashLines } from './cash-lines';

/**
 * FR-W-053 (master FR-CASH-010, contract 1.35.0): what one deposit contained. A deposit made from 1.35.0 on
 * (`submitted`) is final and lists every collection it handed in, cash and non-cash, each whole, with its ERP state;
 * the office only reads it (no verify, reject or delete, ADR-049). FR-W-048 (FR-CASH-008): an older deposit keeps the
 * oldest-first view of the cash collections it covered.
 */
export function DepositDrawer({ depositId, onClose }: { depositId: string | null; onClose: () => void }) {
  const { t } = useTranslation('cash');
  useUi((s) => s.bnDigits);
  const q = useDepositCollections(depositId);
  const d = q.data;
  const dep = d?.deposit;
  const final = isFinalDeposit(dep);
  return (
    <Drawer
      open={!!depositId}
      onOpenChange={(o) => !o && onClose()}
      title={dep ? t('depositDetail.title', { name: dep.userName ?? '' }) : t('depositDetail.loading')}
      subtitle={final ? t('depositDetail.subtitleFinal') : t('depositDetail.subtitle')}
    >
      {q.error ? <ErrorBanner error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
      ) : d && dep ? (
        <>
          <div className="mb-4 rounded-md border border-line bg-surface-subtle px-3 py-2.5" data-testid="deposit-head">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-fg-tertiary">
                  {t(`destination.${dep.destination}`)}
                  {dep.reference ? <> · <span className="font-mono">{dep.reference}</span></> : null}
                  {' · '}
                  <span className="tabular">{formatDateTime(dep.depositedAt)}</span>
                </p>
                {final && <p className="mt-1 text-xs text-fg-secondary">{t('depositDetail.finalNote')}</p>}
              </div>
              <StatusBadge status={dep.status ?? 'submitted'} />
            </div>
            {dep.rejectReason && <p className="mt-1 text-xs text-fg-tertiary">{t('rejectReason', { reason: dep.rejectReason })}</p>}
            {dep.status === 'deleted' && dep.deleteReason && <p className="mt-1 text-xs text-fg-tertiary">{t('depositDetail.deletedBy', { reason: dep.deleteReason })}</p>}
          </div>
          {final ? <FinalTotals data={d} /> : <LegacyTotals data={d} />}
          {d.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-fg-tertiary">{dep.status === 'rejected' || dep.status === 'deleted' ? t('depositDetail.rejectedEmpty') : t('depositDetail.empty')}</p>
          ) : (
            <CashLines
              items={d.items}
              label={t('depositDetail.list')}
              shown={(c) => (c as DepositLine).coveredPoisha}
              partLabel={t('depositDetail.partOf')}
              erp={final}
            />
          )}
          <p className="mt-4 text-xs text-fg-tertiary">{final ? t('depositDetail.howFinal') : t('depositDetail.how')}</p>
        </>
      ) : null}
    </Drawer>
  );
}

function Tile({ label, children, note, testId }: { label: string; children: React.ReactNode; note?: React.ReactNode; testId?: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-subtle px-3 py-2.5" data-testid={testId}>
      <dt className="text-xs text-fg-tertiary">{label}</dt>
      <dd>{children}</dd>
      {note != null && <dd className="text-xs text-fg-tertiary">{note}</dd>}
    </div>
  );
}

/** 1.35.0: cash, non-cash and count as the deposit carries them, then the same money by ERP state (CLAUDE.md §2.6). */
function FinalTotals({ data }: { data: DepositCoverage }) {
  const { t } = useTranslation('cash');
  const dep = data.deposit;
  const split = erpSplit(data.items);
  const count = dep.collectionCount ?? data.items.length;
  const n = (k: number) => t('inHand.count', { count: k, n: formatNumber(k) });
  return (
    <>
      <dl className="mb-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3" aria-label={t('depositDetail.totals')}>
        <Tile label={t('depositDetail.cash')} testId="deposit-cash">
          <MoneyText poisha={dep.amountPoisha} className="text-md font-semibold text-fg" />
        </Tile>
        <Tile label={t('depositDetail.nonCash')} note={n(dep.nonCashCount ?? 0)} testId="deposit-noncash">
          <MoneyText poisha={dep.nonCashPoisha ?? 0} className="text-md font-semibold text-fg" />
        </Tile>
        <Tile label={t('depositDetail.count')} testId="deposit-count">
          <span className="tabular text-md font-semibold text-fg">{formatNumber(count)}</span>
        </Tile>
      </dl>
      <dl className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2" aria-label={t('depositDetail.erpTotals')} data-testid="deposit-erp">
        <Tile label={t('depositDetail.inErp')} note={n(split.posted.count)}>
          <MoneyText poisha={split.posted.poisha} className="text-md font-semibold text-fg" />
        </Tile>
        <Tile label={t('depositDetail.onTheWay')} note={n(split.onTheWay.count)}>
          <MoneyText poisha={split.onTheWay.poisha} pending className="text-md font-semibold" />
        </Tile>
        {split.problem.count > 0 && (
          <Tile label={t('depositDetail.problem')} note={n(split.problem.count)}>
            <MoneyText poisha={split.problem.poisha} className="text-md font-semibold text-danger" />
          </Tile>
        )}
        {split.voided.count > 0 && (
          <Tile label={t('depositDetail.voided')} note={n(split.voided.count)}>
            <MoneyText poisha={split.voided.poisha} className="text-md font-semibold text-fg-tertiary" />
          </Tile>
        )}
      </dl>
    </>
  );
}

/** Before 1.35.0: which cash a deposit covered, oldest first, and the deposit money with no collection behind it. */
function LegacyTotals({ data }: { data: DepositCoverage }) {
  const { t } = useTranslation('cash');
  return (
    <dl className="mb-4 grid grid-cols-2 gap-3">
      <Tile label={t('depositDetail.amount')}>
        <MoneyText poisha={data.deposit.amountPoisha} className="text-md font-semibold text-fg" />
      </Tile>
      <Tile label={t('depositDetail.covered')} note={t('inHand.count', { count: data.items.length, n: formatNumber(data.items.length) })}>
        <MoneyText poisha={data.coveredPoisha} className="text-md font-semibold text-fg" />
      </Tile>
      <Tile label={t('depositDetail.unmatched')} note={t('depositDetail.unmatchedNote')}>
        <MoneyText poisha={data.unmatchedPoisha} className="text-md font-semibold text-fg" />
      </Tile>
    </dl>
  );
}
